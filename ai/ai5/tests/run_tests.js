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

// ---------- Audio transcription and lecture mode ----------
const filesSrc = read('nova_runtime_files.js');
const audio = load(slice(filesSrc, 'function formatAudioTimestamp', 'function encodeMonoWav'));

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
    ['Segment summaries', 'Key concepts', 'Instructor examples', 'Confusing or unclear', 'Study guide']
        .forEach(section => assert.ok(packet.content.includes(section), section));
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

test('detectRequestedArtifactFormats recognizes image requests', () => {
    ['Nova, generate an image', 'one of the sun', 'draw a bumblebee picture', 'show me a picture of the moon']
        .forEach(text => assert.ok(artifacts.detectRequestedArtifactFormats(text).includes('png'), text));
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
const flow = load(slice(flowSrc, 'window.proactiveGate = ', 'async function runAutoModeLoop'));

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

test('Auto Mode loop uses the shared gate and AI Vision does too', () => {
    assert.ok(flowSrc.includes('window.proactiveGate.begin()') && flowSrc.includes('window.proactiveGate.end(spoke)'));
    const visionSrc = read('nova_runtime_vision.js');
    assert.ok(visionSrc.includes('window.proactiveGate.begin()') && visionSrc.includes('window.proactiveGate.end(spoke)'));
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

// ---------- Run ----------
let failed = 0;
for (const { name, fn } of tests) {
    try {
        fn();
        console.log(`  ok   ${name}`);
    } catch (error) {
        failed += 1;
        console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`);
    }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
