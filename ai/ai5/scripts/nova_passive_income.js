/* AI5 Passive Income Mode: a password-protected revenue dashboard.
   Revenue only counts CONFIRMED earnings (from a connected source or entered by the user).
   Estimated/potential revenue is never counted. Anything that spends money, touches financial
   accounts or signs contracts is queued as an approval request and never done automatically. */
(function (root) {
    'use strict';

    const STORE_KEY = 'nova_passive_income_v1';
    const UNLOCK_KEY = 'nova_passive_income_unlocked_v1';
    const UNLOCK_PASSWORD = 'earn';
    const SYNC_URL = '/api/passive-income/sync';
    const SYNC_INTERVAL_MS = 15 * 60 * 1000;
    const SOURCE_TYPES = ['Affiliate content', 'Digital products', 'Print-on-demand', 'Ad revenue', 'Freelance / services', 'Other'];

    /* ---------- pure logic ---------- */

    function parseMoney(v) {
        if (v === null || v === undefined || v === '') return null;
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,\s]/g, ''));
        if (!Number.isFinite(n) || n < 0 || n > 1e9) return null;
        return Math.round(n * 100) / 100;
    }

    function round2(n) { return Math.round(n * 100) / 100; }

    function isTestData(value) {
        return value && (value.isTest === true || value.environment === 'demo' || value.environment === 'test' ||
            value.origin === 'demo' || value.origin === 'test');
    }

    function parseTimestamp(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const ts = Date.parse(value);
        return Number.isFinite(ts) ? ts : NaN;
    }

    function startOfDay(ts) {
        const d = new Date(ts);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    // Weeks start on Monday.
    function startOfWeek(ts) {
        const d = new Date(startOfDay(ts));
        const back = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - back);
        return d.getTime();
    }

    function startOfMonth(ts) {
        const d = new Date(ts);
        return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    }

    function defaultState() {
        return {
            sources: [],
            ledger: [],
            activity: [],
            approvals: [],
            productDraft: null,
            settings: { paused: false, setupDone: false, payout: { method: '', note: '' } }
        };
    }

    function validateProductDraft(input) {
        const source = input || {};
        const title = String(source.title || '').trim();
        const description = String(source.description || '').trim();
        const content = String(source.content || '').trim();
        const price = parseMoney(source.price);
        const errors = [];
        if (title.length < 3 || title.length > 80) errors.push('Title must be 3–80 characters.');
        if (description.length < 10 || description.length > 500) errors.push('Description must be 10–500 characters.');
        if (content.length < 20 || content.length > 50000) errors.push('File content must be 20–50,000 characters.');
        if (price === null || price <= 0 || price > 999.99) errors.push('Price must be between $0.01 and $999.99.');
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'digital-product';
        return {
            valid: errors.length === 0,
            errors,
            draft: { title: title.slice(0, 80), description: description.slice(0, 500), content: content.slice(0, 50000), price, fileName: slug + '.txt' }
        };
    }

    function updateProductDraft(existing, input) {
        const checked = validateProductDraft(input);
        if (!checked.valid) return checked;
        const previous = existing || {};
        const changed = ['title', 'description', 'content', 'price'].some(key => previous[key] !== checked.draft[key]);
        return {
            valid: true,
            errors: [],
            draft: Object.assign({}, checked.draft, {
                version: (Number(previous.version) || 0) + (changed ? 1 : 0),
                approval: changed ? null : previous.approval || null
            })
        };
    }

    function setDemoProductDecision(draft, status, now) {
        if (!draft || (status !== 'approved' && status !== 'rejected') || !validateProductDraft(draft).valid) return null;
        return Object.assign({}, draft, {
            approval: { status, version: Number(draft.version) || 0, decidedAt: now || Date.now() }
        });
    }

    function isDemoProductApprovalCurrent(draft) {
        return !!(draft && validateProductDraft(draft).valid && draft.approval && draft.approval.status === 'approved' && draft.approval.version === (Number(draft.version) || 0));
    }

    function normalizeProductDraft(value) {
        if (!value || typeof value !== 'object') return null;
        const price = parseMoney(value.price);
        const title = typeof value.title === 'string' ? value.title.slice(0, 80) : '';
        const description = typeof value.description === 'string' ? value.description.slice(0, 500) : '';
        const content = typeof value.content === 'string' ? value.content.slice(0, 50000) : '';
        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'digital-product';
        const status = value.approval && (value.approval.status === 'approved' || value.approval.status === 'rejected') ? value.approval.status : '';
        const version = Number.isSafeInteger(value.version) && value.version >= 0 ? value.version : 0;
        return {
            title, description, content, price, fileName: slug + '.txt', version,
            approval: status ? { status, version: Number.isSafeInteger(value.approval.version) ? value.approval.version : -1, decidedAt: Number(value.approval.decidedAt) || 0 } : null
        };
    }

    function demoProductTemplate() {
        return {
            title: 'The Weekly Reset Planner',
            description: 'A practical, printable-friendly text planner to clear your head, choose a few priorities, and set up a calmer week.',
            content: 'THE WEEKLY RESET PLANNER\n\nA simple 20-minute check-in for a more intentional week.\n\n1. CLEAR THE DECK (5 MINUTES)\nWrite down everything competing for your attention. Circle anything that truly needs action this week.\n\nWhat is on my mind?\n- \n- \n- \n\n2. CHOOSE THREE PRIORITIES (5 MINUTES)\nPick no more than three outcomes that would make this week feel meaningful.\n\nPriority 1:\nSmallest next step:\n\nPriority 2:\nSmallest next step:\n\nPriority 3:\nSmallest next step:\n\n3. MAKE SPACE (5 MINUTES)\nOne thing I can postpone, simplify, or ask for help with:\n\nA block of time I want to protect:\n\n4. CLOSE THE WEEK (5 MINUTES)\nWhat went well?\n\nWhat did I learn?\n\nOne thing I want to remember next week:\n\nThis planner is a starting point. Adapt it to fit your own routines.',
            price: 4
        };
    }

    function computeStats(ledger, now) {
        const t = now || Date.now();
        const day = startOfDay(t), week = startOfWeek(t), month = startOfMonth(t);
        const s = { total: 0, today: 0, week: 0, month: 0, pending: 0, refunds: 0, expenses: 0, payouts: 0, net: 0, available: 0 };
        (ledger || []).forEach(e => {
            if (isTestData(e)) return;
            const amt = Number(e.amount) || 0;
            if (e.type === 'revenue' && e.status === 'confirmed') {
                s.total += amt;
                if (e.ts >= day && e.ts <= t) s.today += amt;
                if (e.ts >= week && e.ts <= t) s.week += amt;
                if (e.ts >= month && e.ts <= t) s.month += amt;
            } else if (e.type === 'refund' && e.status === 'confirmed' && e.origin === 'connector') {
                const originalTs = parseTimestamp(e.originalTs);
                const refundTs = Number.isFinite(originalTs) ? originalTs : e.ts;
                s.refunds += amt;
                s.total -= amt;
                if (refundTs >= day && refundTs <= t) s.today -= amt;
                if (refundTs >= week && refundTs <= t) s.week -= amt;
                if (refundTs >= month && refundTs <= t) s.month -= amt;
            } else if (e.type === 'revenue' && e.status === 'pending') {
                s.pending += amt;
            } else if (e.type === 'expense') {
                s.expenses += amt;
            } else if (e.type === 'payout') {
                s.payouts += amt;
            }
        });
        Object.keys(s).forEach(k => { s[k] = round2(s[k]); });
        s.net = round2(s.total - s.expenses);
        s.available = round2(s.net - s.payouts);
        return s;
    }

    function sourceSummaries(state) {
        return state.sources.map(src => {
            let revenue = 0, last = 0;
            state.ledger.forEach(e => {
                if (e.sourceId !== src.id) return;
                if (isTestData(e)) return;
                if (e.type === 'revenue' && e.status === 'confirmed') revenue += e.amount;
                else if (e.type === 'refund' && e.status === 'confirmed' && e.origin === 'connector') revenue -= e.amount;
                if (e.ts > last) last = e.ts;
            });
            state.activity.forEach(a => { if (a.sourceId === src.id && a.ts > last) last = a.ts; });
            return { id: src.id, name: src.name, type: src.type, revenue: round2(revenue), lastActivity: last || null, status: state.settings.paused ? 'paused' : src.status };
        });
    }

    function pushActivity(state, text, sourceId, ts) {
        state.activity.unshift({ ts: ts || Date.now(), text: String(text).slice(0, 300), sourceId: sourceId || null });
    }

    // Applies a connector response. Estimated/unknown-status entries are dropped so only real money is counted.
    function mergeSync(state, payload, now) {
        const t = now || Date.now();
        const result = { added: 0, ignored: 0, approvals: 0 };
        if (!payload || typeof payload !== 'object') return result;
        const payloadIsTest = isTestData(payload);
        if (payloadIsTest) {
            result.ignored = Array.isArray(payload.entries) ? payload.entries.length : 0;
            return result;
        }
        const known = new Set(state.sources.map(s => s.id));
        const seen = new Set(state.ledger.filter(e => e.externalId).map(e => e.externalId));
        (Array.isArray(payload.entries) ? payload.entries : []).forEach(e => {
            const amount = parseMoney(e && e.amount);
            const type = e && e.type;
            const status = e && e.status;
            const okStatus = status === 'confirmed' || (status === 'pending' && type === 'revenue');
            const validType = type === 'revenue' || type === 'expense' || (type === 'refund' && status === 'confirmed');
            if (!e || isTestData(e) ||
                typeof e.externalId !== 'string' || !e.externalId.trim() || seen.has(e.externalId) ||
                amount === null || !validType || !okStatus || typeof e.sourceId !== 'string' || !e.sourceId.trim() || !known.has(e.sourceId)) {
                result.ignored++;
                return;
            }
            seen.add(e.externalId);
            let ts = parseTimestamp(e.ts);
            if (!Number.isFinite(ts) || ts > t + 86400000) ts = t;
            const entry = { id: uid(), ts, sourceId: e.sourceId, type, status, amount, note: String(e.note || '').slice(0, 200), origin: 'connector', externalId: e.externalId };
            if (type === 'refund' && e.originalTs != null && e.originalTs !== '') {
                const originalTs = parseTimestamp(e.originalTs);
                if (Number.isFinite(originalTs) && originalTs <= t + 86400000) entry.originalTs = originalTs;
            }
            state.ledger.push(entry);
            result.added++;
        });
        (Array.isArray(payload.activity) ? payload.activity : []).forEach(a => {
            if (a && typeof a.text === 'string' && a.text) pushActivity(state, a.text, known.has(a.sourceId) ? a.sourceId : null, t);
        });
        const haveApprovals = new Set(state.approvals.map(a => a.id));
        (Array.isArray(payload.approvals) ? payload.approvals : []).forEach(a => {
            if (!a || typeof a.id !== 'string' || !a.id || haveApprovals.has(a.id) || typeof a.title !== 'string') return;
            haveApprovals.add(a.id);
            state.approvals.unshift({ id: a.id, title: a.title.slice(0, 160), detail: String(a.detail || '').slice(0, 400), cost: parseMoney(a.cost) || 0, status: 'pending', ts: t });
            result.approvals++;
        });
        return result;
    }

    function uid() {
        return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function formatMoney(n) {
        return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    const api = {
        parseMoney, computeStats, sourceSummaries, mergeSync, defaultState, startOfWeek, formatMoney, pushActivity,
        validateProductDraft, updateProductDraft, setDemoProductDecision, isDemoProductApprovalCurrent, demoProductTemplate
    };
    root.NovaPassiveIncome = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    /* ---------- UI ---------- */

    if (!root.document) return;
    const doc = root.document;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let modal = null;
    let timer = null;
    let view = 'dashboard';
    let notice = '';
    let returnFocus = null;

    const ICON_SVG = '<svg class="passive-income-icon" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="12" cy="12" r="9"/><path d="M14.4 9.3c-.4-.8-1.3-1.3-2.4-1.3-1.4 0-2.4.7-2.4 1.8 0 2.5 4.9 1.2 4.9 3.8 0 1.1-1.1 1.9-2.5 1.9-1.2 0-2.2-.5-2.6-1.4M12 6.5V8m0 8v1.5"/>' +
        '<path d="M19.5 2.5 17.6 6h2l-1.4 3.3" stroke-width="1.4"/></svg>';

    function loadState() {
        try {
            const raw = JSON.parse(root.localStorage.getItem(STORE_KEY));
            if (raw && typeof raw === 'object') {
                const d = defaultState();
                return {
                    sources: Array.isArray(raw.sources) ? raw.sources : d.sources,
                    ledger: Array.isArray(raw.ledger) ? raw.ledger : d.ledger,
                    activity: Array.isArray(raw.activity) ? raw.activity : d.activity,
                    approvals: Array.isArray(raw.approvals) ? raw.approvals : d.approvals,
                    productDraft: normalizeProductDraft(raw.productDraft),
                    settings: Object.assign(d.settings, raw.settings || {}, { payout: Object.assign({ method: '', note: '' }, (raw.settings || {}).payout) })
                };
            }
        } catch (e) { /* fall through to defaults */ }
        return defaultState();
    }

    function saveState(state) {
        try {
            root.localStorage.setItem(STORE_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            console.error('Could not save Passive Income data:', e);
            notice = 'Could not save changes in this browser. Check storage permissions or available space.';
            return false;
        }
    }

    function isUnlocked() {
        try { return root.localStorage.getItem(UNLOCK_KEY) === 'true'; } catch (e) { return false; }
    }

    function fmtTime(ts) {
        if (!ts) return '—';
        return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function injectStyles() {
        if (doc.getElementById('passiveIncomeStyles')) return;
        const style = doc.createElement('style');
        style.id = 'passiveIncomeStyles';
        style.textContent = `
            #passiveIncomeModal .modal-content { max-width: 820px; width: min(820px, calc(100% - 2rem)); }
            .pi-help { margin-left: auto; margin-right: .6rem; width: 2rem; height: 2rem; border-radius: 50%; border: 1px solid rgba(0,170,255,.6); background: rgba(0,170,255,.2); color: #fff; font-weight: 700; cursor: pointer; }
            .pi-steps { color: #cfe9ff; padding-left: 1.2rem; line-height: 1.5; }
            .pi-steps li { margin-bottom: .6rem; }
            .pi-inline { display: flex; flex-wrap: wrap; gap: .5rem; }
            .pi-inline input[type=text], .pi-inline select { flex: 1 1 140px; background: rgba(0,17,34,.8); color: #fff; border: 1px solid rgba(0,170,255,.35); border-radius: 8px; padding: .55rem .7rem; font: inherit; }
            .pi-start { text-align: center; border: 1px dashed rgba(0,170,255,.5); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
            .pi-start-title { font-size: 1.3rem; color: #fff; margin-bottom: .3rem; }
            .pi-src { display: flex; justify-content: space-between; align-items: center; gap: .6rem; border: 1px solid rgba(0,170,255,.25); border-radius: 10px; padding: .5rem .8rem; margin-bottom: .4rem; color: #cfe9ff; }
            .pi-src-amt { color: #7be3a8; font-weight: 600; }
            .pi-activity-line { color: #cfe9ff; font-size: .88rem; }
            .pi-details { margin-top: .6rem; color: #8fb8d6; }
            .pi-details summary { cursor: pointer; }
            .pi-total { text-align: center; margin-bottom: 1rem; }
            .pi-total-label { color: #8fb8d6; font-size: .8rem; letter-spacing: .12em; text-transform: uppercase; }
            .pi-total-value { font-size: 2.4rem; font-weight: 700; color: #7be3a8; }
            .pi-periods, .pi-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin-bottom: .8rem; }
            .pi-card { border: 1px solid rgba(0,170,255,.3); border-radius: 10px; padding: .6rem .8rem; background: rgba(0,17,34,.55); text-align: center; }
            .pi-card .k { color: #8fb8d6; font-size: .74rem; text-transform: uppercase; letter-spacing: .08em; }
            .pi-card .v { color: #fff; font-size: 1.1rem; font-weight: 600; }
            .pi-card .v.neg { color: #ffb3b3; }
            .pi-h { color: #cfe9ff; margin: 1rem 0 .4rem; font-size: 1rem; }
            .pi-table { width: 100%; border-collapse: collapse; font-size: .85rem; color: #cfe9ff; }
            .pi-table th { text-align: left; color: #8fb8d6; font-weight: 500; border-bottom: 1px solid rgba(0,170,255,.3); padding: .35rem .4rem; }
            .pi-table td { padding: .4rem; border-bottom: 1px solid rgba(0,170,255,.12); }
            .pi-empty { color: #8fb8d6; font-size: .85rem; padding: .5rem 0; }
            .pi-activity { max-height: 20vh; overflow-y: auto; border-left: 3px solid rgba(0,170,255,.5); padding-left: .8rem; color: #cfe9ff; font-size: .85rem; }
            .pi-activity div { margin-bottom: .35rem; }
            .pi-activity time { color: #8fb8d6; margin-right: .5rem; font-size: .76rem; }
            .pi-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; }
            .pi-btn { background: rgba(0,170,255,.2); border: 1px solid rgba(0,170,255,.5); color: #fff; padding: .55rem 1rem; border-radius: 10px; cursor: pointer; font: inherit; }
            .pi-btn.primary { background: linear-gradient(135deg,#0088dd,#00aaff); }
            .pi-btn.danger { border-color: rgba(255,90,90,.6); }
            .pi-btn.sm { padding: .25rem .6rem; font-size: .78rem; }
            .pi-form { display: grid; grid-template-columns: 1fr 1fr; gap: .6rem; margin-bottom: .6rem; }
            .pi-form label { display: flex; flex-direction: column; gap: .25rem; color: #cfe9ff; font-size: .82rem; }
            .pi-form input, .pi-form select { background: rgba(0,17,34,.8); color: #fff; border: 1px solid rgba(0,170,255,.35); border-radius: 8px; padding: .45rem .6rem; font: inherit; }
            .pi-note { color: #8fb8d6; font-size: .78rem; margin: .4rem 0; }
            .pi-msg { margin: .6rem 0; padding: .5rem .8rem; border-radius: 8px; background: rgba(0,170,255,.12); color: #cfe9ff; }
            .pi-shop-banner { border: 1px solid rgba(0,170,255,.45); border-left: 4px solid #00aaff; border-radius: 9px; background: rgba(0,170,255,.09); color: #d7efff; padding: .7rem .85rem; margin: .6rem 0 1rem; line-height: 1.45; }
            .pi-shop-banner strong { color: #6edaff; letter-spacing: .06em; }
            .pi-shop-stages { display: flex; flex-wrap: wrap; gap: .45rem; margin: .6rem 0 1rem; padding: 0; list-style: none; }
            .pi-shop-stages li { border: 1px solid rgba(0,170,255,.28); border-radius: 7px; color: #8fb8d6; padding: .35rem .6rem; font-size: .78rem; }
            .pi-shop-stages li[aria-current="step"] { border-color: #00aaff; color: #fff; background: rgba(0,170,255,.16); }
            .pi-shop-section { border-top: 1px solid rgba(0,170,255,.22); margin-top: 1rem; padding-top: .75rem; }
            .pi-shop-form textarea { min-height: 9rem; resize: vertical; font: inherit; line-height: 1.45; }
            .pi-shop-file { max-height: 18rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid rgba(0,170,255,.25); border-radius: 8px; background: rgba(0,17,34,.8); color: #d7efff; padding: .8rem; font: .84rem/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
            .pi-shop-listing { border: 1px solid rgba(0,170,255,.32); border-radius: 10px; padding: .8rem 1rem; background: rgba(0,17,34,.55); }
            .pi-shop-listing h3 { margin: 0 0 .4rem; color: #fff; }
            .pi-shop-price { color: #7be3a8; font-size: 1.2rem; font-weight: 700; }
            .pi-badge.draft { background: rgba(0,170,255,.16); color: #6edaff; }
            .pi-badge.approved { background: rgba(60,200,120,.2); color: #7be3a8; }
            .pi-badge.rejected { background: rgba(255,90,90,.16); color: #ffb3b3; }
            .pi-btn:focus-visible, .pi-shop-form input:focus-visible, .pi-shop-form textarea:focus-visible { outline: 2px solid #6edaff; outline-offset: 2px; }
            .pi-btn:disabled { opacity: .5; cursor: not-allowed; }
            .pi-approval { border: 1px solid rgba(255,190,60,.5); border-radius: 10px; padding: .6rem .8rem; margin-bottom: .5rem; background: rgba(255,190,60,.07); color: #ffe6b0; }
            .pi-badge { font-size: .72rem; padding: .12rem .5rem; border-radius: 999px; text-transform: uppercase; background: rgba(60,200,120,.2); color: #7be3a8; }
            .pi-badge.paused { background: rgba(160,170,190,.2); color: #c3ccd8; }
            .pi-badge.needs_approval { background: rgba(255,190,60,.2); color: #ffd98a; }
            .control-btn#passiveIncomeBtn .passive-income-icon { display: block; margin: auto; }
            #mobilePassiveIncomeBtn[hidden] { display: none; }
            @media (max-width: 640px) { .pi-form { grid-template-columns: 1fr; } .pi-periods, .pi-stats { grid-template-columns: 1fr 1fr; } .pi-shop-stages li { flex: 1 1 28%; text-align: center; } .pi-shop-file { max-height: none; overflow: visible; } }
        `;
        doc.head.appendChild(style);
    }

    function stat(k, v, neg) {
        return `<div class="pi-card"><div class="k">${k}</div><div class="v${neg ? ' neg' : ''}">${esc(v)}</div></div>`;
    }

    function renderShopEntry() {
        return `<div class="pi-shop-banner"><strong>DIGITAL PRODUCT SHOP · OFFLINE DEMO</strong><br>
            Create and review a digital-product file without connecting a store. Nothing is published and no income is earned.
            <div class="pi-actions"><button class="pi-btn primary" type="button" data-act="view" data-view="shop">Open Digital Product Shop</button></div>
        </div>`;
    }

    function renderDashboard(state) {
        const st = computeStats(state.ledger);
        const sums = sourceSummaries(state);
        const paused = state.settings.paused;
        const pendingApprovals = state.approvals.filter(a => a.status === 'pending');
        const sourceName = e => (state.sources.find(s => s.id === e.sourceId) || {}).name || e.sourceName || 'Unknown source';
        const recentTx = state.ledger.filter(e => !isTestData(e)).sort((a, b) => b.ts - a.ts);

        const approvals = pendingApprovals.length ? `<h4 class="pi-h">Needs your OK</h4>${pendingApprovals.map(a => `
            <div class="pi-approval"><strong>${esc(a.title)}</strong>${a.cost ? ' · ' + formatMoney(a.cost) : ''}<div class="pi-note">${esc(a.detail)}</div>
            <button class="pi-btn sm primary" type="button" data-act="approve" data-id="${esc(a.id)}">Approve</button>
            <button class="pi-btn sm danger" type="button" data-act="reject" data-id="${esc(a.id)}">Reject</button></div>`).join('')}` : '';

        // First-time screen: one field, one button.
        if (!state.sources.length && !state.settings.setupDone) {
            return `
                ${renderShopEntry()}
                <div class="pi-start">
                    <div class="pi-start-title">Let's get started</div>
                    <div class="pi-note">Where will your money come from? Type a name, like "My Etsy shop" or "Blog".</div>
                    <form id="piSourceForm" class="pi-inline">
                        <input type="text" name="name" required maxlength="60" placeholder="Name your first income source" aria-label="Income source name">
                        <button class="pi-btn primary" type="submit">Add</button>
                    </form>
                </div>
                <div class="pi-total"><div class="pi-total-label">Total Revenue</div><div class="pi-total-value">${formatMoney(0)}</div></div>`;
        }

        const sourceList = sums.map(s => `<div class="pi-src"><div><strong>${esc(s.name)}</strong><div class="pi-note">${s.status === 'paused' ? 'Paused' : 'Active'} · last activity ${esc(fmtTime(s.lastActivity))}</div></div><div class="pi-src-amt">${formatMoney(s.revenue)}</div></div>`).join('');

        const latest = state.activity[0];
        const activityLine = latest ? `${esc(fmtTime(latest.ts))} · ${esc(latest.text)}` : (paused ? 'Income checks are paused.' : 'No activity yet.');
        const activityRows = state.activity.map(a => `<div><time>${esc(fmtTime(a.ts))}</time>${esc(a.text)}</div>`).join('');
        const txRows = recentTx.length ? recentTx.map(e => `<tr><td>${esc(fmtTime(e.ts))}</td><td>${esc(e.type === 'payout' ? 'Payout' : (e.type === 'refund' ? 'Refund · ' : '') + sourceName(e))}</td><td>${e.type === 'revenue' ? '+' : '−'}${formatMoney(e.amount)}</td><td>${e.origin === 'connector' ? 'AI5 sync' : 'You'}${e.status === 'pending' ? ' · pending' : ''}</td></tr>`).join('')
            : '<tr><td colspan="4" class="pi-empty">No transactions yet.</td></tr>';

        const sourcePick = state.sources.length > 1
            ? `<select name="sourceId" aria-label="Source">${state.sources.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>`
            : state.sources.length ? `<input type="hidden" name="sourceId" value="${esc(state.sources[0].id)}">` : '';

        return `
            ${renderShopEntry()}
            <div class="pi-total"><div class="pi-total-label">Total Revenue</div><div class="pi-total-value">${formatMoney(st.total)}</div></div>
            <div class="pi-periods">${stat('Today', formatMoney(st.today))}${stat('This Week', formatMoney(st.week))}${stat('This Month', formatMoney(st.month))}</div>
            <div class="pi-stats">${stat('Pending', formatMoney(st.pending))}${stat('Refunds', formatMoney(st.refunds))}${stat('Expenses', formatMoney(st.expenses))}${stat('Net Profit', formatMoney(st.net), st.net < 0)}</div>
            ${approvals}
            <h4 class="pi-h">Add money</h4>
            ${state.sources.length ? `<form id="piEntryForm" class="pi-inline">
                ${sourcePick}
                <input type="text" name="amount" required inputmode="decimal" placeholder="$ amount" aria-label="Amount in USD">
                <button class="pi-btn primary" type="submit" name="type" value="revenue">Got paid</button>
                <button class="pi-btn" type="submit" name="type" value="expense">Spent</button>
            </form>` : '<div class="pi-empty">Add a source in Settings to record a transaction.</div>'}
            <h4 class="pi-h">Income Sources</h4>
            ${sourceList || '<div class="pi-empty">No sources yet.</div>'}
            <h4 class="pi-h">AI5 Activity</h4>
            <div class="pi-activity-line">${activityLine}</div>
            <details class="pi-details"><summary>See full history</summary>
                <table class="pi-table"><thead><tr><th>When</th><th>Source</th><th>Amount</th><th>From</th></tr></thead><tbody>${txRows}</tbody></table>
                <div class="pi-activity">${activityRows}</div>
            </details>
            <div class="pi-actions">
                <button class="pi-btn ${paused ? 'primary' : 'danger'}" type="button" data-act="toggle-pause">${paused ? 'RESUME INCOME MODE' : 'PAUSE INCOME MODE'}</button>
                <button class="pi-btn" type="button" data-act="view" data-view="settings">SETTINGS</button>
                <button class="pi-btn" type="button" data-act="view" data-view="payout">WITHDRAW / PAYOUT INFO</button>
            </div>`;
    }

    function renderShop(state) {
        const draft = state.productDraft;
        const approved = isDemoProductApprovalCurrent(draft);
        const rejected = draft && draft.approval && draft.approval.status === 'rejected' && draft.approval.version === (Number(draft.version) || 0);
        const decided = approved || rejected;
        const steps = `<ol class="pi-shop-stages" aria-label="Product demo stages">
            <li${!draft || view === 'shop-edit' ? ' aria-current="step"' : ''}>1 · Create</li>
            <li${draft && view === 'shop' && !decided ? ' aria-current="step"' : ''}>2 · Review</li>
            <li${draft && view === 'shop' && decided ? ' aria-current="step"' : ''}>3 · Demo decision</li>
        </ol>`;
        const banner = `<div class="pi-shop-banner" role="note"><strong>OFFLINE DEMO · NOT A STORE</strong><br>
            This workflow stays in this browser. Approval is only a demo decision—not store access or spending authorization. Nothing is published and no money is earned.
        </div>`;
        const back = `<button class="pi-btn sm" type="button" data-act="view" data-view="dashboard">&larr; Return to income dashboard</button>`;
        const connections = `<section class="pi-shop-section" aria-labelledby="piShopConnectionsTitle">
            <h4 class="pi-h" id="piShopConnectionsTitle">Connection settings</h4>
            <p class="pi-note">Store connections are unavailable in this offline demo. Never enter store passwords, API keys, or payment details here. Any future connection must use a securely authenticated backend; this browser demo does not request or store credentials.</p>
        </section>`;

        if (!draft) {
            return `${back}<h4 class="pi-h">Build a digital product</h4>${banner}${steps}
                <p class="pi-note">Create an original text-based product yourself, or start with an editable planner template. Review the real file and listing before making a demo decision.</p>
                <div class="pi-actions">
                    <button class="pi-btn primary" type="button" data-act="create-shop">Create a product</button>
                    <button class="pi-btn" type="button" data-act="template-shop">Use the planner template</button>
                </div>
                ${connections}`;
        }

        if (view === 'shop-edit') {
            return `${back}<h4 class="pi-h">Edit product draft</h4>${banner}${steps}
                <form id="piShopForm" class="pi-form pi-shop-form" novalidate>
                    <label>Product title (3–80 characters)
                        <input type="text" name="title" maxlength="80" required value="${esc(draft.title)}">
                    </label>
                    <label>Demo price in USD ($0.01–$999.99)
                        <input type="text" name="price" inputmode="decimal" maxlength="12" required value="${draft.price == null ? '' : esc(draft.price)}">
                    </label>
                    <label style="grid-column: 1 / -1;">Listing description (10–500 characters)
                        <textarea name="description" maxlength="500" required>${esc(draft.description)}</textarea>
                    </label>
                    <label style="grid-column: 1 / -1;">Text file content (20–50,000 characters)
                        <textarea name="content" maxlength="50000" required>${esc(draft.content)}</textarea>
                    </label>
                    <div class="pi-actions" style="grid-column: 1 / -1;">
                        <button class="pi-btn primary" type="submit">Save draft and review</button>
                        <button class="pi-btn" type="button" data-act="cancel-shop-edit">Cancel editing</button>
                    </div>
                </form>
                <p class="pi-note">Only plain text is saved and downloaded. Saving changes clears any previous demo decision.</p>${connections}`;
        }

        const checked = validateProductDraft(draft);
        const status = approved ? 'Approved for this demo only' : rejected ? 'Rejected for this demo' : 'Draft · not approved';
        const statusClass = approved ? 'approved' : rejected ? 'rejected' : 'draft';
        const listing = `<section class="pi-shop-section" aria-labelledby="piShopListingTitle">
            <h4 class="pi-h" id="piShopListingTitle">Listing preview <span class="pi-badge">${statusClass}</span></h4>
            <div class="pi-shop-listing"><h3>${esc(draft.title)}</h3><p>${esc(draft.description)}</p><div class="pi-shop-price">${formatMoney(draft.price)}</div>
                <p class="pi-note">Preview only · this listing is not published.</p></div>
        </section>`;
        return `${back}<h4 class="pi-h">Digital product review</h4>${banner}${steps}
            <p class="pi-msg" role="status">${esc(status)}</p>
            ${listing}
            <section class="pi-shop-section" aria-labelledby="piShopFileTitle">
                <h4 class="pi-h" id="piShopFileTitle">Product file · ${esc(draft.fileName)}</h4>
                <pre class="pi-shop-file">${esc(draft.content)}</pre>
                <div class="pi-actions"><button class="pi-btn" type="button" data-act="download-shop" ${checked.valid ? '' : 'disabled'}>Download .txt file</button></div>
            </section>
            <div class="pi-actions">
                <button class="pi-btn" type="button" data-act="edit-shop">Edit draft</button>
                <button class="pi-btn primary" type="button" data-act="approve-shop" ${checked.valid ? '' : 'disabled'}>Approve this demo draft</button>
                <button class="pi-btn danger" type="button" data-act="reject-shop" ${checked.valid ? '' : 'disabled'}>Reject this demo draft</button>
            </div>
            <p class="pi-note">This decision is stored locally for this draft only. It never calls real-connector approval, changes revenue, or grants store access.</p>
            ${connections}`;
    }

    function renderSettings(state) {
        const srcRows = state.sources.length ? state.sources.map(s => `<div class="pi-src"><strong>${esc(s.name)}</strong><button class="pi-btn sm danger" type="button" data-act="remove-source" data-id="${esc(s.id)}">Remove</button></div>`).join('')
            : '<div class="pi-empty">No sources yet.</div>';
        return `
            <button class="pi-btn sm" type="button" data-act="view" data-view="dashboard">&larr; Back</button>
            <h4 class="pi-h">Your income sources</h4>
            ${srcRows}
            <h4 class="pi-h">Add another</h4>
            <form id="piSourceForm" class="pi-inline">
                <input type="text" name="name" required maxlength="60" placeholder="e.g. My Etsy shop" aria-label="Income source name">
                <button class="pi-btn primary" type="submit">Add</button>
            </form>
            <div class="pi-note">AI5 only works with sources you add. It always asks before spending money, touching a financial account or signing anything.</div>`;
    }

    function renderPayout(state) {
        const st = computeStats(state.ledger);
        const p = state.settings.payout;
        return `
            <button class="pi-btn sm" type="button" data-act="view" data-view="dashboard">&larr; Back</button>
            <h4 class="pi-h">Withdraw / Payout Info</h4>
            <div class="pi-stats">${stat('Available', formatMoney(st.available), st.available < 0)}${stat('Paid out', formatMoney(st.payouts))}${stat('Pending', formatMoney(st.pending))}</div>
            <div class="pi-note">AI5 never moves money on its own. Withdrawals happen in your own payout account; record them here to keep your balance accurate.</div>
            <form id="piPayoutForm" class="pi-form">
                <label>Payout method<select name="method">${['', 'Bank transfer', 'PayPal', 'Stripe', 'Other'].map(m => `<option ${p.method === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
                <label>Note (do not enter account numbers)<input type="text" name="note" maxlength="120" value="${esc(p.note)}"></label>
                <div><button class="pi-btn primary" type="submit">Save payout info</button></div>
            </form>
            <h4 class="pi-h">Record a payout you made</h4>
            <form id="piPaidForm" class="pi-form">
                <label>Amount (USD)<input type="text" name="amount" required inputmode="decimal" placeholder="0.00"></label>
                <div><button class="pi-btn" type="submit">Record payout</button></div>
            </form>`;
    }

    function renderHelp() {
        return `
            <button class="pi-btn sm" type="button" data-act="view" data-view="dashboard">&larr; Back</button>
            <h4 class="pi-h">How it works (4 easy steps)</h4>
            <ol class="pi-steps">
                <li><strong>Add a source.</strong> Type a name for where your money comes from, like an Etsy shop, a blog, or a freelance gig, then tap <em>Add</em>.</li>
                <li><strong>Check for earnings.</strong> When a connector is available, AI5 checks for new earnings every 15 minutes while the mode is on. No connector is built in yet, so enter earnings yourself. Tap <em>PAUSE INCOME MODE</em> to stop checking.</li>
                <li><strong>Approve big decisions.</strong> If AI5 wants to spend money, use a financial account, or sign anything, it asks you first under "Needs your approval". It never does these on its own.</li>
                <li><strong>Check your money.</strong> Come back here to see revenue, expenses and net profit, and where each dollar came from. Got paid outside AI5? Type the amount under "Add money" and tap <em>Got paid</em> (or <em>Spent</em> for costs).</li>
            </ol>
            <div class="pi-note"><strong>Good to know:</strong> Only confirmed money counts as revenue. Pending money shows separately, and estimates are never counted. To cash out, use <em>WITHDRAW / PAYOUT INFO</em>. AI5 never moves money for you.</div>
            <div class="pi-actions"><button class="pi-btn primary" type="button" data-act="view" data-view="dashboard">Got it, take me to the dashboard</button></div>`;
    }

    function render(preserveInput) {
        if (!modal) return;
        const state = loadState();
        const body = modal.querySelector('#piBody');
        const form = preserveInput && body.querySelector('#piEntryForm, #piSourceForm, #piShopForm');
        const values = form ? Array.from(form.elements).filter(el => el.name && el.type !== 'submit').map(el => [el.name, el.value]) : [];
        const focused = form && form.contains(doc.activeElement) ? doc.activeElement.name : null;
        const selectionStart = focused && doc.activeElement.selectionStart;
        const selectionEnd = focused && doc.activeElement.selectionEnd;
        const historyOpen = preserveInput && body.querySelector('.pi-details') && body.querySelector('.pi-details').open;
        const content = modal.querySelector('.modal-content');
        const scrollTop = content.scrollTop;
        const html = view === 'help' ? renderHelp() : view === 'settings' ? renderSettings(state) : view === 'payout' ? renderPayout(state) :
            view === 'shop' || view === 'shop-edit' ? renderShop(state) : renderDashboard(state);
        body.innerHTML = (notice ? `<div class="pi-msg" role="status">${esc(notice)}</div>` : '') + html;
        if (form) {
            const replacement = body.querySelector('#' + form.id);
            if (replacement) {
                values.forEach(([name, value]) => { if (replacement.elements[name]) replacement.elements[name].value = value; });
                if (focused && replacement.elements[focused]) {
                    const input = replacement.elements[focused];
                    input.focus({ preventScroll: true });
                    if (selectionStart !== null && input.setSelectionRange) input.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
        if (historyOpen && body.querySelector('.pi-details')) body.querySelector('.pi-details').open = true;
        if (preserveInput) content.scrollTop = scrollTop;
        if (modal.classList.contains('active')) {
            if (!preserveInput) focusDialogTarget();
            else if (!modal.contains(doc.activeElement)) focusDialogTarget();
        }
        notice = '';
    }

    function focusDialogTarget() {
        const target = modal.querySelector('#piBody h4, #piBody .pi-start-title') || modal.querySelector('#closePassiveIncome');
        if (!target) return;
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    }

    function trapDialogFocus(e) {
        if (!modal || !modal.classList.contains('active') || e.key !== 'Tab') return;
        const focusable = Array.from(modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) {
            e.preventDefault();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const currentIndex = focusable.indexOf(doc.activeElement);
        if (e.shiftKey && currentIndex <= 0) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && (currentIndex === -1 || currentIndex === focusable.length - 1)) {
            e.preventDefault();
            first.focus();
        }
    }

    function mutate(fn) {
        const state = loadState();
        fn(state);
        return saveState(state);
    }

    function downloadProductFile() {
        const draft = loadState().productDraft;
        const checked = validateProductDraft(draft);
        if (!checked.valid) { notice = 'Save a valid draft before downloading its file.'; render(); return; }
        try {
            const blob = new root.Blob([checked.draft.content], { type: 'text/plain;charset=utf-8' });
            const url = root.URL.createObjectURL(blob);
            const link = doc.createElement('a');
            link.href = url;
            link.download = checked.draft.fileName;
            link.hidden = true;
            doc.body.appendChild(link);
            link.click();
            link.remove();
            root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
            notice = 'Downloaded the reviewed text file. Nothing was published.';
        } catch (e) {
            notice = 'This browser could not create the download. Your saved draft is still available for review.';
        }
        render();
    }

    function onAction(e) {
        const el = e.target.closest('[data-act]');
        if (!el) return;
        const act = el.dataset.act;
        if (act === 'view') { view = el.dataset.view; }
        else if (act === 'create-shop') {
            if (!mutate(s => { s.productDraft = { title: '', description: '', content: '', price: null, fileName: 'digital-product.txt', version: 0, approval: null }; })) { render(); return; }
            view = 'shop-edit';
            notice = '';
        } else if (act === 'template-shop') {
            const template = updateProductDraft(null, demoProductTemplate());
            if (!template.valid || !mutate(s => { s.productDraft = template.draft; })) { render(); return; }
            view = 'shop-edit';
            notice = 'Editable template created locally. Review and save your draft.';
        } else if (act === 'edit-shop') {
            if (!mutate(s => {
                if (s.productDraft) {
                    s.productDraft.approval = null;
                    s.productDraft.version = (Number(s.productDraft.version) || 0) + 1;
                }
            })) { render(); return; }
            view = 'shop-edit';
            notice = 'Editing invalidated the previous demo decision.';
        } else if (act === 'cancel-shop-edit') {
            if (!mutate(s => {
                const draft = s.productDraft;
                if (draft && !validateProductDraft(draft).valid && !draft.title && !draft.description && !draft.content && draft.price == null) s.productDraft = null;
            })) { render(); return; }
            view = 'shop';
            notice = '';
        } else if (act === 'approve-shop' || act === 'reject-shop') {
            const status = act === 'approve-shop' ? 'approved' : 'rejected';
            const currentDraft = loadState().productDraft;
            if (!currentDraft || !validateProductDraft(currentDraft).valid) {
                notice = 'Save a valid draft before making a demo decision.';
                render();
                return;
            }
            if (!mutate(s => { s.productDraft = setDemoProductDecision(s.productDraft, status); })) { render(); return; }
            notice = status === 'approved'
                ? 'Demo draft approved locally. It was not published and no income was earned.'
                : 'Demo draft rejected locally. No listing was published.';
            view = 'shop';
        } else if (act === 'download-shop') {
            downloadProductFile();
            return;
        }
        else if (act === 'toggle-pause') {
            if (!mutate(s => {
                s.settings.paused = !s.settings.paused;
                pushActivity(s, s.settings.paused ? 'Income mode paused by you.' : 'Income mode resumed by you.');
            })) { render(); return; }
            applySchedule();
        } else if (act === 'remove-source') {
            if (!mutate(s => {
                const src = s.sources.find(x => x.id === el.dataset.id);
                if (src) s.ledger.forEach(entry => { if (entry.sourceId === src.id) entry.sourceName = src.name; });
                s.sources = s.sources.filter(x => x.id !== el.dataset.id);
                if (src) pushActivity(s, `Removed source "${src.name}". Its past transactions are kept.`);
            })) { render(); return; }
            applySchedule();
        } else if (act === 'approve' || act === 'reject') {
            let approved = false;
            if (!mutate(s => {
                const a = s.approvals.find(x => x.id === el.dataset.id);
                if (!a || a.status !== 'pending') return;
                a.status = act === 'approve' ? 'approved' : 'rejected';
                approved = act === 'approve';
                pushActivity(s, `You ${a.status} "${a.title}".`);
            })) { render(); return; }
            if (approved) syncNow(el.dataset.id);
        }
        render();
    }

    function onSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const data = Object.fromEntries(new FormData(form).entries());
        if (e.submitter && e.submitter.name === 'type') data.type = e.submitter.value;
        if (form.id === 'piSourceForm') {
            const name = String(data.name || '').trim();
            if (!name) return;
            if (!mutate(s => {
                s.sources.push({ id: uid(), name: name.slice(0, 60), type: 'Other', status: 'active', createdAt: Date.now() });
                s.settings.setupDone = true;
                pushActivity(s, `Added income source "${name}".`);
            })) { render(); return; }
            notice = 'Source added.';
            applySchedule();
        } else if (form.id === 'piShopForm') {
            const result = updateProductDraft(loadState().productDraft, data);
            if (!result.valid) {
                notice = result.errors.join(' ');
                render(true);
                return;
            }
            if (!mutate(s => { s.productDraft = result.draft; })) { render(true); return; }
            view = 'shop';
            notice = 'Draft saved locally for review. Nothing was published.';
        } else if (form.id === 'piEntryForm') {
            const amount = parseMoney(data.amount);
            if (amount === null || amount <= 0) { notice = 'Enter a valid amount.'; render(); return; }
            if (!loadState().sources.some(x => x.id === data.sourceId)) { notice = 'That source is no longer available.'; render(); return; }
            if (!mutate(s => {
                const isPending = data.type === 'pending';
                s.ledger.push({ id: uid(), ts: Date.now(), sourceId: data.sourceId, type: isPending ? 'revenue' : data.type, status: isPending ? 'pending' : 'confirmed', amount, note: String(data.note || '').slice(0, 120), origin: 'manual' });
                pushActivity(s, `You recorded ${formatMoney(amount)} ${isPending ? 'pending revenue' : data.type}.`, data.sourceId);
            })) { render(); return; }
            notice = 'Transaction recorded.';
        } else if (form.id === 'piPayoutForm') {
            if (!mutate(s => { s.settings.payout = { method: String(data.method || ''), note: String(data.note || '').slice(0, 120) }; })) { render(); return; }
            notice = 'Payout info saved.';
        } else if (form.id === 'piPaidForm') {
            const amount = parseMoney(data.amount);
            if (amount === null || amount <= 0) { notice = 'Enter a valid amount.'; render(); return; }
            if (!mutate(s => {
                s.ledger.push({ id: uid(), ts: Date.now(), sourceId: null, type: 'payout', status: 'confirmed', amount, note: '', origin: 'manual' });
                pushActivity(s, `You recorded a ${formatMoney(amount)} payout.`);
            })) { render(); return; }
            notice = 'Payout recorded.';
        }
        render();
    }

    function buildModal() {
        modal = doc.createElement('div');
        modal.className = 'modal';
        modal.id = 'passiveIncomeModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'passiveIncomeTitle');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header"><h3 id="passiveIncomeTitle">💰 Passive Income</h3>
                    <button class="pi-help" id="piHelpBtn" type="button" data-act="view" data-view="help" title="How does this work?" aria-label="How does this work?">?</button>
                    <button class="modal-close" id="closePassiveIncome" type="button" title="Close">&times;</button></div>
                <div class="modal-body" id="piBody"></div>
            </div>`;
        doc.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); else onAction(e); });
        modal.addEventListener('submit', onSubmit);
        modal.querySelector('#closePassiveIncome').addEventListener('click', closeModal);
        doc.addEventListener('keydown', e => {
            if (!modal.classList.contains('active')) return;
            if (e.key === 'Escape') closeModal();
            else trapDialogFocus(e);
        });
    }

    // Asks the connector for new confirmed earnings. Without one, nothing is recorded and AI5 says so.
    async function syncNow(approvedId) {
        const state = loadState();
        if (state.settings.paused || !state.sources.length) return;
        let note = null;
        try {
            const res = await root.fetch(SYNC_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sources: state.sources.map(s => ({ id: s.id, name: s.name, type: s.type })), approvedActionId: approvedId || null })
            });
            if (!res.ok) note = 'No income connector is available yet, so no revenue was recorded.';
            else {
                const payload = await res.json();
                mutate(s => {
                    const r = mergeSync(s, payload);
                    pushActivity(s, `Sync complete: ${r.added} new transaction(s), ${r.approvals} approval request(s).`);
                });
            }
        } catch (e) {
            note = 'Could not reach the income connector, so no revenue was recorded.';
        }
        if (note) mutate(s => {
            const last = s.activity[0];
            if (!last || last.text !== note) pushActivity(s, note);
        });
        if (modal && modal.classList.contains('active') && view === 'dashboard') render(true);
    }

    function applySchedule() {
        if (timer) { clearInterval(timer); timer = null; }
        const state = loadState();
        if (isUnlocked() && !state.settings.paused && state.sources.length) {
            timer = setInterval(syncNow, SYNC_INTERVAL_MS);
        }
    }

    function openModal() {
        if (!modal) buildModal();
        returnFocus = doc.activeElement;
        const state = loadState();
        view = 'dashboard';
        notice = '';
        render();
        modal.classList.add('active');
        focusDialogTarget();
        syncNow();
    }

    function closeModal() {
        if (modal) modal.classList.remove('active');
        if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') returnFocus.focus();
        returnFocus = null;
    }

    function injectButton() {
        const controls = doc.querySelector('.chat-controls');
        if (!controls || doc.getElementById('passiveIncomeBtn')) return;
        const btn = doc.createElement('button');
        btn.className = 'control-btn';
        btn.id = 'passiveIncomeBtn';
        btn.type = 'button';
        btn.title = 'Passive Income';
        btn.setAttribute('aria-label', 'Passive Income');
        btn.innerHTML = ICON_SVG;
        btn.addEventListener('click', openModal);
        controls.insertBefore(btn, controls.firstChild);
    }

    function syncVisibility() {
        const unlocked = isUnlocked();
        if (unlocked) injectButton();
        else {
            const btn = doc.getElementById('passiveIncomeBtn');
            if (btn) btn.remove();
            closeModal();
        }
        const mobileBtn = doc.getElementById('mobilePassiveIncomeBtn');
        if (mobileBtn) mobileBtn.hidden = !unlocked;
        applySchedule();
    }

    function init() {
        injectStyles();
        if (root.NovaSecrets) root.NovaSecrets.register(UNLOCK_PASSWORD, () => {
            try { root.localStorage.setItem(UNLOCK_KEY, String(!isUnlocked())); } catch (e) { /* storage blocked */ }
            syncVisibility();
        });
        syncVisibility();
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);
