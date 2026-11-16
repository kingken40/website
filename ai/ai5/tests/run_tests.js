// Dependency-free tests for the AI5 browser scripts. Run: node ai/ai5/tests/run_tests.js
// The scripts are classic browser files, so pieces are loaded into a vm sandbox with small stubs.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const scriptsDir = path.join(__dirname, '..', 'scripts');
const read = name => fs.readFileSync(path.join(scriptsDir, name), 'utf8').replace(/^\uFEFF/, '');

function slice(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    const end = endMarker ? source.indexOf(endMarker, start) : source.length;
    assert.ok(start >= 0 && end > start, `markers not found: ${startMarker}`);
    return source.slice(start, end);
}

function load(code, extra = {}) {
    const sandbox = { console, window: {}, document: {}, ...extra };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('update dates are shown for both experiences only on the JARVIS page', () => {
    const nodes = ['desktop', 'mobile', 'desktop', 'mobile'].map(key => ({ dataset: { novaUpdate: key } }));
    const dates = load(read('nova_update_dates.js'), { document: { querySelectorAll: () => nodes } });
    assert.ok(Number.isFinite(Date.parse(nodes[0].dateTime)));
    assert.ok(Number.isFinite(Date.parse(nodes[1].dateTime)));
    nodes.forEach(node => assert.match(node.textContent, /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} [AP]M$/));
    assert.strictEqual(nodes[0].textContent, nodes[2].textContent);
    assert.strictEqual(nodes[1].textContent, nodes[3].textContent);
    assert.throws(() => dates.formatNovaUpdateDate('invalid'), /Invalid AI5 update date/);
    ['AI_v5_nova.html', 'AI_v5_JARVIS.html', 'AI_v5_JARVIS_CLEAN.html'].forEach(page => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
        const expected = page === 'AI_v5_JARVIS.html' ? 2 : 0;
        assert.strictEqual((html.match(/data-nova-update="desktop"/g) || []).length, expected, page);
        assert.strictEqual((html.match(/data-nova-update="mobile"/g) || []).length, expected, page);
        assert.strictEqual(html.includes('nova_update_dates.js'), expected > 0, page);
    });
});

// ---------- Audio transcription and lecture mode ----------
const filesSrc = read('nova_runtime_files.js');
const audio = load(slice(filesSrc, 'function formatAudioTimestamp', 'function encodeMonoWav'));
const formatter = load(
    `function escapeHtml(text) { return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }\n${slice(filesSrc, 'function stripHtmlTags', '// Generate continuation prompt')}`
);
const voiceSrc = read('nova_voice.js');
const voiceTranscript = load(
    slice(voiceSrc, 'function joinTranscriptParts', '// Mobile browsers sometimes re-send'),
    { pendingTranscript: 'final words', lastInterimTranscript: 'unfinished ending' }
);

test('consumeVoiceTurnTranscript preserves final and interim speech exactly once', () => {
    assert.strictEqual(voiceTranscript.consumeVoiceTurnTranscript(), 'final words unfinished ending');
    assert.strictEqual(voiceTranscript.consumeVoiceTurnTranscript(), '');
});

test('push-to-talk buttons handle pointer cancellation and permission-release races', () => {
    assert.ok(voiceSrc.includes("button.addEventListener('pointercancel', stopListening)"));
    assert.ok(voiceSrc.includes("button.addEventListener('lostpointercapture', stopListening)"));
    assert.ok(voiceSrc.includes('shouldContinue: pressIsActive'));
    assert.ok(voiceSrc.includes('const transcript = consumeVoiceTurnTranscript();'));
    assert.ok(!voiceSrc.includes("newVoiceBtn.addEventListener('touchstart', startListening)"));
});

function makeMobileCallHarness() {
    const listeners = {};
    const timers = [];
    const icon = {}, label = {}, status = {};
    const button = {
        addEventListener(type, fn) { listeners[type] = fn; },
        querySelector(selector) { return selector === 'i' ? icon : label; },
        setAttribute() {}
    };
    const elements = { mobileMuteBtn: button, mobileStatusText: status };
    const windowStub = {
        innerWidth: 375, SpeechRecognition: function() {},
        matchMedia: () => ({ matches: true }),
        addEventListener(type, fn) { listeners[`window:${type}`] = fn; },
        hasVoicePermission: false, alwaysListeningHotkeyMode: false, isListening: false
    };
    let permission;
    let toggles = 0, toggleOptions;
    windowStub.requestVoicePermission = () => new Promise(resolve => { permission = resolve; });
    const sandbox = load(read('nova_page_mobile_call.js'), {
        window: windowStub,
        document: { getElementById: id => elements[id] || null, querySelector: () => null },
        setInterval(fn) { listeners.poll = fn; },
        setTimeout(fn) { timers.push(fn); return fn; },
        clearTimeout() {},
        toggleAlwaysListeningMode: async options => { toggles++; toggleOptions = options; windowStub.alwaysListeningHotkeyMode = !windowStub.alwaysListeningHotkeyMode; },
        console: { log() {}, warn() {} }
    });
    return { listeners, timers, window: windowStub, status, label, sandbox,
        grant(value) { windowStub.hasVoicePermission = value; permission(value); },
        get toggles() { return toggles; }, get toggleOptions() { return toggleOptions; } };
}

test('mobile microphone startup failure is visible and a tap retries once', async () => {
    const h = makeMobileCallHarness();
    h.listeners['window:load']();
    h.timers.shift()();
    h.grant(false);
    await new Promise(resolve => setImmediate(resolve));
    h.listeners.poll();
    assert.ok(h.status.textContent.includes('permission needed'));
    assert.strictEqual(h.label.textContent, 'Start mic');
    h.listeners.click();
    h.grant(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.toggles, 1);
    assert.strictEqual(h.toggleOptions.startImmediately, true);
    h.listeners.poll();
    assert.strictEqual(h.status.textContent, 'Starting microphone...');
    h.window.isListening = true;
    h.listeners.poll();
    assert.strictEqual(h.status.textContent, 'Always listening...');
    h.window.mobileVoiceTranscript = 'Can you hear me?';
    h.listeners.poll();
    assert.strictEqual(h.status.textContent, 'Hearing: Can you hear me?');
});

test('mobile mute during a pending permission request prevents listening', async () => {
    const h = makeMobileCallHarness();
    h.listeners['window:load']();
    h.timers.shift()();
    h.listeners.click();
    h.grant(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.toggles, 0);
    h.listeners.poll();
    assert.strictEqual(h.status.textContent, 'Microphone muted');
    h.listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.toggles, 1);
});

test('mobile mic can be re-enabled while permission is still pending', async () => {
    const h = makeMobileCallHarness();
    h.listeners['window:load']();
    h.timers.shift()();
    h.listeners.click();
    h.listeners.click();
    h.grant(true);
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.toggles, 0);
    h.timers.shift()();
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(h.toggles, 1);
});

test('mobile unsupported speech recognition is not reported as listening', async () => {
    const h = makeMobileCallHarness();
    delete h.window.SpeechRecognition;
    h.listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    h.listeners.poll();
    assert.ok(h.status.textContent.includes('unavailable'));
    assert.strictEqual(h.toggles, 0);
});

test('JARVIS mobile uses the existing mute control without a separate recording button', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'AI_v5_JARVIS.html'), 'utf8');
    assert.ok(html.includes('id="mobileMuteBtn"'));
    assert.ok(!html.includes('mobileRecordVoiceBtn'));
    assert.ok(!html.includes('nova_mobile_recording.js'));
});

test('mobile speech-service failure tells the user to retry using the mic', () => {
    const h = makeMobileCallHarness();
    h.window.voiceRecognitionError = 'network';
    h.listeners.poll();
    assert.strictEqual(h.status.textContent, 'Speech service unavailable - try another browser');
    assert.strictEqual(h.label.textContent, 'Start mic');
});

test('always listening stops on microphone permission errors and preserves partial speech on timeout', () => {
    const code = slice(voiceSrc, 'function setupSpeechRecognition()', 'function recreateRecognition');
    const submissions = [], notifications = [], timers = [];
    const sandbox = load(`
        let recognition = {}, isListening = false, alwaysListeningHotkeyMode = true;
        let alwaysListeningTurnActive = true, hasVoicePermission = true, pendingTranscript = 'hello', lastInterimTranscript = 'there';
        let pttReleaseMode = false, speechInterruptListeningMode = false, isSpeechOutputActive = false;
        let isWakeWordSession = false, IS_TOUCH_PHONE = false;
        function clearMobileVoiceTurn() {}
        function consumeVoiceTurnTranscript() {
            const text = [pendingTranscript, lastInterimTranscript].filter(Boolean).join(' ');
            pendingTranscript = ''; lastInterimTranscript = ''; return text;
        }
        ${code}
        setupSpeechRecognition();
        window.testRecognition = recognition;
        window.state = () => ({ alwaysListeningHotkeyMode, hasVoicePermission });
    `, {
        navigator: { language: 'en-US' },
        updateVoiceUI() {}, updateVoiceStatus() {},
        showVoiceNotification: text => notifications.push(text),
        submitVoiceTranscript: text => submissions.push(text),
        setTimeout: fn => timers.push(fn),
        console: { log() {}, error() {} }
    });
    sandbox.window.testRecognition.onerror({ error: 'no-speech' });
    assert.deepStrictEqual(submissions, ['hello there']);
    assert.strictEqual(timers.length, 0);
    sandbox.window.testRecognition.onerror({ error: 'not-allowed' });
    assert.strictEqual(sandbox.window.state().alwaysListeningHotkeyMode, false);
    assert.strictEqual(sandbox.window.state().hasVoicePermission, false);
    assert.strictEqual(sandbox.window.voiceRecognitionError, 'not-allowed');
    assert.ok(notifications[0].includes('not-allowed'));
});

test('mobile-style single-shot recognition submits the spoken transcript on end', () => {
    const submissions = [];
    const code = slice(voiceSrc, 'function setupSpeechRecognition()', 'function recreateRecognition');
    const sandbox = load(`
        let recognition = {}, isListening = false, hotkeyListening = false, hotkeyReleasePendingStart = false;
        let alwaysListeningHotkeyMode = true, alwaysListeningTurnActive = true, isWakeListening = false;
        let wakeWordEnabled = false, pttReleaseMode = false, speechInterruptListeningMode = false;
        let interruptListeningEnabled = false, isWakeWordSession = false, pendingTranscript = '', lastInterimTranscript = '', IS_TOUCH_PHONE = false;
        function consumeVoiceTurnTranscript() {
            const text = [pendingTranscript, lastInterimTranscript].filter(Boolean).join(' ');
            pendingTranscript = ''; lastInterimTranscript = ''; return text;
        }
        ${slice(voiceSrc, 'function joinTranscriptParts', 'function setupSpeechRecognition()')}
        ${code}
        setupSpeechRecognition();
        window.testRecognition = recognition;
    `, {
        navigator: { language: 'en-US' }, console: { log() {} },
        updateVoiceUI() {}, updateVoiceStatus() {},
        pickBestTranscript: result => result[0].transcript,
        handleInterruptCaptureResult: () => false,
        isMicMutedForSpeech: () => false, isAssistantEchoTranscript: () => false,
        submitVoiceTranscript: text => submissions.push(text)
    });
    sandbox.window.testRecognition.onstart();
    const result = [{ transcript: 'Can you hear me clearly?' }];
    result.isFinal = true;
    sandbox.window.testRecognition.onresult({ resultIndex: 0, results: [result] });
    sandbox.window.testRecognition.onend();
    assert.deepStrictEqual(submissions, ['Can you hear me clearly?']);
});

test('mobile always listening joins phrases across recognizer restarts and waits for silence', () => {
    let now = 100000;
    const timers = [];
    const submissions = [];
    class Clock extends Date { static now() { return now; } }
    let sandbox;
    const recognition = {
        start() { this.onstart(); },
        stop() { this.onend(); },
        abort() {}
    };
    sandbox = load(`
        let recognition = window.recognition, isListening = false, hotkeyListening = false, hotkeyReleasePendingStart = false;
        let alwaysListeningHotkeyMode = true, alwaysListeningTurnActive = false, alwaysListeningTurnStartedAt = 0;
        let mobileVoicePauseTimer = null, mobileVoiceFinishTimer = null, mobileVoiceFinishing = false, mobileVoiceSpeechActive = false, mobileVoiceTurnGeneration = 0;
        let isWakeListening = false, wakeWordEnabled = false, pttReleaseMode = false, speechInterruptListeningMode = false;
        let interruptListeningEnabled = false, isWakeWordSession = false, pendingTranscript = '', lastInterimTranscript = '';
        let IS_TOUCH_PHONE = true, hasVoicePermission = true, isSpeaking = false, isSpeechOutputActive = false;
        ${slice(voiceSrc, 'function joinTranscriptParts', 'function startWakeListening')}
        ${slice(voiceSrc, 'function startAlwaysListeningTurn()', 'function setupPushToTalkHotkey()')}
    `, {
        Date: Clock, window: { recognition, SpeechRecognition: function() {} }, navigator: { language: 'en-US' },
        console: { log() {}, warn() {}, error() {} },
        setTimeout(fn, delay) { const timer = { fn, at: now + delay, cancelled: false }; timers.push(timer); return timer; },
        clearTimeout(timer) { if (timer) timer.cancelled = true; },
        updateVoiceUI() {}, updateVoiceStatus() {}, showVoiceNotification() {}, getAlwaysListeningStatus: () => 'Listening',
        pickBestTranscript: result => result[0].transcript, handleInterruptCaptureResult: () => false,
        isMicMutedForSpeech: () => false, isAssistantEchoTranscript: () => false,
        hasUsableVoiceRecognition: () => true, isWithinEchoTail: () => false,
        submitVoiceTranscript: text => submissions.push(text)
    });
    const advance = ms => {
        const until = now + ms;
        while (true) {
            const next = timers.filter(t => !t.cancelled && t.at <= until).sort((a, b) => a.at - b.at)[0];
            if (!next) break;
            next.cancelled = true; now = next.at; next.fn();
        }
        now = until;
    };
    const say = text => {
        const result = [{ transcript: text }];
        result.isFinal = true;
        recognition.onresult({ resultIndex: 0, results: [result] });
    };
    sandbox.startAlwaysListeningTurn();
    recognition.onspeechstart();
    say('The first sentence.');
    assert.strictEqual(sandbox.window.mobileVoiceTranscript, 'The first sentence.');
    recognition.onspeechend();
    recognition.onend();
    advance(300);
    advance(1000);
    recognition.onspeechstart();
    advance(4000);
    assert.deepStrictEqual(submissions, [], 'speech in progress must not be cut off');
    say('Here is the second sentence.');
    recognition.onspeechend();
    recognition.onend();
    advance(300);
    recognition.onerror({ error: 'no-speech' });
    recognition.onend();
    advance(2699);
    assert.deepStrictEqual(submissions, [], 'wait for a full pause');
    advance(1);
    assert.deepStrictEqual(submissions, ['The first sentence. Here is the second sentence.']);
    assert.strictEqual(sandbox.window.mobileVoiceTranscript, '');
    advance(5000);
    assert.strictEqual(submissions.length, 1, 'submit the complete turn only once');
    sandbox.startAlwaysListeningTurn();
    say('Do not send this.');
    vm.runInContext("alwaysListeningHotkeyMode = false; clearMobileVoiceTurn(); pendingTranscript = ''; lastInterimTranscript = '';", sandbox);
    recognition.onend();
    advance(5000);
    assert.strictEqual(submissions.length, 1, 'muting cancels the pending turn');
    vm.runInContext('alwaysListeningHotkeyMode = true;', sandbox);
    sandbox.startAlwaysListeningTurn();
    say('Words before failure.');
    const interim = [{ transcript: 'And the ending' }];
    interim.isFinal = false;
    recognition.onresult({ resultIndex: 0, results: [interim] });
    assert.strictEqual(sandbox.window.mobileVoiceTranscript, 'Words before failure. And the ending');
    recognition.onerror({ error: 'network' });
    recognition.onend();
    advance(5000);
    assert.deepStrictEqual(submissions, ['The first sentence. Here is the second sentence.', 'Words before failure. And the ending']);
    assert.strictEqual(sandbox.window.mobileVoiceTranscript, '');
    assert.strictEqual(sandbox.window.alwaysListeningHotkeyMode, false);
    assert.strictEqual(sandbox.window.voiceRecognitionError, 'network');
});

test('mobile submits a turn when speechend or recognition end is missing', () => {
    let now = 0;
    const timers = [], submissions = [];
    const recognition = {
        start() { this.onstart(); },
        stop() { this.stopped = true; },
        abort() { this.aborted = true; }
    };
    const sandbox = load(`
        let recognition = window.recognition, isListening = false, hotkeyListening = false, hotkeyReleasePendingStart = false;
        let alwaysListeningHotkeyMode = true, alwaysListeningTurnActive = false, alwaysListeningTurnStartedAt = 0;
        let mobileVoicePauseTimer = null, mobileVoiceFinishTimer = null, mobileVoiceFinishing = false, mobileVoiceSpeechActive = false, mobileVoiceTurnGeneration = 0;
        let isWakeListening = false, wakeWordEnabled = false, pttReleaseMode = false, speechInterruptListeningMode = false;
        let interruptListeningEnabled = false, isWakeWordSession = false, pendingTranscript = '', lastInterimTranscript = '';
        let IS_TOUCH_PHONE = true, hasVoicePermission = true, isSpeaking = false, isSpeechOutputActive = false;
        ${slice(voiceSrc, 'function joinTranscriptParts', 'function startWakeListening')}
        ${slice(voiceSrc, 'function startAlwaysListeningTurn()', 'function setupPushToTalkHotkey()')}
    `, {
        window: { recognition, SpeechRecognition: function() {} }, navigator: { language: 'en-US' },
        console: { log() {}, warn() {}, error() {} },
        setTimeout(fn, delay) { const timer = { fn, at: now + delay, cancelled: false }; timers.push(timer); return timer; },
        clearTimeout(timer) { if (timer) timer.cancelled = true; },
        updateVoiceUI() {}, updateVoiceStatus() {}, getAlwaysListeningStatus: () => 'Listening',
        pickBestTranscript: result => result[0].transcript, handleInterruptCaptureResult: () => false,
        isMicMutedForSpeech: () => false, isAssistantEchoTranscript: () => false,
        hasUsableVoiceRecognition: () => true, isWithinEchoTail: () => false,
        submitVoiceTranscript: text => submissions.push(text)
    });
    const advance = ms => {
        const until = now + ms;
        while (true) {
            const next = timers.filter(t => !t.cancelled && t.at <= until).sort((a, b) => a.at - b.at)[0];
            if (!next) break;
            next.cancelled = true; now = next.at; next.fn();
        }
        now = until;
    };
    const say = text => {
        const result = [{ transcript: text }];
        result.isFinal = false;
        recognition.onresult({ resultIndex: 0, results: [result] });
    };
    sandbox.startAlwaysListeningTurn();
    recognition.onspeechstart();
    say('Can you');
    advance(2000);
    say('Can you hear me');
    advance(2999);
    assert.strictEqual(recognition.stopped, undefined);
    advance(1);
    assert.strictEqual(recognition.stopped, true);
    say('Can you hear me clearly');
    advance(1999);
    assert.deepStrictEqual(submissions, []);
    advance(1);
    assert.deepStrictEqual(submissions, ['Can you hear me clearly']);
    assert.strictEqual(recognition.aborted, true);
    assert.strictEqual(recognition.onend, null);
    assert.notStrictEqual(sandbox.window.recognition, recognition);
    advance(5000);
    assert.strictEqual(submissions.length, 1);
});

function makePlaybackHarness() {
    const timers = [];
    const utterances = [];
    const synth = {
        paused: false,
        speaking: false,
        getVoices: () => [],
        cancel() { this.speaking = false; },
        pause() { this.paused = true; },
        resume() { this.paused = false; },
        speak(utterance) { utterances.push(utterance); this.speaking = true; }
    };
    const sandbox = load(`
        let speechPlaybackGeneration = 0, speechPlaybackState = 'idle', pendingSpeechContinuation = null;
        let bridgeRequestController = null, currentBridgeAudio = null, currentPackAudio = null, readingTracker = null;
        let synthesis = window.speechSynthesis, isSpeaking = false, isSpeechOutputActive = false;
        let wakeWordEnabled = false, isWakeListening = false, isWakeWordSession = false;
        let recognition = null, isListening = false, alwaysListeningHotkeyMode = false;
        let interruptListeningEnabled = false, hasVoicePermission = false, isVoiceSupported = true;
        let restartPending = false, selectedVoiceMode = 'tts', selectedJarvisPackId = null;
        let currentVoiceSettings = { rate: 1, pitch: 1, volume: 1 }, speechOutputWatchdog = null;
        let activeSpeechOutputText = '', speechInterruptTriggered = false;
        ${slice(voiceSrc, 'let assistantSpeechQueue =', '// Voice Sampling and Selection Functions')}
    `, {
        console: { log() {}, warn() {}, error() {} },
        window: { speechSynthesis: synth },
        document: {},
        localStorage: { getItem: () => null },
        SpeechSynthesisUtterance: function(text) { this.text = text; },
        setTimeout: (fn, delay) => { const timer = { fn, delay, cancelled: false }; timers.push(timer); return timer; },
        clearTimeout: timer => { if (timer) timer.cancelled = true; },
        clearSpeechOutputState() { vm.runInContext('isSpeaking = false; isSpeechOutputActive = false;', sandbox); },
        clearReadingHighlight() {},
        startReadingTracker() {},
        findReadingMessage: () => null,
        markReadingWord(chunk, index) { sandbox.boundaries.push([chunk, index]); },
        setSpeechPlaybackState(state) { vm.runInContext(`speechPlaybackState = '${state}'`, sandbox); },
        stopSpeechInterruptListening() {},
        updateSpeakingUI() {},
        isUsableSpeechVoice: () => false,
        normalizeVoiceTranscript: text => text,
        rememberSpokenText() {},
        showVoiceNotification() {}
    });
    sandbox.boundaries = [];
    return {
        sandbox, synth, utterances,
        runTimer(delay) {
            const timer = timers.find(item => !item.cancelled && item.delay === delay);
            assert.ok(timer, `missing ${delay}ms timer`);
            timer.cancelled = true;
            return timer.fn();
        }
    };
}

test('playback pause and stop prevent delayed starts and chunk retries', async () => {
    const { sandbox, synth, utterances, runTimer } = makePlaybackHarness();
    sandbox.speakText('First second third fourth.', null, 'other');
    sandbox.pauseSpeech();
    await runTimer(600);
    assert.strictEqual(utterances.length, 0, 'pause blocks pending start');
    sandbox.resumeSpeech();
    assert.strictEqual(utterances.length, 1, 'play resumes the pending start');
    const first = utterances[0];
    first.onstart();
    first.onboundary({ name: 'word', charIndex: 6 });
    assert.deepStrictEqual(sandbox.boundaries[0], ['First second third fourth.', 6]);
    sandbox.pauseSpeech();
    assert.strictEqual(synth.paused, true);
    sandbox.stopSpeech();
    first.onerror({ error: 'interrupted' });
    assert.strictEqual(utterances.length, 1, 'stale errors cannot restart after stop');
    sandbox.resumeSpeech();
    await runTimer(600);
    assert.strictEqual(utterances.length, 2, 'play after stop starts the response again');
});

test('pause defers the next speech chunk and stop invalidates a delayed start', async () => {
    const { sandbox, utterances, runTimer } = makePlaybackHarness();
    sandbox.speakText('word '.repeat(60), null, 'other');
    await runTimer(600);
    utterances[0].onend();
    sandbox.pauseSpeech();
    runTimer(150);
    assert.strictEqual(utterances.length, 1);
    sandbox.resumeSpeech();
    assert.strictEqual(utterances.length, 2);
    sandbox.speakText('A new response', null, 'other');
    sandbox.stopSpeech();
    await runTimer(600);
    assert.strictEqual(utterances.length, 2, 'stopped preparation cannot start later');
});

test('pause defers a failed speech chunk retry', async () => {
    const { sandbox, utterances, runTimer } = makePlaybackHarness();
    sandbox.speakText('retry this sentence', null, 'other');
    await runTimer(600);
    utterances[0].onerror({ error: 'network' });
    sandbox.pauseSpeech();
    runTimer(250);
    assert.strictEqual(utterances.length, 1);
    sandbox.resumeSpeech();
    assert.strictEqual(utterances.length, 2);
    sandbox.stopSpeech();
    utterances[1].onerror({ error: 'interrupted' });
    assert.strictEqual(utterances.length, 2);
});

test('stale bridge responses cannot create or play audio after stop', async () => {
    let resolveFetch;
    let createdAudio = 0;
    const sandbox = load(`
        let localVoiceBridgeEnabled = true, localVoiceBridgeUrl = 'http://localhost';
        let speechPlaybackGeneration = 1, bridgeRequestController = null, currentBridgeAudio = null;
        let speechPlaybackState = 'preparing', lastBridgeFailureNoticeMs = 0;
        let currentVoiceSettings = { rate: 1, volume: 1 }, isSpeaking, isSpeechOutputActive;
        let activeSpeechOutputText, speechInterruptTriggered;
        ${slice(voiceSrc, 'async function playViaLocalVoiceBridge', '// Wake phrase detection')}
    `, {
        window: {}, AbortController,
        fetch: () => new Promise(resolve => { resolveFetch = resolve; }),
        normalizeBridgeUrl: value => value,
        getBridgeVoiceName: () => null,
        Audio: function() { createdAudio++; },
        URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
        console,
        clearSpeechOutputState() {},
        showVoiceNotification() {}
    });
    const pending = sandbox.playViaLocalVoiceBridge('hello', null, 1);
    vm.runInContext('speechPlaybackGeneration++; bridgeRequestController.abort();', sandbox);
    resolveFetch({ ok: true, blob: async () => ({ size: 10 }) });
    assert.strictEqual(await pending, true);
    assert.strictEqual(createdAudio, 0);
});

test('voice-pack errors retry only once when both media error paths fire', async () => {
    const audios = [];
    let rejectFirst;
    const sandbox = load(`
        let speechPlaybackGeneration = 1, speechPlaybackState = 'preparing', currentPackAudio = null;
        let lastJarvisPackClipByPack = {}, isSpeaking, isSpeechOutputActive;
        let pendingSpeechContinuation = null;
        ${slice(voiceSrc, 'function playJarvisPackSample', 'window.JARVIS_AUDIO_PACKS =')}
    `, {
        window: {},
        console: { log() {}, warn() {} },
        getSelectedJarvisPack: () => ({ id: 'test', name: 'Test', basePath: 'pack' }),
        chooseJarvisPackClip: () => ['first.wav', 'second.wav', 'third.wav'],
        Audio: function(src) {
            this.src = src;
            this.pause = () => {};
            this.play = () => audios.length === 1
                ? new Promise((resolve, reject) => { rejectFirst = reject; })
                : Promise.resolve();
            audios.push(this);
        },
        setSpeechPlaybackState() {},
        clearSpeechOutputState() {},
        clearReadingHighlight() {},
        updateSpeakingUI() {},
        showVoiceNotification() {}
    });
    assert.strictEqual(sandbox.playJarvisPackSample('test'), true);
    audios[0].onerror(new Error('media error'));
    rejectFirst(new Error('play rejected'));
    await Promise.resolve();
    assert.strictEqual(audios.length, 2, 'the first clip advances to only one replacement');
});

test('reading tracker follows boundaries without jumping to distant repeated words', () => {
    const nodes = [];
    const content = {
        isConnected: true,
        replaceChild(replacement, old) {
            const index = nodes.indexOf(old);
            nodes.splice(index, 1, replacement);
        },
        normalize() {
            const text = nodes.map(node => node.nodeValue === undefined ? node.textContent : node.nodeValue).join('');
            nodes.splice(0, nodes.length, { nodeValue: text, parentNode: content });
        }
    };
    nodes.push({ nodeValue: 'Dr. Smith said hello one two three hello.', parentNode: content });
    let rangeStart, rangeEnd, rangeNode;
    const document = {
        createTextNode: text => ({ nodeValue: text, parentNode: content }),
        createTreeWalker: () => {
            let i = 0;
            return { nextNode: () => nodes[i++] || null };
        },
        createElement: () => ({ parentNode: content }),
        createRange: () => ({
            setStart(node, offset) { rangeNode = node; rangeStart = offset; },
            setEnd(node, offset) { rangeEnd = offset; },
            surroundContents(mark) {
                const index = nodes.indexOf(rangeNode);
                const text = rangeNode.nodeValue;
                mark.textContent = text.slice(rangeStart, rangeEnd);
                nodes.splice(index, 1,
                    { nodeValue: text.slice(0, rangeStart), parentNode: content },
                    mark,
                    { nodeValue: text.slice(rangeEnd), parentNode: content });
            }
        })
    };
    const sandbox = load(slice(voiceSrc, 'let readingTracker = null;', 'function isUsableSpeechVoice'), {
        document, NodeFilter: { SHOW_TEXT: 4 },
        window: { makeSpeechFriendly: text => text.replace('Dr.', 'Doctor') }
    });
    sandbox.startReadingTracker(content);
    sandbox.markReadingWord('Doctor Smith', 0);
    assert.strictEqual(nodes.find(node => node.className)?.textContent, 'Dr.');
    sandbox.markReadingWord('Doctor Smith', 7);
    assert.strictEqual(nodes.find(node => node.className)?.textContent, 'Smith');
    sandbox.markReadingWord('hello', 0);
    assert.strictEqual(nodes.find(node => node.className)?.textContent, 'hello');
    sandbox.markReadingWord('hello', 0);
    assert.strictEqual(nodes.find(node => node.className), undefined, 'must not jump past unrelated words');
    assert.strictEqual(nodes.map(node => node.nodeValue || '').join(''), 'Dr. Smith said hello one two three hello.');
});

test('word tracker and playback controls are connected to both message interactions', () => {
    const voice = read('nova_voice.js');
    assert.ok(voice.includes('markReadingWord(chunk, event.charIndex)'));
    assert.ok(voice.includes("mark.className = 'speech-current-word'"));
    assert.ok(read('nova_runtime_ui_events.js').includes("sender === 'Avon' ? 'other' : 'nova', messageContent"));
    assert.ok(read('nova_runtime_chat.js').includes("messageDiv.querySelector('.message-content[data-speech-content=\"true\"]')"));
});

test('normalizeAudioTranscript keeps real speaker labels and normalizes ids', () => {
    const result = audio.normalizeAudioTranscript({
        text: 'hi there',
        segments: [
            { start: 0, end: 4, speaker: 'A', text: 'Hello class.' },
            { start: 4, end: 6, speaker: 'speaker_1', text: 'Question?' }
        ]
    });
    assert.strictEqual(result.segments[0].speaker, 'Speaker A');
    assert.strictEqual(result.segments[1].speaker, 'Speaker 1');
    assert.strictEqual(result.segments[0].line, '[00:00-00:04] Speaker A: Hello class.');
});

test('normalizeAudioTranscript does not invent speakers when none are given', () => {
    const result = audio.normalizeAudioTranscript({ segments: [{ start: 1, end: 2, text: 'Plain text.' }] });
    assert.strictEqual(result.segments[0].speaker, '');
    assert.ok(!/Speaker/.test(result.segments[0].line));
});

test('normalizeAudioTranscript handles a plain string and drops empty segments', () => {
    assert.strictEqual(audio.normalizeAudioTranscript('  hello ').transcript, 'hello');
    const result = audio.normalizeAudioTranscript({ segments: [{ text: '  ' }, { text: 'kept' }] });
    assert.strictEqual(result.segments.length, 1);
});

test('formatAudioTimestamp formats minutes and hours', () => {
    assert.strictEqual(audio.formatAudioTimestamp(75), '01:15');
    assert.strictEqual(audio.formatAudioTimestamp(3725), '01:02:05');
    assert.strictEqual(audio.formatAudioTimestamp(-5), '00:00');
});

const lectureTranscript = audio.normalizeAudioTranscript({
    text: 'Welcome to the lecture today we cover recursion.',
    segments: [
        { start: 0, end: 5, speaker: 'A', text: 'Welcome to the lecture today we cover recursion.' },
        { start: 5.5, end: 9, speaker: 'A', text: 'Recursion needs a base case.' },
        { start: 16, end: 18, speaker: 'B', text: 'Is that confusing?' }
    ]
});

test('buildAudioStudyPacket merges same-speaker turns and marks long pauses', () => {
    const packet = audio.buildAudioStudyPacket({ name: 'cs101.mp3' }, lectureTranscript);
    const body = packet.content.split('\nTRANSCRIPT\n')[1];
    assert.ok(body.includes('Speaker A: Welcome to the lecture today we cover recursion. Recursion needs a base case.'));
    assert.ok(body.includes('[pause 7s]'));
    assert.ok(body.includes('Speaker B: Is that confusing?'));
});

test('buildAudioStudyPacket auto-detects lectures and puts the protocol before the transcript', () => {
    const packet = audio.buildAudioStudyPacket({ name: 'cs101.mp3' }, lectureTranscript);
    assert.strictEqual(packet.isLecture, true);
    assert.ok(packet.content.includes('LECTURE MODE: ACTIVE'));
    assert.ok(packet.content.indexOf('LECTURE MODE PROTOCOL') < packet.content.indexOf('\nTRANSCRIPT\n'));
    ['Recording and speakers', 'Segment summaries', 'Key concepts', 'Instructor examples', 'Visual examples and useful videos', 'Study guide']
        .forEach(section => assert.ok(packet.content.includes(section), section));
});

test('formatMessageContent separates inline audio headings and preserves readable point lists', () => {
    const formatted = formatter.formatMessageContent(
        'Recording summary --- ## 1. Overview **Topic:** Discovery --- ## 2. Key points\n- Retrieval finds papers\n- The agent applies equations'
    );
    assert.ok(formatted.includes('Recording summary<br><br><strong>1. Overview</strong>'));
    assert.ok(formatted.includes('<strong>Topic:</strong> Discovery'));
    assert.ok(formatted.includes('Key points'));
    assert.ok(formatted.includes('• Retrieval finds papers<br>• The agent applies equations'));
});

test('buildAudioStudyPacket stays in standby for non-lecture audio, and activateLectureMode flips it', () => {
    const plain = audio.normalizeAudioTranscript({ text: 'hello there', segments: [] });
    const packet = audio.buildAudioStudyPacket({ name: 'voice-note.mp3' }, plain);
    assert.strictEqual(packet.isLecture, false);
    assert.ok(packet.content.includes('LECTURE MODE: STANDBY'));
    const activated = audio.activateLectureMode(packet.content);
    assert.ok(activated.includes('LECTURE MODE: ACTIVE (the user said this is a lecture)'));
    assert.ok(!activated.includes('LECTURE MODE: STANDBY'));
});

test('buildAudioStudyPacket marks block boundaries and does not invent speakers', () => {
    const result = {
        transcript: 'First block. Second block.',
        segments: [
            { start: 0, end: 3, speaker: 'Speaker A', text: 'First block.' },
            { start: 3, end: 6, speaker: 'Speaker A', text: 'Second block.', blockStart: 2 }
        ]
    };
    const packet = audio.buildAudioStudyPacket({ name: 'x.mp3' }, result);
    assert.ok(packet.content.includes('audio block 2 begins'));
    assert.ok(packet.content.includes('do not invent speakers'));
});

// ---------- Image generation detection ----------
const artifactsSrc = read('nova_runtime_artifacts.js');
const artifacts = load(slice(artifactsSrc, 'const startedArtifactRequests', 'const IMAGE_MODELS'));
const videoGeneratorSrc = slice(artifactsSrc, 'function videoDurationRequest', 'function resolveVideoArtifactRequest') + slice(artifactsSrc, 'async function generateVideo', 'function showArtifactError');

test('detectRequestedArtifactFormats recognizes image requests', () => {
    ['Nova, generate an image', 'one of the sun', 'draw a bumblebee picture', 'show me a picture of the moon']
        .forEach(text => assert.ok(artifacts.detectRequestedArtifactFormats(text).includes('png'), text));
    assert.ok(artifacts.detectRequestedArtifactFormats('show me a visual example of an inverted pendulum').includes('png'));
});

test('video creation is distinguished from searching for existing videos', () => {
    ['nova create a short video', 'make a short vid', 'generate an MP4 of the moon'].forEach(text =>
        assert.deepStrictEqual([...artifacts.detectRequestedArtifactFormats(text)], ['mp4']));
    assert.deepStrictEqual([...artifacts.detectRequestedArtifactFormats('find useful videos about pendulums')], []);
    assert.deepStrictEqual([...artifacts.detectRequestedArtifactFormats('make a downloadable video')], ['mp4']);
});

test('video clarification uses the answer without triggering unrelated follow-ups', () => {
    const history = [
        { sender: 'user', text: 'make a short vid' },
        { sender: 'Nova', text: 'What theme or focus would you like?' },
        { sender: 'user', text: 'something funny' },
        { sender: 'Nova', text: 'I will prepare that.' }
    ];
    assert.strictEqual(artifacts.resolveVideoArtifactRequest(history[0].text, history[1].text, history.slice(0, 2)), null);
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('something funny', history[3].text, history),
        'make a short vid\n\nVideo idea: something funny');
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('something funny', 'What scene would you like?', history), null);
    for (const text of ['cancel', 'what is the weather?', 'tell me a joke', 'thanks']) {
        const turns = history.slice(0, 2).concat([{ sender: 'user', text }, { sender: 'Nova', text: 'Certainly.' }]);
        assert.strictEqual(artifacts.resolveVideoArtifactRequest(text, 'Certainly.', turns), null);
    }
    const unrelated = [{ sender: 'user', text: 'hello' }, history[1], history[2], history[3]];
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('something funny', history[3].text, unrelated), null);
});

test('longer follow-up uses a recent successful video without losing its subject', () => {
    const original = 'nova, generate a short funny video';
    const history = [
        { sender: 'user', text: original, videoArtifact: { prompt: original, numFrames: 81 } },
        { sender: 'Nova', text: 'I will attempt the video.' },
        { sender: 'user', text: 'a longer one' }
    ];
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('a longer one', '', history), `${original}\n\nNew video duration request: a longer one (10 seconds)`);
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('a longer one', '', history.map(({videoArtifact, ...item}) => item)), null);
    history[0].videoArtifact.numFrames = 161;
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('a longer one', '', history), `${original}\n\nNew video duration request: a longer one (20 seconds)`);
    history[0].videoArtifact.numFrames = 81;
    history.splice(2, 0, { sender: 'user', text: 'tell me a joke' }, { sender: 'Nova', text: 'Sure.' });
    assert.strictEqual(artifacts.resolveVideoArtifactRequest('a longer one', '', history), `${original}\n\nNew video duration request: a longer one (10 seconds)`);
});

test('longer videos submit 161 frames without changing the default short video', async () => {
    for (const [prompt, frames] of [['make a funny video', 81], ['make a longer video', 161], ['make a 10-second video', 161]]) {
        const calls = [];
        const sandbox = load(videoGeneratorSrc, {
            URL, sessionStorage: { getItem: () => 'test-key' }, setTimeout: fn => fn(),
            fetch: async (_url, options) => {
                const body = JSON.parse(options.body);
                calls.push(body);
                const payload = body.action === 'create' ? { request_id: '764cabcf-b745-4b3e-ae38-1200304cf45b' }
                    : body.action === 'status' ? { status: 'COMPLETED' } : { video: { url: 'https://storage.example/video.mp4' } };
                return { ok: true, json: async () => payload };
            }
        });
        const result = await sandbox.generateVideo(prompt, { querySelector: () => ({}) });
        assert.strictEqual(calls[0].num_frames, frames);
        assert.strictEqual(result.numFrames, frames);
    }
});

test('natural duration requests and follow-ups keep the requested length', () => {
    for (const [text, expected] of [
        ['generate a 20 second video about earth', 20],
        ['make it twenty seconds long', 20],
        ['generate one thats 10 seconds actually', 10],
        ['thats only 5 seconds, make it 20', 20],
        ['make a video lasting half a minute', 30],
        ['make it longer', 10]
    ]) assert.strictEqual(artifacts.videoDurationRequest(text), expected, text);
    const history = [
        { sender: 'user', text: 'generate a 10 second video about earth', videoArtifact: { prompt: 'generate a 10 second video about earth', numFrames: 161 } },
        { sender: 'Nova', text: 'Done.' },
        { sender: 'user', text: 'thats a great vid there' },
        { sender: 'Nova', text: 'Thank you.' },
        { sender: 'user', text: 'make one thats 20 seconds' }
    ];
    const resolved = artifacts.resolveVideoArtifactRequest(history[4].text, '', history);
    assert.ok(resolved.includes('about earth'));
    assert.strictEqual(artifacts.videoDurationRequest(resolved), 20);
});

test('20-second requests submit once to the long model after confirmation and poll that model', async () => {
    const calls = [];
    const confirms = [];
    const sandbox = load(videoGeneratorSrc, {
        URL, window: { confirm: message => { confirms.push(message); return true; } },
        sessionStorage: { getItem: () => 'test-key' }, setTimeout: fn => fn(),
        fetch: async (_url, options) => {
            const body = JSON.parse(options.body); calls.push(body);
            return { ok: true, json: async () => body.action === 'create'
                ? { request_id: '764cabcf-b745-4b3e-ae38-1200304cf45b' }
                : body.action === 'status' ? { status: 'COMPLETED' } : { video: { url: 'https://storage.example/v.mp4' } } };
        }
    });
    const result = await sandbox.generateVideo('generate a 20 second video about earth', { querySelector: () => ({}) });
    assert.strictEqual(result.duration, 20);
    assert.strictEqual(calls[0].duration, 20);
    assert.deepStrictEqual(calls.map(call => call.model), ['ltx', 'ltx', 'ltx']);
    assert.ok(confirms[0].includes('$1.20'));
});

test('unsupported and declined durations do not submit a provider request', async () => {
    for (const [prompt, confirm] of [['make a 30 second video', true], ['make a 15 second video', true], ['make a 20 second video', false]]) {
        let calls = 0;
        const sandbox = load(videoGeneratorSrc, {
            window: { confirm: () => confirm }, sessionStorage: { getItem: () => 'test-key' },
            fetch: async () => { calls++; }
        });
        await assert.rejects(sandbox.generateVideo(prompt, {}), /no job was submitted/i);
        assert.strictEqual(calls, 0);
    }
});

test('download reports measured duration and warns when provider returns a short clip', () => {
    const listeners = {};
    const status = {};
    const video = { duration: 5.1, addEventListener: (name, fn) => { listeners[name] = fn; } };
    const item = { querySelector: selector => selector === 'video' ? video : status };
    const list = { appendChild() {} };
    const card = { querySelector: () => list, setAttribute: (name, value) => { card[name] = value; } };
    const sandbox = load(slice(artifactsSrc, 'function addArtifactDownload', 'async function generateVideo'), {
        document: { createElement: () => item }, xmlEscape: value => value
    });
    sandbox.addArtifactDownload(card, { url: 'https://storage.example/v.mp4', extension: 'mp4', duration: 20 }, 'earth.mp4');
    listeners.loadedmetadata();
    assert.ok(status.textContent.includes('5.1s (requested 20s)'));
    assert.ok(status.textContent.includes('different duration'));
    assert.strictEqual(card.role, 'alert');
});

test('descriptive video requests expand the tone while respecting specific prompts', async () => {
    const expectations = [
        ['generate a funny video', 'visual gag', 'Suggested scene: '],
        ['nova, generate a short funny video', 'visual gag', 'Suggested scene: '],
        ['generate a funny video not just someone laughing', 'visual gag', 'Suggested scene: '],
        ["create a short video that's funny", 'visual gag', 'Suggested scene: '],
        ['make a short vid\n\nVideo idea: something funny', 'visual gag', 'Suggested scene: '],
        ['make a scary video', 'suspense', 'Suggested scene: In a dim hallway'],
        ['make an epic video', 'scale and dramatic momentum', 'Suggested scene: A lone traveler'],
        ['make a chaotic video', 'escalating chaos', 'Suggested scene: A gust'],
        ['make a sad video', 'poignant visual moment', 'Suggested scene: A small paper boat'],
        ['make a wholesome video', 'kind action', 'Suggested scene: A small robot'],
        ['make a funny video of a cat wearing a red hat, no robots', 'visual gag', null],
        ['make a funny video of a person laughing and smiling', 'visual gag', null],
        ['make a funny video not just someone laughing, no robots', 'visual gag', null],
        ['make a video of a cat that is not scary', null, null],
        ['create a short video of a moon', null, null]
    ];
    for (const [prompt, direction, scene] of expectations) {
        const calls = [];
        const sandbox = load(videoGeneratorSrc, {
            URL, sessionStorage: { getItem: () => 'test-key' }, setTimeout: fn => fn(),
            fetch: async (_url, options) => {
                const body = JSON.parse(options.body);
                calls.push(body);
                const payload = body.action === 'create' ? { request_id: '764cabcf-b745-4b3e-ae38-1200304cf45b' }
                    : body.action === 'status' ? { status: 'COMPLETED' } : { video: { url: 'https://storage.example/video.mp4' } };
                return { ok: true, json: async () => payload };
            }
        });
        await sandbox.generateVideo(prompt, { querySelector: () => ({}) });
        const sent = calls[0].prompt;
        assert.ok(sent.startsWith(prompt), prompt);
        assert.strictEqual(direction ? sent.includes(direction) : sent.includes('Creative direction:'), !!direction, prompt);
        assert.strictEqual(sent.includes('Suggested scene:'), !!scene, prompt);
        if (scene) assert.ok(sent.includes(scene), prompt);
        if (direction === 'visual gag') {
            assert.ok(sent.includes('Do not rely on laughter, smiling or reactions alone'));
            assert.ok(sent.includes('retain any expressions the user explicitly requests'));
        }
        assert.ok(sent.length <= 12000);
    }
});

test('video prompt rejects requests too long to preserve along with the creative direction', async () => {
    let called = false;
    const sandbox = load(videoGeneratorSrc, {
        sessionStorage: { getItem: () => 'test-key' },
        fetch: async () => { called = true; throw new Error('unexpected submission'); }
    });
    await assert.rejects(sandbox.generateVideo(`make a funny video ${'x'.repeat(11990)} do not use robots`, {}),
        /too long to include its creative direction/);
    assert.strictEqual(called, false);
});

test('artifact deduplication is scoped to the user turn, not the chat position', async () => {
    const history = [{ sender: 'user', text: 'make a funny video' }, { sender: 'Nova', text: 'Starting.' }];
    const cards = [];
    const sandbox = load(artifactsSrc, {
        chatHistory: history,
        document: { getElementById: () => ({ appendChild: card => cards.push(card), scrollHeight: 0 }),
            createElement: () => ({ setAttribute() {} }) },
        showNotification() {}
    });
    sandbox.mockVideo = () => new Promise(() => {});
    vm.runInContext('generateVideo = mockVideo;', sandbox);
    sandbox.window.maybeCreateRequestedArtifact('make a funny video', 'Starting.');
    sandbox.window.maybeCreateRequestedArtifact('make a funny video', 'Starting.');
    assert.strictEqual(cards.length, 1);
    sandbox.chatHistory = [{ sender: 'user', text: 'make a funny video' }, { sender: 'Nova', text: 'Starting.' }];
    sandbox.window.maybeCreateRequestedArtifact('make a funny video', 'Starting.');
    assert.strictEqual(cards.length, 2);
});

test('completed video enables a single contextual longer follow-up after chat failure', async () => {
    const original = 'nova, generate a short funny video';
    const history = [{ sender: 'user', text: original }, { sender: 'Nova', text: 'Starting.' }];
    const prompts = [];
    const sandbox = load(artifactsSrc, {
        chatHistory: history,
        document: { getElementById: () => ({ appendChild() {}, scrollHeight: 0 }),
            createElement: () => ({ setAttribute() {} }) },
        showNotification() {}
    });
    sandbox.mockVideo = async prompt => {
        prompts.push(prompt);
        return { url: 'https://storage.example/video.mp4', extension: 'mp4', numFrames: prompt.includes('longer') ? 161 : 81 };
    };
    vm.runInContext('generateVideo = mockVideo; addArtifactDownload = () => {};', sandbox);
    sandbox.window.maybeCreateRequestedArtifact(original, 'Starting.');
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(history[0].videoArtifact.numFrames, 81);
    history.push({ sender: 'user', text: 'a longer one' }, { sender: 'Nova', text: 'Starting.' });
    sandbox.window.maybeCreateRequestedArtifact('a longer one', 'Starting.');
    sandbox.window.maybeCreateRequestedArtifact('a longer one', 'Starting.');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepStrictEqual(prompts, [original, `${original}\n\nNew video duration request: a longer one (10 seconds)`]);
    assert.strictEqual(history[2].videoArtifact.numFrames, 161);
});

test('video clarification starts one job and immediately shows a generating status', async () => {
    const cards = [];
    const requests = [];
    const chat = { appendChild: card => cards.push(card), scrollHeight: 1 };
    const history = [
        { sender: 'user', text: 'make a short vid' },
        { sender: 'Nova', text: 'What theme would you like?' },
        { sender: 'user', text: 'something funny' },
        { sender: 'Nova', text: 'One moment.' }
    ];
    const sandbox = load(artifactsSrc, {
        chatHistory: history,
        document: {
            getElementById: () => chat,
            createElement: () => ({ setAttribute() {}, querySelector: () => ({}) })
        },
        sessionStorage: { getItem: () => 'test-key' },
        fetch: (_url, options) => {
            requests.push(JSON.parse(options.body));
            return new Promise(() => {});
        }
    });
    sandbox.window.maybeCreateRequestedArtifact('something funny', 'One moment.');
    sandbox.window.maybeCreateRequestedArtifact('something funny', 'One moment.');
    assert.strictEqual(cards.length, 1);
    assert.ok(cards[0].innerHTML.includes('Generating video'));
    assert.ok(cards[0].innerHTML.includes('several minutes'));
    assert.strictEqual(requests.length, 1);
    assert.ok(requests[0].prompt.startsWith('make a short vid\n\nVideo idea: something funny'));
    assert.ok(requests[0].prompt.includes('visual gag'));
});

test('video-only requests can start when the chat proxy is out of credits', async () => {
    const source = read('nova_runtime_ai.js');
    const messages = [];
    const requests = [];
    const history = [{ sender: 'user', text: 'nova, generate a short funny video' }];
    const sandbox = load(slice(source, 'function isAreYouUpCheck', 'async function _retryWithJinaFallback'), {
        chatHistory: history,
        conversationHistory: [],
        detectRequestedArtifactFormats: artifacts.detectRequestedArtifactFormats,
        resolveVideoArtifactRequest: artifacts.resolveVideoArtifactRequest,
        getSlyTriggeredReply: () => null,
        isAvonIdentityRequest: () => false,
        isCurrentTimeRequest: () => false,
        isPromptLimitErrorMessage: () => false,
        OPENROUTER_API_KEY: '', OPENAI_API_KEY: '',
        generateViaServerProxy: async () => { throw new Error('429 insufficient_quota'); },
        removeThinkingIndicator() {},
        addMessage: (text, sender) => { messages.push(text); history.push({ text, sender }); }
    });
    sandbox.window.maybeCreateRequestedArtifact = (text, reply) => requests.push({ text, reply });
    await sandbox.generateAIResponse(history[0].text, 'Nova', { assistant: 'nova' });
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].text, history[0].text);
    assert.ok(messages[0].includes('chat service is unavailable'));
    assert.strictEqual(sandbox.conversationHistory.length, 1);
});

test('chat failure video fallback excludes searches, mixed formats, and proactive requests', () => {
    const source = read('nova_runtime_ai.js');
    const requests = [];
    const sandbox = load(slice(source, 'function tryVideoAfterChatFailure', '// Enhanced AI integration'), {
        chatHistory: [], conversationHistory: [],
        detectRequestedArtifactFormats: artifacts.detectRequestedArtifactFormats,
        resolveVideoArtifactRequest: artifacts.resolveVideoArtifactRequest,
        removeThinkingIndicator() {},
        addMessage() {}
    });
    sandbox.window.maybeCreateRequestedArtifact = (...args) => requests.push(args);
    for (const text of ['find videos about cats', 'make a video and a pdf']) {
        assert.strictEqual(sandbox.tryVideoAfterChatFailure(text, 'Nova', 'Nova', {}), false);
    }
    assert.strictEqual(sandbox.tryVideoAfterChatFailure('make a video', 'Nova', 'Nova', { proactiveEvaluation: true }), false);
    assert.strictEqual(requests.length, 0);
    sandbox.chatHistory.push(
        { sender: 'user', text: 'make a video' },
        { sender: 'Avon', text: 'What theme would you like?' },
        { sender: 'user', text: 'something funny' }
    );
    assert.strictEqual(sandbox.tryVideoAfterChatFailure('something funny', 'Nova', 'Avon', {}), true);
    assert.strictEqual(requests.length, 1);
});

test('video generation submits, polls, and returns a playable provider URL', async () => {
    const calls = [];
    const id = '764cabcf-b745-4b3e-ae38-1200304cf45b';
    const sandbox = load(videoGeneratorSrc, {
        URL, sessionStorage: { getItem: () => 'test-key' },
        setTimeout: fn => fn(),
        fetch: async (_url, options) => {
            const body = JSON.parse(options.body);
            calls.push(body);
            const payload = body.action === 'create' ? { request_id: id }
                : body.action === 'status' ? { status: calls.length === 2 ? 'IN_QUEUE' : 'COMPLETED' }
                : { video: { url: 'https://storage.example/video.mp4' } };
            return { ok: true, json: async () => payload };
        }
    });
    const label = {};
    const result = await sandbox.generateVideo('create a short video of a moon', { querySelector: () => label });
    assert.strictEqual(result.url, 'https://storage.example/video.mp4');
    assert.deepStrictEqual(calls.map(call => call.action), ['create', 'status', 'status', 'result']);
    assert.strictEqual(calls[0].prompt, 'create a short video of a moon');
});

test('video generation reports missing keys and provider failures', async () => {
    const missing = load(videoGeneratorSrc, {
        sessionStorage: { getItem: () => null }
    });
    await assert.rejects(missing.generateVideo('create a video', {}), /fal.ai video API key/);
    const failing = load(videoGeneratorSrc, {
        sessionStorage: { getItem: () => 'test-key' },
        fetch: async () => ({ ok: false, status: 402, json: async () => ({ error: 'No credits' }) })
    });
    await assert.rejects(failing.generateVideo('create a video', {}), /No credits/);
});

test('ambiguous video submissions warn before retrying', async () => {
    for (const fetch of [
        async () => { throw new TypeError('network failure'); },
        async () => ({ ok: true, status: 200, json: async () => ({}) })
    ]) {
        const sandbox = load(videoGeneratorSrc, {
            sessionStorage: { getItem: () => 'test-key' }, fetch
        });
        await assert.rejects(sandbox.generateVideo('create a video', {}), /check fal\.ai before retrying/i);
    }
});

test('video errors retain the job ID after submission', async () => {
    const id = '764cabcf-b745-4b3e-ae38-1200304cf45b';
    const label = {};
    const sandbox = load(videoGeneratorSrc, {
        URL, sessionStorage: { getItem: () => 'test-key' }, setTimeout: fn => fn(),
        fetch: async (_url, options) => {
            const action = JSON.parse(options.body).action;
            return { ok: true, json: async () => action === 'create' ? { request_id: id }
                : action === 'status' ? { status: 'COMPLETED' } : {} };
        }
    });
    await assert.rejects(sandbox.generateVideo('create a video', { querySelector: () => label }),
        error => error.message.includes(id) && /check fal\.ai/i.test(error.message));
    assert.ok(label.textContent.includes(id));
});

test('video generation reports empty and non-JSON endpoint failures with their HTTP status', async () => {
    for (const status of [404, 405, 500, 200]) {
        const sandbox = load(videoGeneratorSrc, {
            sessionStorage: { getItem: () => 'test-key' },
            fetch: async () => ({
                ok: status === 200,
                status,
                json: async () => { throw new SyntaxError('Unexpected end of JSON input'); }
            }),
            SyntaxError
        });
        await assert.rejects(sandbox.generateVideo('create a video', {}), error => {
            assert.ok(error.message.includes(`HTTP ${status}`));
            if (status === 404 || status === 405) assert.ok(error.message.includes('restart the AI5 dev server'));
            else assert.ok(error.message.includes('check fal.ai before retrying'));
            return true;
        });
    }
});

test('video generation settings and creation intent are available across AI5 pages', () => {
    ['AI_v5_nova.html', 'AI_v5_JARVIS.html', 'AI_v5_JARVIS_CLEAN.html'].forEach(page => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
        assert.ok(html.includes('id="falVideoApiKey"'), page);
        const artifactScript = html.indexOf('<script src="../scripts/nova_runtime_artifacts.js"></script>');
        assert.ok(artifactScript >= 0 && artifactScript < html.indexOf('<script src="../scripts/nova_runtime_ai.js"></script>'),
            `${page}: artifact generation must load before the AI runtime`);
        const apiStyle = id => html.match(new RegExp(`<input[^>]*id="${id}"[^>]*style="([^"]+)"`))?.[1];
        assert.ok(apiStyle('falVideoApiKey'), `${page}: video key input has styling`);
        assert.strictEqual(apiStyle('falVideoApiKey'), apiStyle('openaiApiKey'), `${page}: video key matches other API inputs`);
    });
    const sources = `${slice(read('nova_runtime_ai.js'), 'const _WEB_URL_RE', 'function prepareOpenAIMessages')}`;
    const tools = load(sources, { detectRequestedArtifactFormats: artifacts.detectRequestedArtifactFormats, persistentMaterial: [] });
    assert.strictEqual(tools._resolveWebIntent('make a downloadable video tutorial'), null);
    assert.strictEqual(tools._resolveWebIntent('find videos about sunsets').type, 'search');
});

test('detectRequestedArtifactFormats handles documents and ignores normal chat', () => {
    assert.deepStrictEqual([...artifacts.detectRequestedArtifactFormats('make a pdf of this')], ['pdf']);
    ['how are you', 'what is the weather', 'tell me about the sun'].forEach(text =>
        assert.deepStrictEqual([...artifacts.detectRequestedArtifactFormats(text)], [], text));
});

test('normalizeImageReply replaces refusals only for image requests', () => {
    assert.strictEqual(artifacts.normalizeImageReply('one of the sun', "I'm afraid generating images isn't within my current capabilities."),
        'Right away. Generating your image now.');
    const good = 'Absolutely, here it is.';
    assert.strictEqual(artifacts.normalizeImageReply('one of the sun', good), good);
    const refusal = "I can't generate images of that.";
    assert.strictEqual(artifacts.normalizeImageReply('what is the sun', refusal), refusal);
});

// ---------- "You up?" check and task offers ----------
const aiSrc = read('nova_runtime_ai.js');
const ai = load(slice(aiSrc, 'function isAreYouUpCheck', '// Enhanced AI integration'));
const webTools = load(`${slice(aiSrc, 'const _WEB_URL_RE', 'function prepareOpenAIMessages')}\n${slice(aiSrc, 'function buildWebTaskMessage', 'function extractResponseText')}`, {
    persistentMaterial: [],
    shortResponseModeEnabled: false
});
const mainSrc = read('nova_main.js');

test('isAreYouUpCheck matches the greeting forms only', () => {
    ['Nova you up?', 'Avon, you up', 'hey nova are you up?', 'you up?', 'A.V.O.N., are you up'].forEach(text =>
        assert.strictEqual(ai.isAreYouUpCheck(text), true, text));
    ['what is up', 'Nova, are you up for a story', 'you upgrade it', 'hello'].forEach(text =>
        assert.strictEqual(ai.isAreYouUpCheck(text), false, text));
});

test('prompt carries task-offer and you-up guidance and the reply is not hardcoded', () => {
    assert.ok(aiSrc.includes('const solutionOfferNote'));
    assert.ok(aiSrc.includes('Never claim something was stored or sent unless it actually was'));
    assert.ok(aiSrc.includes('options.youUpCheck'));
    assert.ok(!aiSrc.includes("'For you sir, always.'"), 'reply must come from the model, not a fixed string');
});

test('audio video requests search for links grounded in the uploaded transcript', () => {
    const packet = 'AUDIO ANALYSIS PACKET\nWhen the user asks for video resources, explain this clearly.\nTRANSCRIPT\nSpeaker A: Inverted pendulum control keeps a rod upright.\nEND AUDIO ANALYSIS PACKET';
    assert.strictEqual(webTools._resolveWebIntent(`${packet}\n\nGo over recording`), null);
    assert.ok(!webTools.buildWebTaskMessage(`${packet}\n\nGo over recording`).includes('actual watchable videos'));
    const intent = webTools._detectWebIntent(
        `${packet}\n\nFind relevant videos for this recording`
    );
    assert.strictEqual(intent.type, 'search');
    assert.ok(intent.query.includes('educational video tutorial'));
    assert.ok(intent.query.includes('Inverted pendulum control'));
    const videoPrompt = webTools.buildWebTaskMessage(`${packet}\n\nFind relevant videos for this recording`, 'YouTube result URL: https://www.youtube.com/watch?v=example');
    assert.ok(videoPrompt.includes('actual watchable videos'));
    assert.ok(videoPrompt.includes('direct verified video-page link'));
    assert.ok(aiSrc.includes('the app can submit a video-generation job'));
});

test('Sly personality guides occasional, understated, mischievous wit for Nova and Avon', () => {
    const slyInstructions = mainSrc.match(/sly:\s*\{\s*name:\s*'Sly',\s*instructions:\s*'([^']+)'/);
    assert.ok(slyInstructions, 'Sly personality instructions should exist');
    assert.ok(slyInstructions[1].includes('Let intelligent, understated wit surface naturally'));
    assert.ok(slyInstructions[1].includes('a gentle tease, or a sly implication'));
    assert.ok(slyInstructions[1].includes('do not add sass to every reply'));
    assert.ok(slyInstructions[1].includes('never cruel'));
});

// ---------- AI Vision ----------
function makeFakeElement() {
    const handlers = {};
    const el = {
        id: '',
        className: '',
        hidden: false,
        style: {},
        classList: { contains: () => false, toggle() {} },
        addEventListener: (type, fn) => { (handlers[type] = handlers[type] || []).push(fn); },
        setPointerCapture() {},
        insertAdjacentHTML() {},
        appendChild() {},
        getBoundingClientRect() {
            const px = key => parseFloat(el.style[key]) || 0;
            const width = px('width') || 168;
            return { left: px('left'), top: px('top'), width, height: width * 0.75 };
        },
        fire(type, event) { (handlers[type] || []).forEach(fn => fn({ preventDefault() {}, button: 0, target: el, ...event })); }
    };
    return el;
}

function loadVision() {
    const preview = makeFakeElement();
    const windowStub = { innerWidth: 1000, innerHeight: 800, addEventListener() {} };
    const sandbox = load(read('nova_runtime_vision.js'), {
        window: windowStub,
        document: {
            getElementById: () => null,
            createElement: () => preview,
            body: { appendChild() {} },
            addEventListener() {}
        },
        showNotification() {},
        navigator: {}
    });
    return { sandbox, preview, windowStub };
}

test('AI Vision is off by default and returns no frame', () => {
    const { windowStub } = loadVision();
    assert.strictEqual(windowStub.isAiVisionActive(), false);
    assert.strictEqual(windowStub.getVisionFrame(), null);
    assert.strictEqual(typeof windowStub.getVisionSignature, 'function');
});

test('AI Vision hover text matches the spec', () => {
    assert.ok(read('nova_runtime_vision.js').includes("'Allow AI5 to see through your camera for visual assistance.'"));
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'AI_v5_JARVIS.html'), 'utf8');
    assert.ok(html.includes('id="aiVisionBtn"') && html.includes('nova_runtime_vision.js'));
});

test('AI Vision preview can be dragged and stays on screen', () => {
    const { sandbox, preview } = loadVision();
    sandbox.ensureAiVisionPreview();
    preview.style.left = '100px';
    preview.style.top = '100px';
    preview.fire('pointerdown', { pointerId: 1, clientX: 110, clientY: 110 });
    preview.fire('pointermove', { pointerId: 1, clientX: 210, clientY: 160 });
    assert.strictEqual(preview.style.left, '200px');
    assert.strictEqual(preview.style.top, '150px');
    preview.fire('pointermove', { pointerId: 1, clientX: 5000, clientY: 5000 });
    assert.ok(parseFloat(preview.style.left) <= 1000 - 168, 'clamped to the right edge');
    assert.ok(parseFloat(preview.style.top) + 168 * 0.75 <= 800.01, 'clamped to the bottom edge');
    preview.fire('pointerup', { pointerId: 1 });
});

test('AI Vision preview resizes from the corner handle within limits', () => {
    const { sandbox, preview } = loadVision();
    sandbox.ensureAiVisionPreview();
    preview.style.left = '100px';
    preview.style.top = '100px';
    const handle = { classList: { contains: name => name === 'ai-vision-resize' } };
    preview.fire('pointerdown', { pointerId: 1, clientX: 268, clientY: 200, target: handle });
    preview.fire('pointermove', { pointerId: 1, clientX: 368, clientY: 200 });
    assert.strictEqual(preview.style.width, '268px');
    preview.fire('pointermove', { pointerId: 1, clientX: -500, clientY: 200 });
    assert.strictEqual(preview.style.width, '100px', 'minimum width');
    preview.fire('pointerup', { pointerId: 1 });
});

test('AI Vision preview pinch-resizes with two fingers', () => {
    const { sandbox, preview } = loadVision();
    sandbox.ensureAiVisionPreview();
    preview.style.left = '100px';
    preview.style.top = '100px';
    preview.fire('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 });
    preview.fire('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 });
    preview.fire('pointermove', { pointerId: 2, clientX: 300, clientY: 100 });
    assert.strictEqual(preview.style.width, '336px', 'pinch distance doubled -> width doubled');
    preview.fire('pointerup', { pointerId: 1 });
    preview.fire('pointerup', { pointerId: 2 });
});

// ---------- Auto Mode + screen share timing ----------
const flowSrc = read('nova_conversation_flow.js');
const flow = load(slice(flowSrc, '// Auto Mode coordinates screen', 'async function runAutoModeLoop'), {
    document: { addEventListener() {} },
    setTimeout,
    clearTimeout
});

test('Auto Mode timing adapts to screen motion', () => {
    const low = flow.getAutoModeTiming(0.005);
    const high = flow.getAutoModeTiming(0.1);
    assert.strictEqual(low.level, 'low');
    assert.strictEqual(high.level, 'high');
    assert.ok(low.minChange < high.minChange, 'quiet screens react to smaller changes');
    assert.ok(low.quietPolls < high.quietPolls, 'busy screens must settle longer');
    assert.ok(low.cooldownMs < high.cooldownMs);
    assert.strictEqual(flow.getAutoModeTiming(0.03).level, 'medium');
});

test('shared proactive gate allows one evaluation at a time and spaces remarks', () => {
    const gate = flow.window.proactiveGate;
    assert.strictEqual(gate.canStart(), true);
    assert.strictEqual(gate.begin(), true);
    assert.strictEqual(gate.begin(), false, 'second feature cannot start while one is running');
    assert.strictEqual(gate.canStart(), false);
    gate.end(true);
    assert.strictEqual(gate.canStart(), false, 'cooldown after speaking');
    assert.strictEqual(gate.canStart(Date.now() + gate.MIN_GAP_MS + 1), true);
    gate.lastSpokeAt = 0;
    gate.begin();
    gate.end(false);
    assert.strictEqual(gate.canStart(), true, 'a silent check does not start a cooldown');
});

test('isRepeatedRemark blocks rephrased repeats but allows new remarks', () => {
    const recent = ['That error says the variable is undefined on line forty.'];
    assert.strictEqual(flow.isRepeatedRemark('The error says the variable is undefined on line forty.', recent), true);
    assert.strictEqual(flow.isRepeatedRemark('Your build finished with no warnings.', recent), false);
    assert.strictEqual(flow.isRepeatedRemark('anything', []), false);
});

test('Auto Mode coordinates screen and camera through one proactive gate', () => {
    assert.ok(flowSrc.includes('window.proactiveGate.begin()') && flowSrc.includes('window.proactiveGate.end(spoke)'));
    assert.ok(flowSrc.includes('window.getScreenShareSignature?.(assistant)'));
    assert.ok(flowSrc.includes('window.getVisionSignature?.()'));
    const visionSrc = read('nova_runtime_vision.js');
    assert.ok(!visionSrc.includes('runAiVisionLoop'), 'camera vision should not launch a separate evaluator');
    assert.ok(visionSrc.includes('window.watchAutoModeVideoFrames?.(aiVisionVideo)'));
    assert.ok(flowSrc.includes('reading, coding, watching, working, studying, troubleshooting, stuck, or inactive'));
});

test('Auto Mode prompt treats stillness as ambiguous and retains recent visual context', () => {
    assert.ok(flowSrc.includes('A static screen alone does not mean the user is inactive'));
    assert.ok(flowSrc.includes('autoModeVisualMemory.filter(item => Date.now() - item.at >= 3000).slice(-2)'));
    assert.ok(flowSrc.includes('window.getAutoModeVisualContext ='));
    assert.ok(flowSrc.includes('activeMotionReviewDue'));
    assert.ok(read('nova_runtime_ai.js').includes('options.autoModeEvaluation'));
});

test('video moment parsing keeps protocol labels out of chat and rejects malformed moments', () => {
    const moment = flow.parseAutoModeVideoMoment('REWIND: Wait, go back to the diagram.\nPOINT: The arrows show the direction of energy flow.');
    assert.strictEqual(moment.remark, 'Wait, go back to the diagram.');
    assert.strictEqual(moment.point, 'The arrows show the direction of energy flow.');
    assert.strictEqual(flow.parseAutoModeVideoMoment('A normal reaction.').remark, 'A normal reaction.');
    assert.strictEqual(flow.parseAutoModeVideoMoment('REWIND: Go back.\nPOINT:').remark, '');
    assert.ok(flowSrc.includes('frame ages are wall-clock ages, not video positions'));
    assert.ok(read('nova_runtime_ai.js').includes('REWIND/POINT two-line format'));
});

test('a reply to a rewind suggestion receives the unsaid point as context', () => {
    const ai = read('nova_runtime_ai.js');
    const block = slice(ai, '    const lastVideoSuggestion =', '    const styleReminder =');
    const sandbox = load(`
        let options = {}, isAvon = false, conversationHistory = [
            { role: 'assistant', content: 'Go back to the diagram.', videoMomentPoint: 'The arrows show energy flow' },
            { role: 'user', content: 'I went back, why?' }
        ];
        ${block}
        window.note = videoMomentNote;
    `, { window: { getScreenShareTarget: () => 'nova' } });
    assert.ok(sandbox.window.note.includes('The arrows show energy flow'));
    assert.ok(sandbox.window.note.includes('not necessarily been said yet'));
    assert.ok(sandbox.window.note.includes('do not assume they rewound'));
    const restricted = load(`
        let options = {}, isAvon = true, conversationHistory = [
            { role: 'assistant', videoMomentPoint: 'Private shared screen content' }
        ];
        ${block}
        window.note = videoMomentNote;
    `, { window: { getScreenShareTarget: () => 'nova' } });
    assert.strictEqual(restricted.window.note, '');
});

test('video points follow rewind suggestions without assuming a seek and respect cancellation', async () => {
    for (const scenario of ['ignored', 'rewound', 'busy', 'user-replied', 'chat-reset', 'snoozed', 'share-stopped', 'auto-stopped']) {
        let now = 100000, polls = 0, evaluations = 0;
        const messages = [];
        const history = [];
        class Clock extends Date { static now() { return now; } }
        const windowStub = {
            getScreenShareTarget: () => 'both',
            getScreenShareSignature: () => new Uint8Array(32 * 18 * 3),
            getScreenShareFrame: () => 'frame',
            isAiVisionActive: () => false,
            isSpeechOutputBusy: () => scenario === 'busy' && polls >= 5 && polls < 30
        };
        let sandbox;
        sandbox = load(slice(flowSrc, '// Auto Mode coordinates screen', 'function toggleAutoMode()'), {
            Date: Clock, window: windowStub,
            document: { hidden: true, addEventListener() {}, getElementById: () => ({ value: '' }) },
            setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {} },
            screenShareStream: {}, screenShareVideo: null,
            groupChatEnabled: false, mutedGroupAssistant: 'both',
            currentPersonality: 'Nova', isResponseInFlight: false,
            conversationHistory: history, getLastAssistantMessage: () => null,
            generateAIResponse: async () => {
                evaluations++;
                return { reply: evaluations === 1
                    ? 'REWIND: Wait, go back to the diagram.\nPOINT: The arrows show the direction of energy flow.'
                    : 'NO_ACTION', model: 'test-model' };
            },
            addMessage: (text, sender) => messages.push({ text, sender }),
            speakAssistantResponse() {}
        });
        sandbox.tick = () => {
            now += 1000;
            polls++;
            if (polls === 5) {
                if (scenario === 'rewound') sandbox.noteAutoModeUserActivity();
                if (scenario === 'user-replied') history.push({ role: 'user', content: 'Why?' });
                if (scenario === 'chat-reset') sandbox.conversationHistory = [];
                if (scenario === 'snoozed') windowStub.proactiveGate.snooze(60000);
                if (scenario === 'share-stopped') sandbox.screenShareStream = null;
                if (scenario === 'auto-stopped') vm.runInContext('autoModeActive = false', sandbox);
            }
            if (polls > 35) vm.runInContext('autoModeActive = false', sandbox);
        };
        vm.runInContext(`
            autoModeActive = true; autoModeRunId = 1;
            runAutoModeCheckIn = async () => false;
            waitForAutoModeSample = async () => { tick(); };
        `, sandbox);
        await sandbox.runAutoModeLoop(1);
        assert.strictEqual(messages[0].text, 'Wait, go back to the diagram.', scenario);
        assert.strictEqual(messages.length, ['ignored', 'rewound', 'busy'].includes(scenario) ? 2 : 1, scenario);
        if (messages.length === 2) {
            assert.strictEqual(messages[1].text, 'The arrows show the direction of energy flow.', scenario);
            assert.strictEqual(history[1].content, messages[1].text, scenario);
            assert.strictEqual(history[0].videoMomentPoint, undefined, scenario);
        }
        if (scenario === 'user-replied') assert.ok(history[0].videoMomentPoint, 'retain context for the user response');
    }
});

test('90-second idle check-in always produces a spoken prompt, including NO_ACTION or failed model responses', () => {
    assert.ok(flowSrc.includes('const AUTO_MODE_CHECKIN_IDLE_MS = 90000'));
    assert.strictEqual(
        flow.resolveAutoModeCheckInReply('NO_ACTION'),
        "It's been quiet for a little while. Would you like a hand with anything?"
    );
    assert.strictEqual(
        flow.resolveAutoModeCheckInReply(''),
        "It's been quiet for a little while. Would you like a hand with anything?"
    );
    assert.strictEqual(flow.resolveAutoModeCheckInReply('Would you like to continue?'), 'Would you like to continue?');
    assert.ok(flowSrc.includes('using a brief fallback'));
    assert.ok(read('nova_runtime_ai.js').includes('Do not return NO_ACTION just because the screen is static'));
});

test('ongoing visual activity keeps idle check-ins from interrupting indefinitely', async () => {
    class Clock extends Date { static now() { return 300000; } }
    let evaluations = 0;
    const sandbox = load(slice(flowSrc, '// Auto Mode coordinates screen', 'async function runAutoModeLoop'), {
        Date: Clock,
        document: { hidden: false, addEventListener() {}, getElementById: () => ({ value: '' }) },
        window: { getScreenShareTarget: () => 'both' },
        isResponseInFlight: false,
        generateAIResponse: async () => { evaluations++; return { reply: 'Hello' }; },
        setTimeout, clearTimeout
    });
    const state = { startedAt: 1000, nextEvaluationAt: 0, lastVisualChangeAt: 299000, lastSpokeAt: 0, unanswered: 0 };
    assert.strictEqual(await sandbox.runAutoModeCheckIn(1, state), false);
    assert.strictEqual(evaluations, 0);
    assert.strictEqual(state.nextEvaluationAt, 330000);
});

test('Auto Mode keeps only a short in-memory window of recent visual frames', () => {
    let now = 100000;
    class Clock extends Date { static now() { return now; } }
    let target = 'nova';
    const memory = load(slice(flowSrc, '// Auto Mode coordinates screen', 'async function runAutoModeLoop'), {
        Date: Clock, document: { addEventListener() {} }, setTimeout, clearTimeout
    });
    memory.window.getScreenShareTarget = () => target;
    memory.window.isAiVisionActive = () => true;
    memory.window.getScreenShareFrame = (_assistant, width) => `screen-${width}`;
    memory.window.getVisionFrame = width => `camera-${width}`;
    memory.rememberAutoModeVisualContext('nova');
    now += 1000;
    memory.rememberAutoModeVisualContext('nova');
    now += 4000;
    memory.rememberAutoModeVisualContext('nova');
    now += 5000;
    memory.rememberAutoModeVisualContext('nova');
    const recent = memory.window.getAutoModeVisualContext('nova');
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].screen, 'screen-320');
    assert.strictEqual(recent[0].camera, 'camera-320');
    target = 'both';
    assert.strictEqual(memory.window.getAutoModeVisualContext('other')[0].screen, null, 'do not expose a frame captured for another assistant');
    memory.window.clearAutoModeVisualMemory('screen');
    assert.strictEqual(memory.window.getAutoModeVisualContext('nova')[0].screen, null);
    memory.window.clearAutoModeVisualMemory();
    assert.strictEqual(memory.window.getAutoModeVisualContext('nova').length, 0);
});

test('Auto Mode samples changing shared video in the background without narrating every frame', async () => {
    let now = 100000, polls = 0, evaluations = 0, samples = 0;
    const replies = [];
    class Clock extends Date { static now() { return now; } }
    const windowStub = {
        getScreenShareTarget: () => 'both',
        getScreenShareSignature: () => new Uint8Array(32 * 18 * 3).fill(polls % 2 ? 0 : 15),
        getScreenShareFrame: () => `frame-${++samples}`,
        isAiVisionActive: () => false,
        isSpeaking: false
    };
    const sandbox = load(slice(flowSrc, '// Auto Mode coordinates screen', 'function toggleAutoMode()'), {
        Date: Clock, window: windowStub,
        document: { hidden: true, addEventListener() {}, getElementById: () => ({ value: '' }) },
        setTimeout, clearTimeout, console: { log() {}, error() {} },
        screenShareStream: {}, screenShareVideo: null,
        groupChatEnabled: false, mutedGroupAssistant: 'both',
        currentPersonality: 'Nova', isResponseInFlight: false,
        conversationHistory: [], getLastAssistantMessage: () => null,
        generateAIResponse: async () => {
            evaluations++;
            return { reply: evaluations === 1 ? 'NO_ACTION' : 'That was an unexpected turn.' };
        },
        addMessage: text => replies.push(text), speakAssistantResponse() {}
    });
    vm.runInContext(`
        autoModeActive = true; autoModeRunId = 1;
        runAutoModeCheckIn = async () => false;
        waitForAutoModeSample = async () => { tick(); };
    `, sandbox);
    sandbox.tick = () => {
        now += 1000;
        if (++polls > 75) vm.runInContext('autoModeActive = false', sandbox);
    };
    await sandbox.runAutoModeLoop(1);
    assert.ok(evaluations >= 2, 'continuous motion is periodically evaluated');
    assert.ok(samples > evaluations, 'frames are sampled independently of model evaluations');
    assert.ok(replies.length >= 1 && replies.length <= 2, 'remarks remain selective and spaced');
});

test('Auto Mode discards an in-flight reaction when sharing stops or the user requests quiet', async () => {
    for (const event of ['share-stopped', 'snooze', 'interaction']) {
        let now = 100000, polls = 0, replies = 0, evaluations = 0;
        class Clock extends Date { static now() { return now; } }
        const windowStub = {
            getScreenShareTarget: () => 'both',
            getScreenShareSignature: () => new Uint8Array(32 * 18 * 3),
            getScreenShareFrame: () => 'frame',
            isAiVisionActive: () => false
        };
        let sandbox;
        sandbox = load(slice(flowSrc, '// Auto Mode coordinates screen', 'function toggleAutoMode()'), {
            Date: Clock, window: windowStub,
            document: { hidden: false, addEventListener() {}, getElementById: () => ({ value: '' }) },
            setTimeout, clearTimeout, console: { log() {}, error() {} },
            screenShareStream: {}, screenShareVideo: null,
            groupChatEnabled: false, mutedGroupAssistant: 'both',
            currentPersonality: 'Nova', isResponseInFlight: false,
            conversationHistory: [], getLastAssistantMessage: () => null,
            generateAIResponse: async () => {
                evaluations++;
                if (event === 'share-stopped') sandbox.screenShareStream = null;
                if (event === 'snooze') windowStub.proactiveGate.snooze(60000);
                if (event === 'interaction') sandbox.noteAutoModeUserActivity();
                return { reply: 'A notable moment.' };
            },
            addMessage: () => { replies++; }, speakAssistantResponse() {}
        });
        sandbox.tick = () => {
            now += 1000;
            if (++polls > 3) vm.runInContext('autoModeActive = false', sandbox);
        };
        vm.runInContext(`
            autoModeActive = true; autoModeRunId = 1;
            runAutoModeCheckIn = async () => false;
            waitForAutoModeSample = async () => { tick(); };
        `, sandbox);
        await sandbox.runAutoModeLoop(1);
        assert.strictEqual(evaluations, 1, `${event}: a model evaluation was started`);
        assert.strictEqual(replies, 0, `${event}: no stale reaction is emitted`);
    }
});

test('Auto Mode attaches each visual frame with the correct adjacent label', () => {
    const ai = read('nova_runtime_ai.js');
    const block = slice(ai, '    const screenFrame = window.getScreenShareFrame?', '    // Save user message to history');
    const sandbox = load(`
        let isAvon = false, options = { autoModeEvaluation: true }, messages = [];
        let userMessage = 'evaluate', addresseeNote = '', videoMomentNote = '', styleReminder = 'NO_ACTION';
        ${block}
        window.result = messages[0].content;
    `, { window: {
        getScreenShareFrame: () => 'current',
        getScreenShareTarget: () => 'both',
        getVisionFrame: () => null,
        getAutoModeVisualContext: () => [{ secondsAgo: 5, screen: 'older', camera: null }]
    } });
    const parts = sandbox.window.result;
    assert.ok(parts[1].text.includes('current screen'));
    assert.strictEqual(parts[2].image_url.url, 'current');
    assert.ok(parts[3].text.includes('5 seconds ago'));
    assert.strictEqual(parts[4].image_url.url, 'older');
});

test('video awareness prompt preserves selected personality and does not invent audio', () => {
    const ai = read('nova_runtime_ai.js');
    assert.ok(flowSrc.includes('An occasional brief, context-specific reaction'));
    assert.ok(flowSrc.includes('never imply you heard video audio'));
    assert.ok(flowSrc.includes('including subtle, intelligent mischief if Sly is selected'));
    assert.ok(ai.includes('ACTIVE PERSONALITY (${presetConfig.name})'));
    assert.ok(ai.includes('If speaking, make one brief natural remark in your selected personality'));
});

test('video frame callbacks can wake Auto Mode without waiting for its fallback poll', async () => {
    const sample = flow.waitForAutoModeSample(1000);
    flow.notifyAutoModeVisualFrame();
    await sample;
});

test('parseSnoozeRequest understands quiet and resume requests', () => {
    assert.strictEqual(flow.parseSnoozeRequest('Nova, be quiet for 10 minutes'), 10 * 60000);
    assert.strictEqual(flow.parseSnoozeRequest('stop interrupting me for 2 hours'), 2 * 3600000);
    assert.strictEqual(flow.parseSnoozeRequest('please stop interrupting'), 15 * 60000);
    assert.strictEqual(flow.parseSnoozeRequest('you can talk again'), 0);
    assert.strictEqual(flow.parseSnoozeRequest('what is the weather'), null);
});

test('snoozing blocks the shared gate until it expires or is cancelled', () => {
    const gate = flow.window.proactiveGate;
    gate.lastSpokeAt = 0;
    gate.snooze(60000);
    assert.strictEqual(gate.canStart(), false);
    assert.strictEqual(gate.canStart(Date.now() + 61000), true);
    gate.snooze(0);
    assert.strictEqual(gate.canStart(), true);
});

test('describeScreenChangeRegion says where the screen changed', () => {
    const cols = 32, rows = 18;
    const blank = new Uint8Array(cols * rows * 3);
    const withChange = (x0, x1, y0, y1) => {
        const s = new Uint8Array(blank);
        for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) s[(y * cols + x) * 3] = 15;
        return s;
    };
    assert.strictEqual(flow.describeScreenChangeRegion(blank, withChange(0, 6, 0, 4)), 'top-left of the screen');
    assert.strictEqual(flow.describeScreenChangeRegion(blank, withChange(26, 32, 14, 18)), 'bottom-right of the screen');
    assert.strictEqual(flow.describeScreenChangeRegion(blank, withChange(13, 19, 7, 11)), 'center of the screen');
    assert.strictEqual(flow.describeScreenChangeRegion(blank, blank), '');
});

test('Auto Mode has stuck detection and the AI layer applies snooze requests', () => {
    assert.ok(flowSrc.includes('const stuckCheck'));
    assert.ok(read('nova_runtime_ai.js').includes('applyProactiveSnoozeRequest'));
});

// ---------- Natural voice interruption ----------
const voiceHelpers = load(slice(read('nova_voice.js'), 'function normalizeVoiceTranscript', 'function isWakePhraseOnlyTranscript'));

test('voice interruption captures natural short stop phrases and complete thoughts', () => {
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('wait', ''), 'wait');
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('stop', ''), 'stop');
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('', 'hold on'), 'hold on');
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('', 'hello there'), 'hello there');
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('', 'hello'), '');
    assert.strictEqual(voiceHelpers.getSpeechInterruptCandidate('Can you explain that again?', ''), 'Can you explain that again?');
});

test('voice recognition checks for interruption before applying the speech echo mute', () => {
    const voiceSrc = read('nova_voice.js');
    const resultHandler = voiceSrc.indexOf('recognition.onresult = function(event)');
    const interruptCheck = voiceSrc.indexOf('if (speechInterruptListeningMode) {', resultHandler);
    const echoMute = voiceSrc.indexOf('if (isMicMutedForSpeech()) return;', interruptCheck);
    assert.ok(interruptCheck >= 0 && echoMute > interruptCheck);
    assert.ok(!voiceSrc.includes("localStorage.setItem('nova_interrupts_enabled', 'false')"));
    const stopSpeechSource = slice(voiceSrc, 'function stopSpeech()', 'function pauseSpeech()');
    assert.ok(stopSpeechSource.includes('currentPackAudio.pause()'), 'voice-pack audio stops on interruption');
    ['AI_v5_nova.html', 'AI_v5_JARVIS.html', 'AI_v5_JARVIS_CLEAN.html'].forEach(page => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
        assert.ok(html.includes('id="interruptsEnabled"'), `${page} exposes the interruption setting`);
    });
    const flowSource = read('nova_conversation_flow.js');
    assert.ok(flowSource.includes('const lastAssistantMessage = getLastAssistantMessage();'));
    assert.ok(!flowSource.includes('getLastNovaMessageText()'), 'interruption must not call a missing history helper');
});

test('volume-based barge-in stops speech without relying on transcripts', () => {
    const voiceSrc = read('nova_voice.js');
    const body = voiceSrc.slice(voiceSrc.indexOf('function triggerVoiceBargeIn()'));
    assert.ok(voiceSrc.includes('echoCancellation: true') && voiceSrc.includes('createAnalyser()'));
    assert.ok(body.slice(0, 1600).includes('stopSpeech();'), 'barge-in stops speech');
    assert.ok(voiceSrc.slice(voiceSrc.indexOf('function updateSpeakingUI(speaking)')).slice(0, 400).includes('startVoiceBargeInMonitor()'));
});

test('screen share attaches a frame and tells the model it can see it', () => {
    const aiSrc = read('nova_runtime_ai.js');
    assert.ok(aiSrc.includes('You CAN see the user\\\'s shared screen'));
    assert.ok(aiSrc.includes('the attached image IS their current screen'));
    assert.ok(aiSrc.includes('Screen sharing is on but no frame could be captured'));
    const flow = read('nova_conversation_flow.js');
    assert.ok(flow.includes('document.body.appendChild(screenShareVideo)'));
});

test('Direct mode setting is exposed and applied to replies', () => {
    ['AI_v5_nova.html', 'AI_v5_JARVIS.html', 'AI_v5_JARVIS_CLEAN.html'].forEach(page => {
        const html = fs.readFileSync(path.join(__dirname, '..', 'public', page), 'utf8');
        assert.ok(html.includes('id="directModeEnabled"'), `${page} exposes direct mode`);
    });
    assert.ok(read('nova_voice.js').includes("'nova_direct_mode'"));
    const aiSrc = read('nova_runtime_ai.js');
    assert.ok(aiSrc.includes("localStorage.getItem('nova_direct_mode') === 'true'"));
    assert.ok(aiSrc.includes('${directModeNote}]'));
});

// ---------- Run ----------
async function runTests() {
    let failed = 0;
    for (const { name, fn } of tests) {
        try {
            await fn();
            console.log(`  ok   ${name}`);
        } catch (error) {
            failed += 1;
            console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
        }
    }
    console.log(`\n${tests.length - failed}/${tests.length} passed`);
    process.exit(failed ? 1 : 0);
}

runTests().catch(error => {
    console.error(error);
    process.exit(1);
});
