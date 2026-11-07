const assert = require('assert');
global.localStorage = (() => { let s = {}; return { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, clear: () => { s = {}; } }; })();
const A = require('../scripts/nova_auto_apply.js');
const base = () => Object.assign({}, A.DEFAULT_PROFILE, { jobTitles: 'Software Engineer', fullName: 'Ann Lee', email: 'a@b.co', resume: { name: 'r.pdf', dataBase64: 'AA==' }, answers: {} });
const job = (o) => Object.assign({ source: 'remotive', id: '1', url: 'https://x.com/j/1?utm=1', title: 'Senior Software Engineer', company: 'Acme', location: 'USA', remote: true, salary: '$120k - $150k', employmentTypes: ['full_time'], description: 'Python and React role' }, o);

// filters
let p = base();
assert(A.evaluateJob(job(), p).match);
assert(!A.evaluateJob(job({ title: 'Product Designer' }), p).match);
p = Object.assign(base(), { exclusions: 'react' }); assert(!A.evaluateJob(job(), p).match);
p = Object.assign(base(), { keywords: 'golang' }); assert(!A.evaluateJob(job(), p).match);
p = Object.assign(base(), { keywords: 'python' }); assert(A.evaluateJob(job(), p).match);
p = Object.assign(base(), { experienceLevels: ['entry'] }); assert(!A.evaluateJob(job(), p).match);
p = Object.assign(base(), { experienceLevels: ['senior'] }); assert(A.evaluateJob(job(), p).match);
p = Object.assign(base(), { experienceLevels: ['mid'] }); assert(!A.evaluateJob(job({ title: 'Software Engineer', description: 'no info' }), p).match, 'unverifiable experience rejected');
p = Object.assign(base(), { workTypes: ['onsite'] }); assert(!A.evaluateJob(job(), p).match);
p = Object.assign(base(), { workTypes: ['remote'] }); assert(A.evaluateJob(job(), p).match);
p = Object.assign(base(), { location: 'Denver', workTypes: [] }); assert(!A.evaluateJob(job({ remote: false, location: 'Austin, TX' }), p).match);
p = Object.assign(base(), { location: 'Austin' }); assert(A.evaluateJob(job({ remote: false, location: 'Austin, TX' }), p).match);
p = Object.assign(base(), { salaryMin: '160000' }); assert(!A.evaluateJob(job(), p).match);
p = Object.assign(base(), { salaryMin: '100000' }); assert(A.evaluateJob(job(), p).match);
p = Object.assign(base(), { salaryMin: '100000' }); assert(!A.evaluateJob(job({ salary: '' }), p).match, 'unlisted salary rejected');
p = Object.assign(base(), { salaryMin: '100000', allowUnlistedSalary: true }); assert(A.evaluateJob(job({ salary: '' }), p).match);
p = Object.assign(base(), { employmentTypes: ['contract'] }); assert(!A.evaluateJob(job(), p).match);
assert.deepStrictEqual(A.parseSalaryRange('$50/hr'), { min: 104000, max: 104000 });

// resume info
const info = A.extractResumeInfo('Ann Lee\nann.lee@mail.com | (303) 555-1234\nEngineer');
assert.strictEqual(info.email, 'ann.lee@mail.com'); assert.strictEqual(info.fullName, 'Ann Lee'); assert(info.phone.includes('555'));

// questions
assert.strictEqual(A.classifyQuestion({ label: 'Are you authorized to work in the US?' }, {}).reason, 'sensitive');
assert.strictEqual(A.classifyQuestion({ label: 'Favorite color?' }, {}).action, 'ask');
assert.strictEqual(A.classifyQuestion({ label: 'Favorite color?' }, { 'favorite color': 'blue' }).action, 'answer');

(async () => {
  const fetchers = { remotive: async () => [job({ id: '1' }), job({ id: '2', title: 'Chef', url: 'https://x.com/j/2' }), job({ id: '3', url: 'https://x.com/j/3', company: 'B' }), job({ id: '4', url: 'https://x.com/j/4', company: 'C' })] };
  A.saveProfile(Object.assign(base(), { site: 'remotive' }));
  let submitted = [];
  const submit = async (j) => {
    submitted.push(j.id);
    if (j.id === '3') return { status: 'needs_input', questions: [{ label: 'Are you a veteran?' }] };
    if (j.id === '4') return { status: 'failed', error: 'boom' };
    return { status: 'applied' };
  };
  let s = await A.runOnce({ fetchers, submit });
  assert.deepStrictEqual([s.applied, s.skipped, s.needsInput, s.failed], [1, 1, 1, 1], JSON.stringify(s));
  assert(!submitted.includes('2'), 'filtered job must never be submitted');
  const t = A.loadTracker();
  assert.strictEqual(t.find(e => e.job.id === '3').questions[0].reason, 'sensitive');

  // duplicates: second run submits nothing new
  submitted = [];
  s = await A.runOnce({ fetchers, submit });
  assert.strictEqual(submitted.length, 0); assert.strictEqual(s.duplicates, 4);
  // same job on a different URL/id is still a duplicate by company+title+location
  assert(A.findDuplicate(job({ id: '99', url: 'https://other.com/zzz' }), A.loadTracker()));

  // incomplete profile blocks
  A.saveProfile(Object.assign(base(), { resume: null }));
  s = await A.runOnce({ fetchers, submit }); assert(/resume/.test(s.error));

  // retry with answer saves it and re-submits
  A.saveProfile(base());
  const key = A.loadTracker().find(e => e.job.id === '3').keys[0];
  let seen; const r = await A.retryWithAnswers(key, { 'Are you a veteran?': 'No' }, { submit: async (j, pr, ans) => { seen = ans; return { status: 'applied' }; } });
  assert.strictEqual(r.status, 'applied'); assert.strictEqual(seen['are you a veteran'], 'No');
  console.log('ALL PASS');
})().catch(e => { console.error(e); process.exit(1); });
