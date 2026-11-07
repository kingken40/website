"""Disconnected contracts for a future, authenticated WooCommerce integration.

This module intentionally has no HTTP routes, credential storage, scheduler, or
WooCommerce client. An implementation must enforce authorization server-side
before performing any operation or treating provider data as verified.
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from hashlib import sha256
import json
from typing import Optional, Protocol, Sequence


class Environment(str, Enum):
    DEMO = "demo"
    LIVE = "live"


class Action(str, Enum):
    CONNECT_ACCOUNT = "connect_account"
    PUBLISH = "publish"
    CHANGE_PRICE = "change_price"
    SPEND = "spend"


class Decision(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


def _text(value: str, name: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{name} must not be empty")


def _cents(value: int, name: str, *, positive: bool = True) -> None:
    if type(value) is not int or value < (1 if positive else 0) or value > 100_000_000_000:
        raise ValueError(f"{name} must be integer USD cents within dashboard limits")


def _timestamp(value: datetime, name: str) -> None:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must include a timezone")


@dataclass(frozen=True)
class ProductDraft:
    product_id: str
    title: str
    description: str
    filename: str
    file_text: str
    price_cents: int
    currency: str = "USD"

    def __post_init__(self):
        for field in ("product_id", "title", "description", "filename", "file_text"):
            _text(getattr(self, field), field)
        if "/" in self.filename or "\\" in self.filename or self.filename in (".", ".."):
            raise ValueError("filename must be a plain filename")
        _cents(self.price_cents, "price_cents")
        if self.currency != "USD":
            raise ValueError("only USD products are supported")

    def revision(self) -> str:
        payload = {
            "product_id": self.product_id, "title": self.title,
            "description": self.description, "filename": self.filename,
            "file_text": self.file_text, "price_cents": self.price_cents,
            "currency": self.currency,
        }
        return sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False,
                                 separators=(",", ":")).encode("utf-8")).hexdigest()


@dataclass(frozen=True)
class Approval:
    approval_id: str
    subject_id: str
    action: Action
    revision: str
    decision: Decision
    environment: Environment
    decided_at: datetime

    def __post_init__(self):
        for field in ("approval_id", "subject_id", "revision"):
            _text(getattr(self, field), field)
        if not isinstance(self.action, Action) or not isinstance(self.decision, Decision):
            raise ValueError("invalid approval action or decision")
        if not isinstance(self.environment, Environment):
            raise ValueError("invalid approval environment")
        _timestamp(self.decided_at, "decided_at")

    def permits_publication(self, product: ProductDraft, environment: Environment) -> bool:
        return (
            self.action is Action.PUBLISH
            and self.decision is Decision.APPROVED
            and self.environment is environment
            and self.subject_id == product.product_id
            and self.revision == product.revision()
        )


@dataclass(frozen=True)
class ConfirmedOrder:
    order_id: str
    source_id: str
    amount_cents: int
    paid_at: datetime
    environment: Environment
    currency: str = "USD"


@dataclass(frozen=True)
class ConfirmedRefund:
    refund_id: str
    order_id: str
    amount_cents: int
    refunded_at: datetime
    environment: Environment
    currency: str = "USD"


@dataclass(frozen=True)
class ConfirmedExpense:
    expense_id: str
    source_id: str
    amount_cents: int
    incurred_at: datetime
    environment: Environment
    currency: str = "USD"


@dataclass(frozen=True)
class VerifiedWebhook:
    """Only construct after server-side signature verification and replay checks."""
    event_id: str
    topic: str
    received_at: datetime
    payload_hash: str
    environment: Environment

    def __post_init__(self):
        _text(self.event_id, "event_id")
        _text(self.topic, "topic")
        _timestamp(self.received_at, "received_at")
        if not isinstance(self.payload_hash, str) or len(self.payload_hash) != 64 or any(
                c not in "0123456789abcdef" for c in self.payload_hash):
            raise ValueError("payload_hash must be a lowercase SHA-256 digest")
        if not isinstance(self.environment, Environment):
            raise ValueError("invalid webhook environment")


class WooCommerceAdapter(Protocol):
    """Future implementation: server-side authentication and durable storage required."""

    def publish(self, product: ProductDraft, approval: Approval) -> str:
        """Publish the exact approved revision; return the provider product ID."""
        ...

    def orders(self, cursor: Optional[str]) -> Sequence[ConfirmedOrder]:
        """Return verified, paid orders, not estimates or test data."""
        ...

    def refunds(self, cursor: Optional[str]) -> Sequence[ConfirmedRefund]:
        """Return verified refunds, including partial refunds."""
        ...

    def verify_webhook(self, body: bytes, headers: dict) -> VerifiedWebhook:
        """Verify the provider signature and replay protection before accepting an event."""
        ...


class UnconfiguredWooCommerce:
    """Fail closed until an authenticated and approved adapter is installed."""

    def _unavailable(self):
        raise RuntimeError("WooCommerce is not configured; no external action was performed")

    def publish(self, product: ProductDraft, approval: Approval) -> str:
        self._unavailable()

    def orders(self, cursor: Optional[str]) -> Sequence[ConfirmedOrder]:
        self._unavailable()

    def refunds(self, cursor: Optional[str]) -> Sequence[ConfirmedRefund]:
        self._unavailable()

    def verify_webhook(self, body: bytes, headers: dict) -> VerifiedWebhook:
        self._unavailable()


def confirmed_ledger(store_id: str, orders: Sequence[ConfirmedOrder],
                     refunds: Sequence[ConfirmedRefund],
                     expenses: Sequence[ConfirmedExpense]) -> list:
    """Translate verified live records to dashboard entries; demo data is forbidden.

    The caller must provide a complete snapshot and reconcile refunds, corrections,
    deletions and pagination durably. This function is not itself a sync endpoint.
    """
    _text(store_id, "store_id")
    if not all(c.isalnum() or c in "-_" for c in store_id):
        raise ValueError("store_id contains invalid characters")
    entries = []
    by_id = {}
    seen = set()

    def check(record, record_id, timestamp):
        _text(record_id, "record ID")
        if not isinstance(record.environment, Environment) or record.environment is not Environment.LIVE:
            raise ValueError("demo or test records cannot enter the live ledger")
        if record.currency != "USD":
            raise ValueError("only USD records are supported")
        _cents(record.amount_cents, "amount_cents")
        _timestamp(timestamp, "record timestamp")

    def add(kind, record_id, source_id, amount, ts, original_ts=None):
        _text(source_id, "source_id")
        external_id = f"woocommerce:{store_id}:{kind}:{record_id}"
        if external_id in seen:
            raise ValueError(f"duplicate {kind} ID")
        seen.add(external_id)
        entry = {"externalId": external_id, "sourceId": source_id, "type": kind,
                 "status": "confirmed", "amount": amount / 100, "ts": ts.isoformat()}
        if original_ts is not None:
            entry["originalTs"] = original_ts.isoformat()
        entries.append(entry)

    for order in orders:
        check(order, order.order_id, order.paid_at)
        if order.order_id in by_id:
            raise ValueError("duplicate order ID")
        by_id[order.order_id] = [order, 0]
        add("revenue", order.order_id, order.source_id, order.amount_cents, order.paid_at)
    for refund in refunds:
        check(refund, refund.refund_id, refund.refunded_at)
        _text(refund.order_id, "order_id")
        if refund.order_id not in by_id:
            raise ValueError("refund has no matching confirmed order")
        order, refunded = by_id[refund.order_id]
        if refund.refunded_at < order.paid_at or refunded + refund.amount_cents > order.amount_cents:
            raise ValueError("invalid refund amount or timestamp")
        by_id[refund.order_id][1] += refund.amount_cents
        add("refund", refund.refund_id, order.source_id, refund.amount_cents,
            refund.refunded_at, order.paid_at)
    for expense in expenses:
        check(expense, expense.expense_id, expense.incurred_at)
        add("expense", expense.expense_id, expense.source_id, expense.amount_cents, expense.incurred_at)
    return entries
