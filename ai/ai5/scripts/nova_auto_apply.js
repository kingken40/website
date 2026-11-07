/* ========================================
   N.O.V.A AUTO-APPLY
   Profile-driven job matching, strict filtering, duplicate protection and application tracking.
======================================== */
(function (root) {
    'use strict';

    const PROFILE_KEY = 'nova_auto_apply_profile_v1';
    const TRACKER_KEY = 'nova_auto_apply_tracker_v1';
    const ENABLED_KEY = 'nova_auto_apply_enabled_v1';
    const UNLOCK_KEY = 'nova_auto_apply_unlocked_v1';
    const UNLOCK_PASSWORD = 'apply';
    const RUN_INTERVAL_MS = 30 * 60 * 1000;
    const MAX_RESUME_BYTES = 2 * 1024 * 1024;
    const SUBMIT_ENDPOINT = '/api/auto-apply/submit';

    const STATUS = { APPLIED: 'applied', SKIPPED: 'skipped', FAILED: 'failed', NEEDS_INPUT: 'needs_input' };

    const EXPERIENCE_LEVELS = [
        { id: 'internship', label: 'Internship', pattern: /\b(intern|internship|co-?op)\b/i },
        { id: 'entry', label: 'Entry level', pattern: /\b(entry[- ]level|junior|jr\.?|graduate|new grad|associate)\b/i },
        { id: 'mid', label: 'Mid level', pattern: /\b(mid[- ]level|intermediate|level ii|\bii\b)\b/i },
        { id: 'senior', label: 'Senior', pattern: /\b(senior|sr\.?|staff|level iii|\biii\b)\b/i },
        { id: 'lead', label: 'Lead / Principal', pattern: /\b(lead|principal|architect|head of|manager)\b/i },
        { id: 'executive', label: 'Director / Executive', pattern: /\b(director|vp|vice president|chief|cto|ceo)\b/i }
    ];
    const WORK_TYPES = ['remote', 'hybrid', 'onsite'];
    const EMPLOYMENT_TYPES = [
        { id: 'full_time', label: 'Full-time', pattern: /\bfull[- _]?time\b/i },
        { id: 'part_time', label: 'Part-time', pattern: /\bpart[- _]?time\b/i },
        { id: 'contract', label: 'Contract', pattern: /\b(contract|contractor|freelance)\b/i },
        { id: 'internship', label: 'Internship', pattern: /\b(intern|internship)\b/i },
        { id: 'temporary', label: 'Temporary', pattern: /\b(temporary|temp)\b/i }
    ];
    const JOB_SITES = [
        { id: 'remotive', label: 'Remotive (remote jobs)' },
        { id: 'arbeitnow', label: 'Arbeitnow' }
    ];

    // Questions matching these are never answered unless the user saved an answer for that exact question.
    const SENSITIVE_QUESTION = /\b(ssn|social security|date of birth|birth ?date|\bdob\b|gender|race|ethnic|veteran|disabilit|sexual orientation|religio|citizenship|work authori[sz]ation|authori[sz]ed to work|visa|sponsorship|security clearance|criminal|convicted|salary expectation|desired salary|expected salary|current salary|compensation|references?|pronouns|marital|passport|driver'?s licen[sc]e)\b/i;

    const DEFAULT_PROFILE = {
        jobTitles: '',
        location: '',
        experienceLevels: [],
        workTypes: [],
        salaryMin: '',
        salaryMax: '',
        allowUnlistedSalary: false,
        employmentTypes: [],
        keywords: '',
        exclusions: '',
        site: 'remotive',
        maxPerRun: 10,
        fullName: '',
        email: '',
        phone: '',
        resume: null,
        answers: {}
    };

    /* ---------- pure helpers ---------- */

    function normalize(text) {
        return String(text || '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-z0-9+#.\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function splitList(text) {
        return String(text || '').split(/[,\n;]/).map(s => s.trim()).filter(Boolean);
    }

    function containsTerm(haystack, term) {
        const h = ' ' + normalize(haystack) + ' ';
        const t = normalize(term);
        return !!t && h.includes(' ' + t + ' ');
    }

    function containsAllWords(haystack, term) {
        const words = normalize(term).split(' ').filter(Boolean);
        const h = ' ' + normalize(haystack) + ' ';
        return words.length > 0 && words.every(w => h.includes(' ' + w + ' ') || h.includes(' ' + w + 's '));
    }

    function parseSalaryRange(text) {
        const raw = String(text || '').toLowerCase();
        if (!/\d/.test(raw)) return null;
        const hourly = /(\/\s*h(ou)?r|per hour|hourly)/.test(raw);
        const nums = [];
        const re = /(\d[\d,]*(?:\.\d+)?)\s*(k)?/g;
        let m;
        while ((m = re.exec(raw))) {
            let value = parseFloat(m[1].replace(/,/g, ''));
            if (m[2]) value *= 1000;
            if (value >= (hourly ? 7 : 1000)) nums.push(value);
        }
        if (!nums.length) return null;
        const scale = hourly ? 2080 : 1;
        return { min: Math.min(...nums) * scale, max: Math.max(...nums) * scale };
    }

    function inferExperience(job) {
        const title = job.title || '';
        for (let i = EXPERIENCE_LEVELS.length - 1; i >= 0; i--) {
            if (EXPERIENCE_LEVELS[i].pattern.test(title)) return EXPERIENCE_LEVELS[i].id;
        }
        const years = /(\d+)\s*\+?\s*(?:years|yrs)/i.exec(job.description || '');
        if (years) {
            const y = parseInt(years[1], 10);
            if (y <= 1) return 'entry';
            if (y <= 4) return 'mid';
            if (y <= 8) return 'senior';
            return 'lead';
        }
        return null;
    }

    function inferWorkType(job) {
        const text = [job.title, job.location, job.workTypeText].join(' ');
        if (job.remote === true || /\bremote\b|work from home|anywhere/i.test(text)) return 'remote';
        if (/\bhybrid\b/i.test(text)) return 'hybrid';
        if (job.remote === false || /\bon-?site\b|\bin[- ]office\b/i.test(text)) return 'onsite';
        return null;
    }

    function inferEmploymentType(job) {
        const text = [(job.employmentTypes || []).join(' '), job.title].join(' ');
        const found = EMPLOYMENT_TYPES.filter(t => t.pattern.test(text)).map(t => t.id);
        return found.length ? found : null;
    }

    // Pulls contact details out of resume text; only fills what it can find with confidence.
    function extractResumeInfo(text) {
        const raw = String(text || '');
        const email = (raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [''])[0];
        const phone = (raw.match(/(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/) || [''])[0].trim();
        const firstLines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 5);
        const nameLine = firstLines.find(l => /^[A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){1,3}$/.test(l) && l.length <= 40 && !/resume|curriculum|vitae/i.test(l));
        return { email, phone, fullName: nameLine || '' };
    }

    function isProfileComplete(profile) {
        const missing = [];
        if (!splitList(profile.jobTitles).length) missing.push('job title');
        if (!String(profile.fullName || '').trim()) missing.push('full name');
        if (!/^\S+@\S+\.\S+$/.test(String(profile.email || '').trim())) missing.push('valid email');
        if (!profile.resume || !profile.resume.dataBase64) missing.push('resume');
        return { complete: missing.length === 0, missing };
    }

    // Returns { match: boolean, reason: string }. Anything that cannot be verified against a set filter is rejected.
    function evaluateJob(job, profile) {
        const titles = splitList(profile.jobTitles);
        if (titles.length && !titles.some(t => containsAllWords(job.title, t))) {
            return { match: false, reason: 'Title does not match' };
        }

        const exclusions = splitList(profile.exclusions);
        const searchable = [job.title, job.company, job.description].join(' ');
        const hit = exclusions.find(x => containsTerm(searchable, x));
        if (hit) return { match: false, reason: `Contains excluded term "${hit}"` };

        const keywords = splitList(profile.keywords);
        if (keywords.length && !keywords.some(k => containsTerm(searchable, k))) {
            return { match: false, reason: 'No keyword matched' };
        }

        const workType = inferWorkType(job);
        if (profile.workTypes.length) {
            if (!workType) return { match: false, reason: 'Work type could not be verified' };
            if (!profile.workTypes.includes(workType)) return { match: false, reason: `Work type is ${workType}` };
        }

        const locations = splitList(profile.location);
        if (locations.length) {
            const remoteOkay = workType === 'remote' && profile.workTypes.includes('remote');
            const locationText = job.location || '';
            if (!remoteOkay && !locations.some(l => containsTerm(locationText, l))) {
                return { match: false, reason: 'Location does not match' };
            }
        }

        if (profile.experienceLevels.length) {
            const level = inferExperience(job);
            if (!level) return { match: false, reason: 'Experience level could not be verified' };
            if (!profile.experienceLevels.includes(level)) return { match: false, reason: `Experience level is ${level}` };
        }

        if (profile.employmentTypes.length) {
            const types = inferEmploymentType(job);
            if (!types) return { match: false, reason: 'Employment type could not be verified' };
            if (!types.some(t => profile.employmentTypes.includes(t))) return { match: false, reason: 'Employment type does not match' };
        }

        const minWanted = parseFloat(profile.salaryMin) || 0;
        const maxWanted = parseFloat(profile.salaryMax) || 0;
        if (minWanted || maxWanted) {
            const range = parseSalaryRange(job.salary);
            if (!range) {
                if (!profile.allowUnlistedSalary) return { match: false, reason: 'Salary not listed' };
            } else {
                if (minWanted && range.max < minWanted) return { match: false, reason: 'Salary below minimum' };
                if (maxWanted && range.min > maxWanted) return { match: false, reason: 'Salary above maximum' };
            }
        }

        return { match: true, reason: 'Matches profile' };
    }

    function jobKeys(job) {
        const keys = [];
        if (job.source && job.id) keys.push(`id:${job.source}:${job.id}`);
        if (job.url) keys.push('url:' + String(job.url).split('?')[0].replace(/\/+$/, '').toLowerCase());
        keys.push(`co:${normalize(job.company)}|${normalize(job.title)}|${normalize(job.location)}`);
        return keys;
    }

    function findDuplicate(job, entries) {
        const keys = new Set(jobKeys(job));
        return entries.find(e => (e.keys || []).some(k => keys.has(k))) || null;
    }

    function classifyQuestion(question, answers) {
        const key = normalize(question.label);
        const saved = answers && answers[key];
        if (saved) return { action: 'answer', value: saved };
        if (SENSITIVE_QUESTION.test(question.label)) return { action: 'ask', reason: 'sensitive' };
        return { action: 'ask', reason: 'unknown' };
    }

    /* ---------- storage ---------- */

    function load(key, fallback) {
        try {
            const raw = root.localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function save(key, value) {
        try {
            root.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Auto-Apply: could not save', key, e);
            return false;
        }
    }

    function loadProfile() {
        return Object.assign({}, DEFAULT_PROFILE, load(PROFILE_KEY, {}));
    }

    function loadTracker() {
        const entries = load(TRACKER_KEY, []);
        return Array.isArray(entries) ? entries : [];
    }

    function recordEntry(job, status, detail, extra) {
        const entries = loadTracker();
        const keys = jobKeys(job);
        const existing = entries.find(e => e.keys.some(k => keys.includes(k)));
        const entry = Object.assign(existing || { keys, addedAt: Date.now() }, {
            keys: existing ? Array.from(new Set(existing.keys.concat(keys))) : keys,
            title: job.title, company: job.company, location: job.location, url: job.url,
            source: job.source, job, status, detail: detail || '', updatedAt: Date.now()
        }, extra || {});
        if (!existing) entries.unshift(entry);
        save(TRACKER_KEY, entries.slice(0, 500));
        return entry;
    }

    /* ---------- job sources ---------- */

    async function fetchJson(url) {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Job source returned ${response.status}`);
        return response.json();
    }

    const sourceFetchers = {
        async remotive(profile) {
            const term = splitList(profile.jobTitles)[0] || '';
            const data = await fetchJson(`https://remotive.com/api/remote-jobs?limit=100&search=${encodeURIComponent(term)}`);
            return (data.jobs || []).map(j => ({
                source: 'remotive', id: String(j.id), url: j.url, title: j.title, company: j.company_name,
                location: j.candidate_required_location || '', remote: true, salary: j.salary || '',
                employmentTypes: j.job_type ? [j.job_type] : [], description: j.description || ''
            }));
        },
        async arbeitnow() {
            const data = await fetchJson('https://www.arbeitnow.com/api/job-board-api');
            return (data.data || []).map(j => ({
                source: 'arbeitnow', id: String(j.slug), url: j.url, title: j.title, company: j.company_name,
                location: j.location || '', remote: j.remote === true ? true : undefined, salary: '',
                employmentTypes: j.job_types || [], description: j.description || ''
            }));
        }
    };

    /* ---------- submission ---------- */

    // The browser cannot submit to third-party career sites itself, so submission goes to a local connector.
    async function submitApplication(job, profile, answers) {
        let response;
        try {
            response = await fetch(SUBMIT_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job,
                    applicant: { fullName: profile.fullName, email: profile.email, phone: profile.phone },
                    resume: profile.resume,
                    answers
                })
            });
        } catch (error) {
            return { status: STATUS.FAILED, error: 'Application connector unreachable' };
        }
        if (response.status === 404 || response.status === 501) {
            return { status: STATUS.NEEDS_INPUT, manual: true, error: 'No application connector is configured. Apply manually using the job link.' };
        }
        if (!response.ok) return { status: STATUS.FAILED, error: `Connector error ${response.status}` };
        try {
            return await response.json();
        } catch (error) {
            return { status: STATUS.FAILED, error: 'Connector returned an invalid response' };
        }
    }

    async function processJob(job, profile, submit) {
        const outcome = await (submit || submitApplication)(job, profile, profile.answers || {});
        if (outcome.status === STATUS.APPLIED) {
            return recordEntry(job, STATUS.APPLIED, 'Application submitted', { questions: null, manual: false });
        }
        if (outcome.status === STATUS.NEEDS_INPUT) {
            const questions = (outcome.questions || []).map(q => ({
                label: q.label, id: q.id || normalize(q.label), reason: classifyQuestion(q, {}).reason
            }));
            return recordEntry(job, STATUS.NEEDS_INPUT, outcome.error || 'Waiting for your answers', { questions, manual: !!outcome.manual });
        }
        return recordEntry(job, STATUS.FAILED, outcome.error || 'Submission failed', { questions: null });
    }

    let running = false;

    async function runOnce(options) {
        const opts = options || {};
        const summary = { found: 0, applied: 0, skipped: 0, failed: 0, needsInput: 0, duplicates: 0, error: '' };
        if (running) return Object.assign(summary, { error: 'A run is already in progress' });
        const profile = loadProfile();
        const check = isProfileComplete(profile);
        if (!check.complete) return Object.assign(summary, { error: `Profile incomplete: ${check.missing.join(', ')}` });

        running = true;
        try {
            const fetcher = (opts.fetchers || sourceFetchers)[profile.site];
            if (!fetcher) throw new Error('Selected job site is not supported');
            const jobs = await fetcher(profile);
            summary.found = jobs.length;
            let attempts = 0;
            const cap = Math.max(1, parseInt(profile.maxPerRun, 10) || 10);

            for (const job of jobs) {
                if (findDuplicate(job, loadTracker())) { summary.duplicates++; continue; }
                const verdict = evaluateJob(job, profile);
                if (!verdict.match) {
                    recordEntry(job, STATUS.SKIPPED, verdict.reason);
                    summary.skipped++;
                    continue;
                }
                if (attempts >= cap) continue;
                attempts++;
                const entry = await processJob(job, profile, opts.submit);
                if (entry.status === STATUS.APPLIED) summary.applied++;
                else if (entry.status === STATUS.NEEDS_INPUT) summary.needsInput++;
                else summary.failed++;
            }
        } catch (error) {
            summary.error = error.message || String(error);
        } finally {
            running = false;
        }
        return summary;
    }

    async function retryWithAnswers(entryKey, newAnswers, opts) {
        const profile = loadProfile();
        profile.answers = Object.assign({}, profile.answers);
        Object.keys(newAnswers).forEach(label => {
            const value = String(newAnswers[label] || '').trim();
            if (value) profile.answers[normalize(label)] = value;
        });
        save(PROFILE_KEY, profile);
        const entry = loadTracker().find(e => e.keys.includes(entryKey));
        if (!entry) return null;
        return processJob(entry.job, profile, opts && opts.submit);
    }

    const api = {
        STATUS, EXPERIENCE_LEVELS, WORK_TYPES, EMPLOYMENT_TYPES, JOB_SITES,
        evaluateJob, parseSalaryRange, jobKeys, findDuplicate, classifyQuestion, isProfileComplete,
        extractResumeInfo, normalize, splitList, runOnce, processJob, retryWithAnswers, recordEntry,
        loadProfile, loadTracker, saveProfile: p => save(PROFILE_KEY, p),
        saveTracker: t => save(TRACKER_KEY, t), DEFAULT_PROFILE, RUN_INTERVAL_MS
    };
    root.NovaAutoApply = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;

    /* ---------- UI ---------- */

    if (!root.document) return;
    const doc = root.document;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    let timer = null;
    let modal = null;

    const ICON_SVG = '<svg class="auto-apply-icon" viewBox="0 0 24 24" width="1.15em" height="1.15em" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>' +
        '<rect x="3" y="7" width="18" height="13" rx="2.5"/>' +
        '<path d="M13.2 9.6 9.6 14.2h2.5l-.9 3.6 3.7-4.7h-2.6z" fill="currentColor" stroke-width="1"/></svg>';

    function injectStyles() {
        if (doc.getElementById('autoApplyStyles')) return;
        const style = doc.createElement('style');
        style.id = 'autoApplyStyles';
        style.textContent = `
            #autoApplyModal .modal-content { max-width: 860px; width: min(860px, calc(100% - 2rem)); }
            .aa-tabs { display: flex; gap: .5rem; margin-bottom: 1rem; }
            .aa-tab { background: rgba(0,170,255,.08); border: 1px solid rgba(0,170,255,.3); color: #9ed8ff; padding: .45rem .9rem; border-radius: 10px; cursor: pointer; }
            .aa-tab.active { background: rgba(0,170,255,.25); color: #fff; }
            .aa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .8rem 1rem; }
            .aa-field { display: flex; flex-direction: column; gap: .3rem; color: #cfe9ff; font-size: .85rem; }
            .aa-field.full { grid-column: 1 / -1; }
            .aa-field input[type=text], .aa-field input[type=number], .aa-field input[type=email], .aa-field select, .aa-field textarea {
                background: rgba(0,17,34,.8); color: #fff; border: 1px solid rgba(0,170,255,.35); border-radius: 8px; padding: .5rem .6rem; font: inherit; }
            .aa-checks { display: flex; flex-wrap: wrap; gap: .4rem .9rem; }
            .aa-checks label { display: inline-flex; align-items: center; gap: .35rem; }
            .aa-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; align-items: center; }
            .aa-btn { background: rgba(0,170,255,.2); border: 1px solid rgba(0,170,255,.5); color: #fff; padding: .55rem 1rem; border-radius: 10px; cursor: pointer; }
            .aa-btn.primary { background: linear-gradient(135deg,#0088dd,#00aaff); }
            .aa-btn.danger { border-color: rgba(255,90,90,.6); }
            .aa-btn:disabled { opacity: .5; cursor: not-allowed; }
            .aa-note { font-size: .78rem; color: #8fb8d6; }
            .aa-msg { margin-top: .8rem; padding: .6rem .8rem; border-radius: 8px; background: rgba(0,170,255,.1); color: #cfe9ff; display: none; }
            .aa-msg.show { display: block; }
            .aa-msg.error { background: rgba(255,80,80,.15); color: #ffb3b3; }
            .aa-counts { display: flex; flex-wrap: wrap; gap: .5rem; margin-bottom: .8rem; }
            .aa-count { padding: .25rem .7rem; border-radius: 999px; border: 1px solid rgba(0,170,255,.4); color: #cfe9ff; font-size: .8rem; }
            .aa-list { display: flex; flex-direction: column; gap: .5rem; max-height: 44vh; overflow-y: auto; }
            .aa-row { border: 1px solid rgba(0,170,255,.25); border-radius: 10px; padding: .6rem .8rem; background: rgba(0,17,34,.55); }
            .aa-row-head { display: flex; justify-content: space-between; gap: .6rem; }
            .aa-row-title { color: #fff; font-weight: 600; }
            .aa-row-meta { color: #8fb8d6; font-size: .78rem; }
            .aa-badge { font-size: .72rem; padding: .15rem .55rem; border-radius: 999px; text-transform: uppercase; white-space: nowrap; align-self: flex-start; }
            .aa-badge.applied { background: rgba(60,200,120,.2); color: #7be3a8; }
            .aa-badge.skipped { background: rgba(160,170,190,.2); color: #c3ccd8; }
            .aa-badge.failed { background: rgba(255,80,80,.2); color: #ffb3b3; }
            .aa-badge.needs_input { background: rgba(255,190,60,.2); color: #ffd98a; }
            .aa-q { margin-top: .5rem; display: flex; flex-direction: column; gap: .3rem; }
            .aa-q input { background: rgba(0,17,34,.8); color: #fff; border: 1px solid rgba(255,190,60,.5); border-radius: 8px; padding: .4rem .6rem; }
            .control-btn#autoApplyBtn .auto-apply-icon { display: block; margin: auto; }
            #mobileAutoApplyBtn[hidden] { display: none; }
            @media (max-width: 640px) { .aa-grid { grid-template-columns: 1fr; } }
        `;
        doc.head.appendChild(style);
    }

    function checkGroup(name, options, selected) {
        return `<div class="aa-checks">${options.map(o => {
            const id = typeof o === 'string' ? o : o.id;
            const label = typeof o === 'string' ? o.charAt(0).toUpperCase() + o.slice(1) : o.label;
            return `<label><input type="checkbox" data-group="${name}" value="${esc(id)}" ${selected.includes(id) ? 'checked' : ''}> ${esc(label)}</label>`;
        }).join('')}</div>`;
    }

    function buildModal() {
        modal = doc.createElement('div');
        modal.className = 'modal';
        modal.id = 'autoApplyModal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'autoApplyTitle');
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="autoApplyTitle">Auto-Apply</h3>
                    <button class="modal-close" id="closeAutoApply" type="button" title="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="aa-tabs">
                        <button class="aa-tab active" type="button" data-tab="profile">Application Profile</button>
                        <button class="aa-tab" type="button" data-tab="tracker">Applications</button>
                    </div>
                    <div id="aaProfileTab"></div>
                    <div id="aaTrackerTab" style="display:none"></div>
                    <div class="aa-msg" id="aaMessage" role="status"></div>
                </div>
            </div>`;
        doc.body.appendChild(modal);

        modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
        modal.querySelector('#closeAutoApply').addEventListener('click', closeModal);
        modal.querySelectorAll('.aa-tab').forEach(tab => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
        doc.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });
    }

    function showMessage(text, isError) {
        const el = modal.querySelector('#aaMessage');
        el.textContent = text || '';
        el.classList.toggle('show', !!text);
        el.classList.toggle('error', !!isError);
    }

    function showTab(name) {
        modal.querySelectorAll('.aa-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        modal.querySelector('#aaProfileTab').style.display = name === 'profile' ? '' : 'none';
        modal.querySelector('#aaTrackerTab').style.display = name === 'tracker' ? '' : 'none';
        if (name === 'tracker') renderTracker();
    }

    function renderProfile() {
        const p = loadProfile();
        const enabled = load(ENABLED_KEY, false);
        modal.querySelector('#aaProfileTab').innerHTML = `
            <div class="aa-grid">
                <label class="aa-field full">Job titles (comma separated)
                    <input type="text" id="aaTitles" value="${esc(p.jobTitles)}" placeholder="e.g. Software Engineer, Backend Developer"></label>
                <label class="aa-field">Location(s)
                    <input type="text" id="aaLocation" value="${esc(p.location)}" placeholder="e.g. Denver, Colorado, United States"></label>
                <label class="aa-field">Job site
                    <select id="aaSite">${JOB_SITES.map(s => `<option value="${s.id}" ${p.site === s.id ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></label>
                <div class="aa-field full">Experience level (leave empty for any)
                    ${checkGroup('experienceLevels', EXPERIENCE_LEVELS, p.experienceLevels)}</div>
                <div class="aa-field">Work type (leave empty for any)
                    ${checkGroup('workTypes', WORK_TYPES, p.workTypes)}</div>
                <div class="aa-field">Employment type (leave empty for any)
                    ${checkGroup('employmentTypes', EMPLOYMENT_TYPES, p.employmentTypes)}</div>
                <label class="aa-field">Salary minimum (annual)
                    <input type="number" id="aaSalaryMin" min="0" step="1000" value="${esc(p.salaryMin)}"></label>
                <label class="aa-field">Salary maximum (annual)
                    <input type="number" id="aaSalaryMax" min="0" step="1000" value="${esc(p.salaryMax)}"></label>
                <label class="aa-checks full" style="grid-column:1/-1"><span><input type="checkbox" id="aaUnlisted" ${p.allowUnlistedSalary ? 'checked' : ''}> Also apply when a job does not list a salary</span></label>
                <label class="aa-field">Keywords (at least one must appear)
                    <input type="text" id="aaKeywords" value="${esc(p.keywords)}" placeholder="python, react"></label>
                <label class="aa-field">Exclusions (never apply if present)
                    <input type="text" id="aaExclusions" value="${esc(p.exclusions)}" placeholder="clearance, unpaid, commission"></label>
                <label class="aa-field">Full name
                    <input type="text" id="aaName" value="${esc(p.fullName)}" autocomplete="name"></label>
                <label class="aa-field">Email
                    <input type="email" id="aaEmail" value="${esc(p.email)}" autocomplete="email"></label>
                <label class="aa-field">Phone
                    <input type="text" id="aaPhone" value="${esc(p.phone)}" autocomplete="tel"></label>
                <label class="aa-field">Max applications per run
                    <input type="number" id="aaMax" min="1" max="50" value="${esc(p.maxPerRun)}"></label>
                <div class="aa-field full" id="aaResumeBox">Resume (PDF, Word or text, up to 2 MB)
                    ${p.resume
                        ? `<div class="aa-actions" style="margin:0"><span>Saved: <strong>${esc(p.resume.name)}</strong></span>
                           <button class="aa-btn danger" type="button" id="aaResumeRemove">Remove resume</button>
                           <button class="aa-btn" type="button" id="aaResumeReplace">Replace</button></div>`
                        : '<span class="aa-note" style="color:#ffd98a">Upload your resume to get started. It is saved in this browser, so you only need to do this once.</span>'}
                    <input type="file" id="aaResume" accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain" ${p.resume ? 'style="display:none"' : ''}>
                    <span class="aa-note" id="aaResumeInfo"></span></div>
            </div>
            <p class="aa-note">Jobs that don't match every filter you set are skipped, never applied to. Questions the profile can't answer, and sensitive questions (work authorization, demographics, salary expectations, etc.), pause for your input instead of being guessed.</p>
            <div class="aa-actions">
                <button class="aa-btn primary" type="button" id="aaSave">Save Profile</button>
                <button class="aa-btn" type="button" id="aaRun">Run Now</button>
                <button class="aa-btn ${enabled ? 'danger' : ''}" type="button" id="aaToggle">${enabled ? 'Stop Auto-Apply' : 'Start Auto-Apply'}</button>
                <span class="aa-note">${enabled ? 'Running every 30 minutes while this page is open.' : 'Not running.'}</span>
            </div>`;

        modal.querySelector('#aaSave').addEventListener('click', () => { if (collectProfile()) showMessage('Profile saved.'); });
        modal.querySelector('#aaRun').addEventListener('click', handleRun);
        modal.querySelector('#aaToggle').addEventListener('click', handleToggle);
        modal.querySelector('#aaResume').addEventListener('change', handleResume);
        const remove = modal.querySelector('#aaResumeRemove');
        if (remove) remove.addEventListener('click', handleResumeRemove);
        const replace = modal.querySelector('#aaResumeReplace');
        if (replace) replace.addEventListener('click', () => modal.querySelector('#aaResume').click());
        if (!p.resume) modal.querySelector('#aaResumeBox').scrollIntoView({ block: 'nearest' });
    }

    function handleResumeRemove() {
        if (!root.confirm('Remove your saved resume? You will need to upload one again before applying.')) return;
        const profile = collectProfile();
        if (!profile) return;
        profile.resume = null;
        save(PROFILE_KEY, profile);
        renderProfile();
        showMessage('Resume removed.');
    }

    async function readResumeText(file, base64) {
        try {
            if (/\.txt$/i.test(file.name) || file.type === 'text/plain') return atob(base64);
            if ((/\.pdf$/i.test(file.name) || file.type === 'application/pdf') && root.pdfjsLib) {
                const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
                const pdf = await root.pdfjsLib.getDocument({ data: bytes }).promise;
                let text = '';
                for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
                    const content = await (await pdf.getPage(i)).getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                return text;
            }
        } catch (error) {
            console.warn('Auto-Apply: could not read resume text', error);
        }
        return '';
    }

    function collectProfile() {
        const val = id => modal.querySelector('#' + id).value.trim();
        const group = name => Array.from(modal.querySelectorAll(`input[data-group="${name}"]:checked`)).map(i => i.value);
        const current = loadProfile();
        const profile = Object.assign({}, current, {
            jobTitles: val('aaTitles'), location: val('aaLocation'), site: val('aaSite'),
            experienceLevels: group('experienceLevels'), workTypes: group('workTypes'), employmentTypes: group('employmentTypes'),
            salaryMin: val('aaSalaryMin'), salaryMax: val('aaSalaryMax'),
            allowUnlistedSalary: modal.querySelector('#aaUnlisted').checked,
            keywords: val('aaKeywords'), exclusions: val('aaExclusions'),
            fullName: val('aaName'), email: val('aaEmail'), phone: val('aaPhone'),
            maxPerRun: Math.min(50, Math.max(1, parseInt(val('aaMax'), 10) || 10))
        });
        if (!save(PROFILE_KEY, profile)) {
            showMessage('Could not save the profile (browser storage is full or blocked).', true);
            return null;
        }
        return profile;
    }

    function handleResume(e) {
        const file = e.target.files && e.target.files[0];
        const info = modal.querySelector('#aaResumeInfo');
        if (!file) return;
        if (file.size > MAX_RESUME_BYTES) {
            info.textContent = 'That file is larger than 2 MB.';
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
            const result = String(reader.result || '');
            const dataBase64 = result.slice(result.indexOf(',') + 1);
            info.textContent = 'Reading resume...';
            const text = await readResumeText(file, dataBase64);
            const found = extractResumeInfo(text);
            const profile = collectProfile();
            if (!profile) return;
            // Resume details only fill fields the user has not already entered
            const filled = [];
            [['fullName', 'name'], ['email', 'email'], ['phone', 'phone']].forEach(([field, label]) => {
                if (!profile[field] && found[field]) { profile[field] = found[field]; filled.push(label); }
            });
            profile.resume = { name: file.name, type: file.type || 'application/octet-stream', size: file.size, dataBase64, text: text.slice(0, 20000) };
            if (!save(PROFILE_KEY, profile)) {
                showMessage('Could not save the resume (browser storage is full or blocked).', true);
                return;
            }
            renderProfile();
            showMessage(`Resume saved.${filled.length ? ' Filled in your ' + filled.join(', ') + ' from it.' : ''}${text ? '' : ' Its contents could not be read, so check your name, email and phone.'}`);
        };
        reader.onerror = () => { info.textContent = 'Could not read that file.'; };
        reader.readAsDataURL(file);
    }

    async function handleRun() {
        const profile = collectProfile();
        if (!profile) return;
        if (!profile.resume) return showMessage('Please upload your resume first.', true);
        const btn = modal.querySelector('#aaRun');
        btn.disabled = true;
        showMessage('Searching for matching jobs...');
        const s = await runOnce();
        btn.disabled = false;
        if (s.error) return showMessage(s.error, true);
        showMessage(`Found ${s.found}: ${s.applied} applied, ${s.needsInput} need input, ${s.failed} failed, ${s.skipped} skipped, ${s.duplicates} already handled.`);
        updateButtonState();
    }

    function handleToggle() {
        const enabled = !load(ENABLED_KEY, false);
        if (enabled) {
            const profile = collectProfile();
            if (!profile) return;
            const check = isProfileComplete(profile);
            if (!check.complete) return showMessage(`Add your ${check.missing.join(', ')} first.`, true);
        }
        save(ENABLED_KEY, enabled);
        applySchedule();
        renderProfile();
        if (enabled) handleRun();
    }

    function applySchedule() {
        if (timer) { clearInterval(timer); timer = null; }
        const enabled = load(ENABLED_KEY, false);
        if (enabled && isUnlocked()) timer = setInterval(() => runOnce().then(updateButtonState), RUN_INTERVAL_MS);
        updateButtonState();
    }

    function updateButtonState() {
        const btn = doc.getElementById('autoApplyBtn');
        if (!btn) return;
        const enabled = load(ENABLED_KEY, false);
        const waiting = loadTracker().filter(e => e.status === STATUS.NEEDS_INPUT).length;
        btn.classList.toggle('active', enabled);
        btn.setAttribute('aria-pressed', String(enabled));
        btn.title = 'Auto-Apply: automatically apply to jobs that match your profile' + (waiting ? ` (${waiting} waiting for your input)` : '');
    }

    function renderTracker() {
        const entries = loadTracker();
        const count = s => entries.filter(e => e.status === s).length;
        const holder = modal.querySelector('#aaTrackerTab');
        holder.innerHTML = `
            <div class="aa-counts">
                <span class="aa-count">Applied: ${count(STATUS.APPLIED)}</span>
                <span class="aa-count">Needs input: ${count(STATUS.NEEDS_INPUT)}</span>
                <span class="aa-count">Failed: ${count(STATUS.FAILED)}</span>
                <span class="aa-count">Skipped: ${count(STATUS.SKIPPED)}</span>
            </div>
            <div class="aa-actions" style="margin-top:0;margin-bottom:.6rem">
                <select id="aaFilter" class="aa-btn"><option value="all">All</option>
                    ${Object.values(STATUS).map(s => `<option value="${s}">${s.replace('_', ' ')}</option>`).join('')}</select>
                <button class="aa-btn danger" type="button" id="aaClear">Clear history</button>
            </div>
            <div class="aa-list" id="aaList"></div>`;
        const renderList = () => {
            const filter = holder.querySelector('#aaFilter').value;
            const rows = entries.filter(e => filter === 'all' || e.status === filter);
            holder.querySelector('#aaList').innerHTML = rows.length ? rows.map((e, i) => rowHtml(e, i)).join('') : '<p class="aa-note">No jobs here yet.</p>';
        };
        holder.querySelector('#aaFilter').addEventListener('change', renderList);
        holder.querySelector('#aaClear').addEventListener('click', () => {
            if (!root.confirm('Clear all tracked jobs? Cleared jobs may be applied to again.')) return;
            save(TRACKER_KEY, []);
            renderTracker();
            updateButtonState();
        });
        holder.querySelector('#aaList').addEventListener('click', handleRowAction);
        renderList();
    }

    function rowHtml(e) {
        const key = esc(e.keys[0]);
        const link = e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer" style="color:#7fd0ff">Open job</a>` : '';
        let questions = '';
        if (e.status === STATUS.NEEDS_INPUT && e.questions && e.questions.length) {
            questions = `<div class="aa-q">${e.questions.map(q => `
                <label class="aa-row-meta">${esc(q.label)} ${q.reason === 'sensitive' ? '(sensitive, never guessed)' : ''}
                <input type="text" data-question="${esc(q.label)}"></label>`).join('')}
                <div><button class="aa-btn primary" type="button" data-action="retry" data-key="${key}">Save answers &amp; retry</button></div></div>`;
        }
        const manual = e.status === STATUS.NEEDS_INPUT && e.manual
            ? `<div><button class="aa-btn" type="button" data-action="done" data-key="${key}">I applied manually</button></div>` : '';
        return `<div class="aa-row" data-key="${key}">
            <div class="aa-row-head"><div><div class="aa-row-title">${esc(e.title)}</div>
            <div class="aa-row-meta">${esc(e.company)} · ${esc(e.location || 'Location n/a')} · ${link}</div></div>
            <span class="aa-badge ${esc(e.status)}">${esc(e.status.replace('_', ' '))}</span></div>
            <div class="aa-row-meta">${esc(e.detail)}</div>${questions}${manual}</div>`;
    }

    async function handleRowAction(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const key = btn.dataset.key;
        if (btn.dataset.action === 'done') {
            const entries = loadTracker();
            const entry = entries.find(x => x.keys.includes(key));
            if (entry) { entry.status = STATUS.APPLIED; entry.detail = 'Marked as applied by you'; entry.manual = false; save(TRACKER_KEY, entries); }
        } else if (btn.dataset.action === 'retry') {
            const answers = {};
            btn.closest('.aa-row').querySelectorAll('input[data-question]').forEach(i => { answers[i.dataset.question] = i.value; });
            btn.disabled = true;
            await retryWithAnswers(key, answers);
        }
        renderTracker();
        updateButtonState();
    }

    function openModal() {
        if (!modal) buildModal();
        renderProfile();
        showMessage(loadProfile().resume ? '' : 'Please upload your resume to use Auto-Apply.');
        showTab('profile');
        modal.classList.add('active');
    }

    function closeModal() {
        if (modal) modal.classList.remove('active');
    }

    function injectButton() {
        const controls = doc.querySelector('.chat-controls');
        if (!controls || doc.getElementById('autoApplyBtn')) return;
        const btn = doc.createElement('button');
        btn.className = 'control-btn';
        btn.id = 'autoApplyBtn';
        btn.type = 'button';
        btn.setAttribute('aria-label', 'Auto-Apply');
        btn.setAttribute('aria-pressed', 'false');
        btn.innerHTML = ICON_SVG;
        btn.addEventListener('click', openModal);
        // Passive Income, when unlocked, stays left-most.
        const first = controls.firstElementChild;
        controls.insertBefore(btn, first && first.id === 'passiveIncomeBtn' ? first.nextSibling : controls.firstChild);
    }

    function isUnlocked() {
        return load(UNLOCK_KEY, false) === true;
    }

    // Shows or hides every Auto-Apply entry point to match the saved unlock state.
    function syncVisibility() {
        const unlocked = isUnlocked();
        if (unlocked) injectButton();
        else {
            const btn = doc.getElementById('autoApplyBtn');
            if (btn) btn.remove();
            closeModal();
        }
        const mobileBtn = doc.getElementById('mobileAutoApplyBtn');
        if (mobileBtn) mobileBtn.hidden = !unlocked;
        applySchedule();
    }

    function init() {
        injectStyles();
        // The shared secret gate owns the 3-click trigger; the same password toggles the feature off again.
        if (root.NovaSecrets) root.NovaSecrets.register(UNLOCK_PASSWORD, () => {
            save(UNLOCK_KEY, !isUnlocked());
            syncVisibility();
        });
        syncVisibility();
    }

    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
    else init();
})(typeof window !== 'undefined' ? window : globalThis);
