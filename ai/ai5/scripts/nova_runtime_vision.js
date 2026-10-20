// AI Vision: lets the assistants see through the user's camera.
// While on, the latest camera frame is attached to each AI request, and an
// optional proactive check lets the assistant speak up when something useful is visible.

let aiVisionStream = null;
let aiVisionVideo = null;
let aiVisionRunId = 0;
let aiVisionLastSpokeAt = 0;
let aiVisionInFlight = false;

const AI_VISION_HOVER_TEXT = 'Allow AI5 to see through your camera for visual assistance.';
const AI_VISION_FRAME_WIDTH = 640;

function setAiVisionUi(active) {
    ['aiVisionBtn', 'mobileAiVisionBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.title = active ? 'AI Vision is on: AI5 can see through your camera. Click to turn off.' : AI_VISION_HOVER_TEXT;
        btn.querySelector('i')?.classList.toggle('fa-video', !active);
        btn.querySelector('i')?.classList.toggle('fa-video-slash', active);
    });
    const preview = document.getElementById('aiVisionPreview');
    if (preview) preview.hidden = !active;
}

function stopAiVision(message) {
    aiVisionRunId += 1;
    if (aiVisionStream) aiVisionStream.getTracks().forEach(track => track.stop());
    aiVisionStream = null;
    if (aiVisionVideo) aiVisionVideo.srcObject = null;
    aiVisionVideo = null;
    const previewVideo = document.getElementById('aiVisionPreviewVideo');
    if (previewVideo) previewVideo.srcObject = null;
    setAiVisionUi(false);
    if (message) showNotification(message, 2500);
}

function ensureAiVisionPreview() {
    let preview = document.getElementById('aiVisionPreview');
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = 'aiVisionPreview';
    preview.className = 'ai-vision-preview';
    preview.hidden = true;
    preview.innerHTML = '<video id="aiVisionPreviewVideo" autoplay muted playsinline aria-label="Your camera, visible to AI5"></video><span class="ai-vision-label"><i class="fas fa-eye" aria-hidden="true"></i> AI Vision on</span>';
    preview.insertAdjacentHTML('beforeend', '<span class="ai-vision-resize" aria-label="Resize camera preview" role="separator"></span>');
    document.body.appendChild(preview);
    enableAiVisionPreviewGestures(preview);
    return preview;
}

// Drag to move (mouse or touch), drag the corner handle or pinch to resize.
function enableAiVisionPreviewGestures(preview) {
    const MIN_W = 100;
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
    const pointers = new Map();
    let mode = null;
    let start = null;

    const fit = () => {
        const r = preview.getBoundingClientRect();
        preview.style.left = `${clamp(r.left, 0, window.innerWidth - r.width)}px`;
        preview.style.top = `${clamp(r.top, 0, window.innerHeight - r.height)}px`;
    };
    const detach = () => {
        const r = preview.getBoundingClientRect();
        preview.style.left = `${r.left}px`;
        preview.style.top = `${r.top}px`;
        preview.style.right = 'auto';
        preview.style.bottom = 'auto';
    };
    const setWidth = (w) => {
        preview.style.width = `${clamp(w, MIN_W, Math.min(window.innerWidth - 8, 640))}px`;
    };
    const pinchDistance = () => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    preview.addEventListener('pointerdown', (e) => {
        if (e.button > 0) return;
        preview.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        detach();
        const r = preview.getBoundingClientRect();
        if (pointers.size === 2) {
            mode = 'pinch';
            start = { dist: pinchDistance(), width: r.width };
        } else if (e.target.classList.contains('ai-vision-resize')) {
            mode = 'resize';
            start = { x: e.clientX, width: r.width };
        } else {
            mode = 'move';
            start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top };
        }
        e.preventDefault();
    });

    preview.addEventListener('pointermove', (e) => {
        if (!pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (mode === 'pinch' && pointers.size >= 2) {
            setWidth(start.width * (pinchDistance() / start.dist));
        } else if (mode === 'resize') {
            setWidth(start.width + (e.clientX - start.x));
        } else if (mode === 'move') {
            const r = preview.getBoundingClientRect();
            preview.style.left = `${clamp(start.left + e.clientX - start.x, 0, window.innerWidth - r.width)}px`;
            preview.style.top = `${clamp(start.top + e.clientY - start.y, 0, window.innerHeight - r.height)}px`;
        }
        fit();
    });

    const end = (e) => {
        pointers.delete(e.pointerId);
        if (pointers.size === 0) {
            mode = null;
        } else if (pointers.size === 1) {
            // Continue as a move with the remaining finger.
            const [p] = [...pointers.values()];
            const r = preview.getBoundingClientRect();
            mode = 'move';
            start = { x: p.x, y: p.y, left: r.left, top: r.top };
        }
    };
    preview.addEventListener('pointerup', end);
    preview.addEventListener('pointercancel', end);
    window.addEventListener('resize', () => {
        if (preview.style.left) fit();
    });
}

function isAiVisionReady() {
    return Boolean(aiVisionStream && aiVisionVideo && aiVisionVideo.videoWidth);
}

window.isAiVisionActive = () => Boolean(aiVisionStream);

// Returns a JPEG data URL of the current camera view, or null when AI Vision is off.
window.getVisionFrame = function () {
    if (!isAiVisionReady()) return null;
    const scale = Math.min(1, AI_VISION_FRAME_WIDTH / aiVisionVideo.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(aiVisionVideo.videoWidth * scale);
    canvas.height = Math.round(aiVisionVideo.videoHeight * scale);
    // Frames are sent as captured (not mirrored); only the on-screen preview is mirrored.
    canvas.getContext('2d').drawImage(aiVisionVideo, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
};

function getVisionSignature() {
    if (!isAiVisionReady()) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 24;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(aiVisionVideo, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const signature = new Uint8Array(canvas.width * canvas.height * 3);
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
        signature[pixel * 3] = pixels[pixel * 4] >> 4;
        signature[pixel * 3 + 1] = pixels[pixel * 4 + 1] >> 4;
        signature[pixel * 3 + 2] = pixels[pixel * 4 + 2] >> 4;
    }
    return signature;
}

function getVisionChangeRatio(previous, current) {
    if (!previous || !current || previous.length !== current.length) return 1;
    let changed = 0;
    const total = current.length / 3;
    for (let pixel = 0; pixel < total; pixel += 1) {
        const offset = pixel * 3;
        const distance = Math.abs(current[offset] - previous[offset]) +
            Math.abs(current[offset + 1] - previous[offset + 1]) +
            Math.abs(current[offset + 2] - previous[offset + 2]);
        if (distance >= 15) changed += 1;
    }
    return changed / total;
}

function getVisionAssistant() {
    const allowed = groupChatEnabled
        ? mutedGroupAssistant === 'nova' ? ['nova'] : mutedGroupAssistant === 'other' ? ['other'] : ['nova', 'other']
        : [window.activeVoiceAssistant === 'other' ? 'other' : 'nova'];
    if (allowed.length === 1) return allowed[0];
    const last = typeof getLastAssistantMessage === 'function' ? getLastAssistantMessage() : null;
    return last && last.sender !== 'Avon' ? 'other' : 'nova';
}

const AI_VISION_PROMPT = `AI VISION CHECK
You can see the user through their webcam right now. Decide whether to say something on your own.
Speak only when it would clearly help: they look confused, frustrated, or stuck (offer to slow down or explain differently); they are holding, pointing at, or showing something you can identify (say what it is and how it helps); their posture is clearly poor (a short ergonomic tip); or they seem to need help.
Stay quiet for ordinary, neutral moments, and do not repeat anything you already said.
If nothing is worth saying, reply with exactly: NO_ACTION`;

async function runAiVisionLoop(runId) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    let lastEvaluatedSignature = null;
    let lastEvaluationAt = 0;

    while (aiVisionStream && runId === aiVisionRunId) {
        await sleep(5000);
        if (!aiVisionStream || runId !== aiVisionRunId) return;
        if (aiVisionInFlight || document.hidden) continue;

        const now = Date.now();
        const messageInput = document.getElementById('messageInput');
        if (now - lastEvaluationAt < 40000 ||
            now - aiVisionLastSpokeAt < 60000 ||
            now - (typeof autoModeLastInteractionAt === 'number' ? autoModeLastInteractionAt : 0) < 3000 ||
            isResponseInFlight ||
            window.isSpeaking ||
            window.voiceInterruptInProgress ||
            window.speechSynthesis?.speaking ||
            messageInput?.value.trim()) {
            continue;
        }

        const signature = getVisionSignature();
        if (!signature) continue;
        const changeRatio = getVisionChangeRatio(lastEvaluatedSignature, signature);
        // Check after a visible change, or at least every two minutes so slow changes like slouching are caught.
        if (changeRatio < 0.12 && now - lastEvaluationAt < 120000) continue;

        lastEvaluatedSignature = signature;
        lastEvaluationAt = now;
        aiVisionInFlight = true;
        try {
            const assistant = getVisionAssistant();
            const replyResult = await generateAIResponse(AI_VISION_PROMPT, currentPersonality, {
                assistant,
                modelOverride: assistant === 'other' ? groupChatModel : undefined,
                groupChat: groupChatEnabled,
                individualChat: !groupChatEnabled || mutedGroupAssistant !== 'both',
                skipUserHistory: true,
                proactiveEvaluation: true,
                visionEvaluation: true
            });
            if (!aiVisionStream || runId !== aiVisionRunId) return;

            const reply = String(replyResult?.reply || '').trim();
            if (!reply || /^NO_ACTION(?:\s|[.!:—-]|$)/i.test(reply)) continue;
            if (isResponseInFlight || window.isSpeaking || window.speechSynthesis?.speaking || messageInput?.value.trim()) continue;

            const sender = assistant === 'other' ? 'Avon' : 'Nova';
            addMessage(reply, sender, null, replyResult.model);
            conversationHistory.push({
                role: 'assistant',
                speaker: sender,
                content: reply,
                personality: currentPersonality,
                timestamp: new Date().toISOString(),
                model: replyResult.model
            });
            aiVisionLastSpokeAt = Date.now();
            speakAssistantResponse(reply, sender);
        } catch (error) {
            console.error('AI Vision check failed:', error);
        } finally {
            aiVisionInFlight = false;
        }
    }
}

async function toggleAiVision() {
    if (aiVisionStream) return stopAiVision('AI Vision off. The camera is no longer in use.');
    if (!navigator.mediaDevices?.getUserMedia) {
        showNotification('Camera access is not supported in this browser (it also needs HTTPS or localhost).', 4000);
        return;
    }
    try {
        aiVisionStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
    } catch (error) {
        aiVisionStream = null;
        const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
        showNotification(denied ? 'Camera permission was blocked. Allow it in your browser to use AI Vision.' : 'Could not start the camera. Is another app using it?', 4500);
        return;
    }

    aiVisionVideo = document.createElement('video');
    aiVisionVideo.muted = true;
    aiVisionVideo.playsInline = true;
    aiVisionVideo.srcObject = aiVisionStream;
    await aiVisionVideo.play().catch(() => {});

    ensureAiVisionPreview();
    const previewVideo = document.getElementById('aiVisionPreviewVideo');
    if (previewVideo) {
        previewVideo.srcObject = aiVisionStream;
        previewVideo.play().catch(() => {});
    }
    aiVisionStream.getVideoTracks()[0]?.addEventListener('ended', () => stopAiVision('AI Vision ended: the camera was disconnected.'));
    setAiVisionUi(true);
    showNotification('AI Vision on: camera frames are sent to the AI model with your messages. Use a vision-capable model.', 4500);
    aiVisionRunId += 1;
    runAiVisionLoop(aiVisionRunId);
}

document.addEventListener('DOMContentLoaded', () => {
    ensureAiVisionPreview();
    setAiVisionUi(false);
    document.getElementById('aiVisionBtn')?.addEventListener('click', toggleAiVision);
    document.getElementById('mobileAiVisionBtn')?.addEventListener('click', toggleAiVision);
});

window.addEventListener('pagehide', () => {
    if (aiVisionStream) stopAiVision();
});
