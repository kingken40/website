import importlib.util
import json
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
import subprocess
import sys
import unittest

path = Path(__file__).resolve().parents[1] / "backend" / "digital_product_shop.py"
spec = importlib.util.spec_from_file_location("digital_product_shop", path)
shop = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = shop
spec.loader.exec_module(shop)

NOW = datetime(2026, 11, 6, 12, tzinfo=timezone.utc)


class DigitalProductShopTest(unittest.TestCase):
    def setUp(self):
        self.product = shop.ProductDraft("p1", "Planner", "A daily planner",
                                         "planner.txt", "My original planner", 500)
        self.approval = shop.Approval("a1", "p1", shop.Action.PUBLISH,
                                      self.product.revision(), shop.Decision.APPROVED,
                                      shop.Environment.DEMO, NOW)
        self.order = shop.ConfirmedOrder("1", "source", 1000, NOW, shop.Environment.LIVE)
        self.refund = shop.ConfirmedRefund("9", "1", 250, NOW + timedelta(days=1),
                                           shop.Environment.LIVE)
        self.expense = shop.ConfirmedExpense("2", "source", 50, NOW, shop.Environment.LIVE)

    def test_approval_is_specific_to_revision_action_and_environment(self):
        self.assertTrue(self.approval.permits_publication(self.product, shop.Environment.DEMO))
        for field, value in (("title", "Updated"), ("description", "Updated"),
                             ("filename", "new.txt"), ("file_text", "Updated"),
                             ("price_cents", 600)):
            self.assertFalse(self.approval.permits_publication(
                replace(self.product, **{field: value}), shop.Environment.DEMO))
        self.assertFalse(self.approval.permits_publication(self.product, shop.Environment.LIVE))
        self.assertFalse(replace(self.approval, decision=shop.Decision.REJECTED)
                         .permits_publication(self.product, shop.Environment.DEMO))
        self.assertFalse(replace(self.approval, action=shop.Action.CHANGE_PRICE)
                         .permits_publication(self.product, shop.Environment.DEMO))

    def test_unconfigured_adapter_never_performs_external_actions(self):
        adapter = shop.UnconfiguredWooCommerce()
        calls = [
            lambda: adapter.publish(self.product, self.approval),
            lambda: adapter.orders(None), lambda: adapter.refunds(None),
            lambda: adapter.verify_webhook(b"{}", {}),
        ]
        for call in calls:
            with self.assertRaisesRegex(RuntimeError, "not configured"):
                call()

    def test_confirmed_ledger_shape_and_partial_refund(self):
        entries = shop.confirmed_ledger("store", [self.order], [self.refund], [self.expense])
        self.assertEqual([e["type"] for e in entries], ["revenue", "refund", "expense"])
        self.assertEqual([e["amount"] for e in entries], [10, 2.5, 0.5])
        self.assertEqual(entries[1]["originalTs"], NOW.isoformat())
        self.assertEqual(entries[1]["sourceId"], "source")
        self.assertEqual(len({e["externalId"] for e in entries}), 3)

    def test_demo_cannot_be_exported_as_revenue(self):
        for record in (replace(self.order, environment=shop.Environment.DEMO),
                       replace(self.order, environment="live")):
            with self.assertRaises(ValueError):
                shop.confirmed_ledger("store", [record], [], [])
        with self.assertRaises(ValueError):
            shop.confirmed_ledger("store", [self.order],
                                  [replace(self.refund, environment=shop.Environment.DEMO)], [])
        with self.assertRaises(ValueError):
            shop.confirmed_ledger("store", [self.order], [],
                                  [replace(self.expense, environment=shop.Environment.DEMO)])

    def test_reconciliation_rejects_bad_data(self):
        cases = [
            ([self.order, self.order], [], []),
            ([self.order], [self.refund, self.refund], []),
            ([self.order], [replace(self.refund, order_id="missing")], []),
            ([self.order], [replace(self.refund, amount_cents=1001)], []),
            ([self.order], [self.refund, replace(self.refund, refund_id="10", amount_cents=751)], []),
            ([self.order], [replace(self.refund, refunded_at=NOW - timedelta(days=1))], []),
            ([replace(self.order, currency="EUR")], [], []),
            ([replace(self.order, amount_cents=True)], [], []),
            ([replace(self.order, paid_at=NOW.replace(tzinfo=None))], [], []),
            ([self.order], [], [self.expense, self.expense]),
        ]
        for orders, refunds, expenses in cases:
            with self.subTest(orders=orders, refunds=refunds, expenses=expenses):
                with self.assertRaises(ValueError):
                    shop.confirmed_ledger("store", orders, refunds, expenses)

    def test_invalid_product(self):
        for values in ({"filename": "../private.txt"}, {"price_cents": 0},
                       {"file_text": ""}, {"currency": "EUR"}):
            with self.assertRaises(ValueError):
                replace(self.product, **values)

    def test_webhook_contract_requires_digest_and_timezone(self):
        event = shop.VerifiedWebhook("event", "order.updated", NOW, "a" * 64, shop.Environment.DEMO)
        with self.assertRaises(ValueError):
            replace(event, payload_hash="not-a-digest")
        with self.assertRaises(ValueError):
            replace(event, received_at=NOW.replace(tzinfo=None))

    def test_backend_entries_match_dashboard_contract(self):
        entries = shop.confirmed_ledger("store", [self.order], [self.refund], [self.expense])
        script = """
const assert = require('assert');
const PI = require(process.argv[1]);
const data = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const state = PI.defaultState();
state.sources.push({id:'source',name:'Test',type:'Other',status:'active'});
const merged = PI.mergeSync(state, {entries: data}, Date.parse('2026-11-08T12:00:00Z'));
assert.strictEqual(merged.added, 3);
const stats = PI.computeStats(state.ledger, Date.parse('2026-11-08T12:00:00Z'));
assert.strictEqual(stats.total, 7.5);
assert.strictEqual(stats.refunds, 2.5);
assert.strictEqual(stats.expenses, 0.5);
assert.strictEqual(stats.net, 7);
assert.strictEqual(PI.mergeSync(state, {entries: data}).added, 0);
"""
        frontend = str(path.parents[1] / "scripts" / "nova_passive_income.js")
        result = subprocess.run(["node", "-e", script, frontend], input=json.dumps(entries),
                                text=True, capture_output=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
