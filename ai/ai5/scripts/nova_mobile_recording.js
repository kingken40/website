// Explicit record-and-send alternative when browser speech recognition is unavailable.
(function setupMobileRecordedVoice() {
    const button = document.getElementById('mobileRecordVoiceBtn');
    if (!button) return;
    const label = button.querySelector('span');
    const muteButton = document.getElementById('mobileMuteBtn');
    let recorder = null;
    let stream = null;
    let chunks = [];
    let timeout = null;
    let busy = false;
    let cancelled = false;

    function notice(message) {
        if (typeof showNotification === 'function') showNotification(message, 6000);
        else console.warn(message);
    }

    function stopTracks() {
        if (stream) stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    function setRecording(active) {
        window.mobileRecordedVoiceState = active ? 'recording' : busy ? 'processing' : '';
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute('aria-label', active ? 'Stop recording and send voice message' : 'Record voice message');
        if (label) label.textContent = active ? 'Send' : 'Record';
        if (muteButton) muteButton.disabled = active || busy;
    }

    async function start() {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            notice('Recording is not supported in this browser.');
            return;
        }
        if (typeof OPENAI_API_KEY === 'undefined' || !OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
            notice('Add an OpenAI API key in Settings to use recorded voice transcription.');
            return;
        }
        if (typeof transcribeAudio !== 'function' || typeof window.processUserMessage !== 'function') {
            notice('Voice transcription is unavailable. Reload the page and try again.');
            return;
        }
        busy = true;
        button.disabled = true;
        setRecording(false);
        try {
            if (typeof window.pauseMobileListeningForRecording !== 'function') {
                throw new Error('Mobile voice controls are not ready. Reload and try again.');
            }
            await window.pauseMobileListeningForRecording();
            window.stopSpeech?.();
            cancelled = false;
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            if (cancelled) {
                stopTracks();
                busy = false;
                button.disabled = false;
                setRecording(false);
                return;
            }
            const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
                .find(item => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(item));
            recorder = type ? new MediaRecorder(stream, { mimeType: type }) : new MediaRecorder(stream);
            chunks = [];
            recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            recorder.onerror = event => {
                console.error('Mobile recording error:', event.error);
                cancelled = true;
                notice('Recording failed. Check microphone access and try again.');
                if (recorder && recorder.state !== 'inactive') recorder.stop();
            };
            recorder.onstop = finish;
            recorder.start();
            busy = false;
            button.disabled = false;
            setRecording(true);
            notice('Recording. Tap Send when finished (up to 60 seconds).');
            timeout = setTimeout(() => {
                notice('Recording reached 60 seconds and is being sent.');
                stop();
            }, 60000);
        } catch (error) {
            console.error('Could not start mobile recording:', error);
            stopTracks();
            recorder = null;
            busy = false;
            button.disabled = false;
            setRecording(false);
            notice(`Could not start recording: ${error.message}`);
        }
    }

    function stop() {
        if (!recorder || recorder.state === 'inactive') return;
        clearTimeout(timeout);
        busy = true;
        button.disabled = true;
        setRecording(false);
        recorder.stop();
    }

    async function finish() {
        clearTimeout(timeout);
        const type = recorder.mimeType || (chunks[0] && chunks[0].type) || 'audio/webm';
        stopTracks();
        recorder = null;
        try {
            if (cancelled) return;
            if (!chunks.length) throw new Error('No audio was captured. Please try again.');
            const extension = /mp4|aac/i.test(type) ? 'm4a' : 'webm';
            const file = new File(chunks, `voice.${extension}`, { type });
            notice('Transcribing recorded voice...');
            const transcript = (await transcribeAudio(file)).trim();
            if (!transcript) throw new Error('No speech was detected. Please try again.');
            if (cancelled) return;
            window.processUserMessage(transcript);
        } catch (error) {
            console.error('Mobile voice transcription failed:', error);
            notice(`Voice transcription failed: ${error.message}`);
        } finally {
            chunks = [];
            busy = false;
            button.disabled = false;
            setRecording(false);
        }
    }

    button.addEventListener('click', () => {
        if (busy) return;
        if (recorder && recorder.state === 'recording') stop();
        else start();
    });
    window.addEventListener('pagehide', () => {
        cancelled = true;
        clearTimeout(timeout);
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        stopTracks();
    });
})();
