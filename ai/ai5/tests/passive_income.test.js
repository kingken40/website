const assert = require('assert');
const PI = require('../scripts/nova_passive_income.js');

const now = new Date(2026, 10, 5, 15, 0, 0).getTime(); // Thu Nov 5 2026
const day = 86400000;
assert.strictEqual(PI.defaultState().productDraft, null);
const template = PI.demoProductTemplate();
const templateCheck = PI.validateProductDraft(template);
assert.strictEqual(templateCheck.valid, true);
assert.strictEqual(templateCheck.draft.fileName, 'the-weekly-reset-planner.txt');
assert.strictEqual(PI.validateProductDraft({ title: 'X', description: 'short', content: 'tiny', price: 0 }).valid, false);
const savedDraft = PI.updateProductDraft(null, template);
assert.strictEqual(savedDraft.valid, true);
const approvedDraft = PI.setDemoProductDecision(savedDraft.draft, 'approved', now);
assert.strictEqual(PI.isDemoProductApprovalCurrent(approvedDraft), true);
assert.strictEqual(PI.setDemoProductDecision(savedDraft.draft, 'approved', now).approval.decidedAt, now);
const changedDraft = PI.updateProductDraft(approvedDraft, Object.assign({}, template, { title: 'A new weekly reset' }));
assert.strictEqual(changedDraft.valid, true);
assert.strictEqual(changedDraft.draft.approval, null);
assert.strictEqual(PI.isDemoProductApprovalCurrent(changedDraft.draft), false);
assert.strictEqual(PI.setDemoProductDecision(savedDraft.draft, 'published', now), null);
const state = PI.defaultState();
state.sources.push({ id: 's1', name: 'Shop', type: 'Other', status: 'active' });

assert.strictEqual(PI.parseMoney('$1,234.567'), 1234.57);
assert.strictEqual(PI.parseMoney('-5'), null);
assert.strictEqual(PI.parseMoney('abc'), null);

const r = PI.mergeSync(state, {
    entries: [
        { externalId: 'a', sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 10, ts: new Date(now - 1000).toISOString() },
        { externalId: 'a', sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 10 },          // duplicate
        { externalId: 'b', sourceId: 's1', type: 'revenue', status: 'estimated', amount: 500 },         // estimate dropped
        { externalId: 'c', sourceId: 's1', type: 'revenue', status: 'pending', amount: 5 },
        { externalId: 'd', sourceId: 'nope', type: 'revenue', status: 'confirmed', amount: 5 },         // unknown source
        { externalId: 'e', sourceId: 's1', type: 'expense', status: 'confirmed', amount: 3 },
        { externalId: 'f', sourceId: 's1', type: 'revenue', status: 'confirmed', amount: -4 },
        { externalId: 'g', sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 20, ts: new Date(now - 3 * day).toISOString() },
        { externalId: 'r1', sourceId: 's1', type: 'refund', status: 'confirmed', amount: 4, ts: new Date(now).toISOString(), originalTs: new Date(now - 3 * day).toISOString() },
        { externalId: 'r2', sourceId: 's1', type: 'refund', status: 'confirmed', amount: 2, ts: new Date(now).toISOString() },
        { externalId: 'r3', sourceId: 's1', type: 'refund', status: 'pending', amount: 50, ts: new Date(now).toISOString() },
        { externalId: 'r4', sourceId: ' ', type: 'refund', status: 'confirmed', amount: 50, ts: new Date(now).toISOString() },
        { externalId: ' ', sourceId: 's1', type: 'refund', status: 'confirmed', amount: 50, ts: new Date(now).toISOString() },
        { externalId: 'r5', sourceId: 'nope', type: 'refund', status: 'confirmed', amount: 50, ts: new Date(now).toISOString() },
        { externalId: 'r1', sourceId: 's1', type: 'refund', status: 'confirmed', amount: 4, ts: new Date(now).toISOString() },
        { externalId: 'demo-order', sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 100, ts: new Date(now).toISOString(), origin: 'demo' }
    ],
    approvals: [{ id: 'ap1', title: 'Buy domain', cost: 12 }, { id: 'ap1', title: 'Buy domain' }]
}, now);
assert.strictEqual(r.added, 6);
assert.strictEqual(r.approvals, 1);
assert.strictEqual(state.ledger.some(entry => entry.externalId === 'demo-order'), false);

[
    { environment: 'demo' },
    { environment: 'test' },
    { isTest: true }
].forEach((marker, index) => {
    const markedState = PI.defaultState();
    markedState.sources.push({ id: 's1', name: 'Shop', type: 'Other', status: 'active' });
    const result = PI.mergeSync(markedState, Object.assign({}, marker, {
        entries: [{ externalId: 'marked-payload-' + index, sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 100 }]
    }), now);
    assert.strictEqual(result.added, 0);
    assert.strictEqual(result.ignored, 1);
    assert.strictEqual(markedState.ledger.length, 0);
    assert.strictEqual(markedState.approvals.length, 0);
});

[
    { environment: 'demo' },
    { environment: 'test' },
    { isTest: true }
].forEach((marker, index) => {
    const markedState = PI.defaultState();
    markedState.sources.push({ id: 's1', name: 'Shop', type: 'Other', status: 'active' });
    const result = PI.mergeSync(markedState, {
        entries: [Object.assign({
            externalId: 'marked-entry-' + index, sourceId: 's1', type: 'revenue', status: 'confirmed', amount: 100
        }, marker)]
    }, now);
    assert.strictEqual(result.added, 0);
    assert.strictEqual(result.ignored, 1);
    assert.strictEqual(markedState.ledger.length, 0);
});
assert.strictEqual(state.ledger.every(entry => entry.origin !== 'demo'), true);
assert.strictEqual(state.ledger.find(entry => entry.externalId === 'a').origin, 'connector');

const st = PI.computeStats(state.ledger, now);
assert.strictEqual(st.total, 24);   // 10 + 20 confirmed revenue less 6 confirmed refunds
assert.strictEqual(st.today, 8);    // r1 uses its original order date; r2 falls back to the refund date
assert.strictEqual(st.pending, 5);
assert.strictEqual(st.refunds, 6);
assert.strictEqual(st.expenses, 3);
assert.strictEqual(st.net, 21);
assert.strictEqual(st.week, 24);    // r1 uses its original order date; r2 is within this week
assert.strictEqual(st.month, 24);
assert.strictEqual(state.ledger.find(entry => entry.externalId === 'r1').originalTs, now - 3 * day);
assert.strictEqual(state.ledger.find(entry => entry.externalId === 'r2').originalTs, undefined);

state.ledger.push({ type: 'payout', status: 'confirmed', amount: 7, ts: now });
assert.strictEqual(PI.computeStats(state.ledger, now).available, 14);
const futureStats = PI.computeStats([{ type: 'revenue', status: 'confirmed', amount: 25, ts: now + day }], now);
assert.strictEqual(futureStats.today, 0);
assert.strictEqual(futureStats.week, 0);
assert.strictEqual(futureStats.month, 0);
const demoRefundStats = PI.computeStats([
    { type: 'refund', status: 'confirmed', amount: 25, ts: now, origin: 'demo' },
    { type: 'revenue', status: 'confirmed', amount: 100, ts: now, origin: 'demo' },
    { type: 'revenue', status: 'confirmed', amount: 100, ts: now, environment: 'test' },
    { type: 'revenue', status: 'confirmed', amount: 100, ts: now, isTest: true },
    { type: 'revenue', status: 'confirmed', amount: 100, ts: now, origin: 'test' }
], now);
assert.strictEqual(demoRefundStats.refunds, 0);
assert.strictEqual(demoRefundStats.total, 0);
const history = PI.defaultState();
for (let i = 0; i < 130; i++) PI.pushActivity(history, 'Activity ' + i);
assert.strictEqual(history.activity.length, 130);
assert.strictEqual(PI.sourceSummaries(state)[0].revenue, 24);
assert.strictEqual(PI.formatMoney(1234.5), '$1,234.50');
console.log('ALL PASS');
