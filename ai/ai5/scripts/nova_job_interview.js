// Job Interview mode: job-link intake (Indeed, LinkedIn, Handshake), confirmation/correction,
// and saved jobs with progress. Jobs persist in localStorage.
(function () {
    const JOBS_KEY = 'nova_interview_jobs';
    const ACTIVE_KEY = 'nova_interview_active_job';
    const MAX_JOBS = 50;
    const MAX_TRANSCRIPT = 300;
    const INTERVIEW_TYPES = ['behavioral', 'technical', 'coding', 'general'];
    const SOURCE_NAMES = { indeed: 'Indeed', linkedin: 'LinkedIn', handshake: 'Handshake' };
    const JOB_URL_RE = /https?:\/\/(?:[\w-]+\.)*(?:indeed\.com|linkedin\.com|joinhandshake\.com)\/[^\s<>"')]*/i;
    const CONFIRM_RE = /^\s*(?:yes|yep|yeah|yup|y|correct|right|confirm(?:ed)?|ok(?:ay)?|sure|start|go|begin|looks (?:good|right|correct)|that'?s (?:right|correct)|let'?s (?:go|start|begin))[\s,.!]*$/i;
    const END_RE = /\b(?:end|finish|wrap up|stop) (?:the |this )?interview\b|\boverall (?:summary|assessment)\b|\bi'?m (?:done|finished)\b|\bgive me (?:my |the )?(?:summary|results|assessment)\b/i;

    let suppressNextUserRecord = false;

    function loadJobs() {
        try {
            const jobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
            return Array.isArray(jobs) ? jobs : [];
        } catch (error) {
            return [];
        }
    }

    function saveJobs(jobs) {
        const sorted = jobs.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, MAX_JOBS);
        try {
            localStorage.setItem(JOBS_KEY, JSON.stringify(sorted));
        } catch (error) {
            console.warn('Could not save interview jobs:', error);
        }
    }

    function getActiveJob() {
        const id = localStorage.getItem(ACTIVE_KEY);
        return id ? loadJobs().find(job => job.id === id) || null : null;
    }

    function setActiveJob(job) {
        if (job) localStorage.setItem(ACTIVE_KEY, job.id);
        else localStorage.removeItem(ACTIVE_KEY);
    }

    function updateJob(job) {
        job.updatedAt = Date.now();
        const jobs = loadJobs().filter(item => item.id !== job.id);
        jobs.push(job);
        saveJobs(jobs);
    }

    function detectSource(url) {
        if (/indeed\.com/i.test(url)) return 'indeed';
        if (/linkedin\.com/i.test(url)) return 'linkedin';
        return 'handshake';
    }

    function jobKeyFromUrl(url) {
        const source = detectSource(url);
        let id = null;
        if (source === 'indeed') id = (url.match(/[?&](?:jk|vjk)=([\w]+)/i) || [])[1];
        else if (source === 'linkedin') id = (url.match(/\/jobs\/view\/(?:[^/?]*-)?(\d+)/i) || url.match(/currentJobId=(\d+)/i) || [])[1];
        else id = (url.match(/\/jobs\/(\d+)/i) || [])[1];
        return id ? `${source}:${id}` : `${source}:${url.split('#')[0]}`;
    }

    function isInterviewMode() {
        return typeof currentPersonality !== 'undefined' && currentPersonality === 'interview';
    }

    function parseJsonReply(reply) {
        const text = String(reply || '').replace(/```(?:json)?/gi, '');
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch (error) {
            return null;
        }
    }

    async function askModelForJson(prompt, maxTokens) {
        const result = await generateAIResponse(prompt, 'Nova', {
            assistant: 'nova',
            skipUserHistory: true,
            proactiveEvaluation: true,
            rawTask: true,
            maxTokens: maxTokens || 700
        });
        return parseJsonReply(result && result.reply);
    }

    function cleanString(value, max) {
        if (value === null || value === undefined) return null;
        const text = String(value).replace(/\s+/g, ' ').trim();
        if (!text || /^(null|unknown|n\/a|none)$/i.test(text)) return null;
        return text.slice(0, max || 200);
    }

    function normalizeType(value) {
        const type = String(value || '').toLowerCase().trim();
        return INTERVIEW_TYPES.includes(type) ? type : null;
    }

    function applyUpdates(job, updates) {
        if (!updates || typeof updates !== 'object') return;
        const title = cleanString(updates.title, 150);
        const company = cleanString(updates.company, 150);
        const location = cleanString(updates.location, 150);
        const summary = cleanString(updates.summary, 900);
        const type = normalizeType(updates.interviewType);
        if (title) job.title = title;
        if (company) job.company = company;
        if (location) job.location = location;
        if (summary) job.summary = summary;
        if (type) job.interviewType = type;
        if (typeof updates.isTech === 'boolean') job.isTech = updates.isTech;
        if (Array.isArray(updates.requirements)) {
            const reqs = updates.requirements.map(item => cleanString(item, 120)).filter(Boolean).slice(0, 8);
            if (reqs.length) job.requirements = reqs;
        }
    }

    function formatConfirmation(job, intro) {
        const missing = '_not found - please tell me_';
        const lines = [
            intro,
            '',
            `- **Job title:** ${job.title || missing}`,
            `- **Company:** ${job.company || missing}`,
            `- **Location:** ${job.location || missing}`,
            `- **Tech job:** ${job.isTech ? 'Yes' : 'No'}`,
            `- **Interview type:** ${job.interviewType || missing}`
        ];
        if (job.summary) lines.push(`- **About the role:** ${job.summary}`);
        lines.push('', 'Is this information correct? Say "yes" to start the interview, or tell me what to fix (for example "the interview type should be behavioral" or "the company is Acme").');
        return lines.join('\n');
    }

    function say(reply) {
        addMessage(reply, 'Nova');
        conversationHistory.push({ role: 'assistant', speaker: 'Nova', content: reply, personality: currentPersonality, timestamp: new Date().toISOString() });
        if (typeof speakAssistantResponse === 'function' && window.speakText) {
            speakAssistantResponse(reply, 'Nova', () => {});
        }
    }

    async function runTask(userText, task) {
        if (typeof isResponseInFlight !== 'undefined' && isResponseInFlight) {
            if (typeof showNotification === 'function') showNotification('N.O.V.A is still responding. Please wait.', 2500);
            return;
        }
        isResponseInFlight = true;
        updateContinuationButtonState?.();
        addMessage(userText, 'user');
        conversationHistory.push({ role: 'user', content: userText, personality: currentPersonality, timestamp: new Date().toISOString() });
        const input = document.getElementById('messageInput');
        if (input) {
            input.value = '';
            input.style.height = 'auto';
        }
        addThinkingIndicator('Nova');
        let outcome = null;
        try {
            outcome = await task();
        } catch (error) {
            console.error('Job interview task failed:', error);
            outcome = { reply: 'I could not process that job just now. Please try again, or type the job title, company, and interview type directly.' };
        } finally {
            removeThinkingIndicator();
            isResponseInFlight = false;
            updateContinuationButtonState?.();
        }
        if (outcome && outcome.reply) say(outcome.reply);
        if (outcome && outcome.start) startInterview(outcome.start, '');
    }

    function startInterview(kind, displayText) {
        suppressNextUserRecord = displayText !== '';
        const kickoff = kind === 'resume'
            ? 'Resume my saved mock interview. Briefly recap where we left off (topics covered and how I did so far), then continue with the next NEW question without repeating any question already asked.'
            : 'The job details are confirmed. Begin the mock interview now: greet me briefly as the interviewer, mention the role and company, and ask your first question.';
        processUserMessage(kickoff, displayText === null ? '' : displayText);
    }

    async function handleLink(userText, url) {
        const key = jobKeyFromUrl(url);
        const existing = loadJobs().find(job => job.key === key);
        if (existing) {
            setActiveJob(existing);
            if (existing.status === 'pending') {
                return { reply: formatConfirmation(existing, `I already have this ${SOURCE_NAMES[existing.source]} job saved but you haven't confirmed it yet:`) };
            }
            existing.status = 'active';
            updateJob(existing);
            return { start: 'resume' };
        }

        const source = detectSource(url);
        const page = typeof _jinaFetch === 'function' ? await _jinaFetch(url) : null;
        const job = {
            id: `job_${Date.now().toString(36)}`,
            key,
            url,
            source,
            title: null,
            company: null,
            location: null,
            isTech: false,
            interviewType: null,
            summary: null,
            requirements: [],
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            answers: 0,
            questions: [],
            transcript: []
        };

        const prompt = `Extract job posting details from the page below.
Source URL: ${url}
PAGE TEXT (may be empty, partial, or a login wall):
${page || '(could not be read)'}

Return ONLY a JSON object with these keys:
"title" (string or null), "company" (string or null), "location" (string or null),
"isTech" (boolean: true for software, IT, data, engineering, or other technical roles),
"interviewType" (one of "behavioral", "technical", "coding", "general"; use "coding" for software engineering roles, "technical" for other technical roles, "behavioral" for non-technical roles),
"summary" (string, at most 70 words describing the role),
"requirements" (array of up to 8 short strings).
Use null for anything unknown. Never invent details; if the page could not be read, infer only what the URL itself shows.`;
        const extracted = await askModelForJson(prompt, 800);
        applyUpdates(job, extracted);
        if (!job.interviewType) job.interviewType = job.isTech ? 'technical' : 'behavioral';

        updateJob(job);
        setActiveJob(job);
        const unreadable = !page || !extracted ? ' (I could not read the whole page, so some fields may be missing)' : '';
        return { reply: formatConfirmation(job, `I looked at your ${SOURCE_NAMES[source]} link${unreadable}. Here is what I found:`) };
    }

    async function handlePendingCorrection(job, userText) {
        const prompt = `A user is confirming details extracted from a job posting.
Current details (JSON): ${JSON.stringify({ title: job.title, company: job.company, location: job.location, isTech: job.isTech, interviewType: job.interviewType, summary: job.summary })}
User reply: "${userText}"

Return ONLY a JSON object: {"action": "confirm" | "correct" | "cancel" | "other", "updates": {"title": string|null, "company": string|null, "location": string|null, "isTech": boolean|null, "interviewType": "behavioral"|"technical"|"coding"|"general"|null, "summary": string|null}}
Use "confirm" if the user agrees the details are right, "correct" if they fix or add any detail (put ONLY the changed fields in updates, others null), "cancel" if they want to discard this job, otherwise "other".`;
        const result = await askModelForJson(prompt, 400);
        const action = result && result.action;
        if (action === 'cancel') {
            const jobs = loadJobs().filter(item => item.id !== job.id);
            saveJobs(jobs);
            setActiveJob(null);
            return { reply: 'No problem, I discarded that job. Paste another link or tell me the job details whenever you are ready.' };
        }
        if (action === 'correct' && result.updates) {
            applyUpdates(job, result.updates);
            updateJob(job);
            return { reply: formatConfirmation(job, 'Got it, I updated the details:') };
        }
        if (action === 'confirm') {
            if (result && result.updates) applyUpdates(job, result.updates);
            job.status = 'active';
            updateJob(job);
            return { start: 'new' };
        }
        return { reply: 'Please reply "yes" if the details above are correct, or tell me what to change.' };
    }

    function describeJob(job, index) {
        const date = new Date(job.updatedAt || Date.now()).toLocaleDateString();
        const status = job.status === 'pending' ? 'awaiting confirmation' : job.status === 'completed' ? 'completed' : 'in progress';
        return `${index + 1}. **${job.title || 'Untitled job'}**${job.company ? ' at ' + job.company : ''} (${job.interviewType || 'general'}, ${status}, ${job.answers || 0} answers, ${SOURCE_NAMES[job.source] || 'manual'}, ${date})`;
    }

    function sortedJobs() {
        return loadJobs().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function handleCommand(text) {
        const trimmed = text.trim();
        if (/^(?:show |list |open |see )?(?:my )?(?:saved )?(?:jobs|interviews|job interviews)[?.!\s]*$/i.test(trimmed)) {
            const jobs = sortedJobs();
            const reply = jobs.length
                ? `Here are your saved jobs:\n\n${jobs.map(describeJob).join('\n')}\n\nSay "resume job 1" to continue one, or "delete job 1" to remove it.`
                : 'You have no saved jobs yet. Paste an Indeed, LinkedIn, or Handshake link to save one.';
            runTask(text, async () => ({ reply }));
            return true;
        }
        const resume = trimmed.match(/^(?:resume|continue|open|switch to)\s+(?:job|interview)?\s*#?(\d+)[.!\s]*$/i);
        if (resume) {
            const job = sortedJobs()[Number(resume[1]) - 1];
            if (!job) {
                runTask(text, async () => ({ reply: `I don't have a saved job number ${resume[1]}. Say "my jobs" to see the list.` }));
                return true;
            }
            setActiveJob(job);
            if (job.status === 'pending') {
                runTask(text, async () => ({ reply: formatConfirmation(job, 'This job still needs your confirmation:') }));
                return true;
            }
            job.status = 'active';
            updateJob(job);
            startInterview('resume', text);
            return true;
        }
        const del = trimmed.match(/^(?:delete|remove)\s+(?:job|interview)\s*#?(\d+)[.!\s]*$/i);
        if (del) {
            const jobs = sortedJobs();
            const job = jobs[Number(del[1]) - 1];
            runTask(text, async () => {
                if (!job) return { reply: `I don't have a saved job number ${del[1]}.` };
                saveJobs(jobs.filter(item => item.id !== job.id));
                if (localStorage.getItem(ACTIVE_KEY) === job.id) setActiveJob(null);
                return { reply: `Deleted **${job.title || 'that job'}** from your saved jobs.` };
            });
            return true;
        }
        return false;
    }

    // Returns true when the message was handled here and must not go through the normal AI flow.
    window.handleInterviewJobMessage = function (text) {
        if (!isInterviewMode()) return false;
        const message = String(text || '').trim();
        if (!message) return false;

        const linkMatch = message.match(JOB_URL_RE);
        if (linkMatch) {
            runTask(message, async () => {
                const outcome = await handleLink(message, linkMatch[0]);
                return outcome;
            });
            return true;
        }

        if (handleCommand(message)) return true;

        const job = getActiveJob();
        if (!job) return false;

        if (job.status === 'pending') {
            if (CONFIRM_RE.test(message)) {
                job.status = 'active';
                updateJob(job);
                startInterview('new', message);
                return true;
            }
            runTask(message, () => handlePendingCorrection(job, message));
            return true;
        }

        const typeFix = message.match(/\b(?:interview )?type (?:is|should be|is actually)\s+(behavioral|technical|coding|general)\b|\b(?:make|change|switch) (?:it|the interview|this)(?: type)? (?:to )?(behavioral|technical|coding|general)\b/i);
        if (typeFix) {
            job.interviewType = (typeFix[1] || typeFix[2]).toLowerCase();
            updateJob(job);
        }
        if (END_RE.test(message)) {
            job.awaitingSummary = true;
            updateJob(job);
        }
        return false;
    };

    window.getInterviewJobContext = function () {
        const job = getActiveJob();
        if (!job || job.status === 'pending') return '';
        const lines = [
            '=== SAVED JOB INTERVIEW (confirmed by the user) ===',
            job.url ? `Job link: ${job.url}` : '',
            `Job title: ${job.title || 'unknown'}`,
            `Company: ${job.company || 'unknown'}`,
            job.location ? `Location: ${job.location}` : '',
            `Tech job: ${job.isTech ? 'yes' : 'no'}`,
            `Interview type: ${job.interviewType || 'general'}`,
            job.summary ? `Role summary: ${job.summary}` : '',
            job.requirements && job.requirements.length ? `Key requirements: ${job.requirements.join('; ')}` : '',
            `Progress: ${job.answers || 0} answers given so far; status ${job.status}.`
        ];
        if (job.questions && job.questions.length) {
            lines.push('Questions already asked (never repeat them):');
            job.questions.slice(-40).forEach((question, index) => lines.push(`${index + 1}. ${question}`));
        }
        const recent = (job.transcript || []).slice(-6);
        if (recent.length) {
            lines.push('Most recent exchange:');
            recent.forEach(turn => lines.push(`${turn.role === 'user' ? 'Candidate' : 'Interviewer'}: ${String(turn.text).slice(0, 500)}`));
        }
        if (job.summary_result) lines.push(`Earlier overall assessment: ${job.summary_result}`);
        lines.push('=== END SAVED JOB INTERVIEW ===');
        return lines.filter(Boolean).join('\n');
    };

    function recordMessage(text, sender) {
        if (!isInterviewMode() || typeof text !== 'string' || !text.trim()) return;
        const job = getActiveJob();
        if (!job || job.status === 'pending') return;
        const isUser = String(sender).toLowerCase() === 'user';
        if (isUser && suppressNextUserRecord) {
            suppressNextUserRecord = false;
            return;
        }
        job.transcript = job.transcript || [];
        job.transcript.push({ role: isUser ? 'user' : 'assistant', text: text.slice(0, 2500), at: Date.now() });
        if (job.transcript.length > MAX_TRANSCRIPT) job.transcript = job.transcript.slice(-MAX_TRANSCRIPT);
        if (isUser) {
            job.answers = (job.answers || 0) + 1;
        } else {
            const questions = text.match(/[^.!?\n]{8,}\?/g);
            if (questions) {
                const last = questions[questions.length - 1].replace(/^[\s*\-#>\d.)]+/, '').trim();
                job.questions = job.questions || [];
                if (last && job.questions[job.questions.length - 1] !== last) job.questions.push(last.slice(0, 300));
                if (job.questions.length > 100) job.questions = job.questions.slice(-100);
            }
            if (job.awaitingSummary) {
                job.awaitingSummary = false;
                job.summary_result = text.slice(0, 3000);
                job.status = 'completed';
            }
        }
        updateJob(job);
    }

    if (typeof addMessage === 'function') {
        const originalAddMessage = addMessage;
        addMessage = function (text, sender, ...rest) {
            const result = originalAddMessage.call(this, text, sender, ...rest);
            try {
                recordMessage(text, sender);
            } catch (error) {
                console.warn('Job interview progress not recorded:', error);
            }
            return result;
        };
        window.addMessage = addMessage;
    }
})();
