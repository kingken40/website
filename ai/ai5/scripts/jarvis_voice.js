/* ========================================
   N.O.V.A VOICE RECOGNITION & SYNTHESIS
   Advanced Voice Control System
======================================== */

// Voice Recognition Variables
let recognition = null;
let synthesis = null;

// Make recognition globally accessible for integration
window.recognition = null;
let isVoiceSupported = false;
let isListening = false;
let isSpeaking = false;
let isWakeListening = false;
let isVoiceResponseEnabled = true;
let hasVoicePermission = false;
let voicePermissionRequestInFlight = null;
let pendingTranscript = '';
let lastInterimTranscript = '';
let wakeWordEnabled = localStorage.getItem('Nova_wake_word_enabled') !== 'false'; // Default on unless explicitly disabled
let isWakeWordSession = false; // Track if current interaction is from wake word
let alwaysListeningHotkeyMode = false; // R+T toggled continuous listening
let alwaysListeningTurnActive = false;
let currentVoiceSettings = {
    rate: 0.9,   // Measured, articulate pace - sophisticated yet natural
    pitch: 0.9,  // Mid-range British tone - authoritative without being too deep (like Paul Bettany)
    volume: 0.85 // Clear, confident presence - butler-like authority
};

// JARVIS custom audio-pack voices (WAV-based, separate from browser TTS voices)
const JARVIS_AUDIO_PACKS = [
    { id: 'jarvis-pack-cfx', name: 'JARVIS Pack - CFX', basePath: '../JARVIS/CFX_UI_J.A.R.V.I.S' },
    { id: 'jarvis-pack-ghv4', name: 'JARVIS Pack - GHV4', basePath: '../JARVIS/GHV4_UI_J.A.R.V.I.S' },
    { id: 'jarvis-pack-proffie', name: 'JARVIS Pack - ProffieOS V2', basePath: '../JARVIS/ProffieOS_V2_Voicepack_J.A.R.V.I.S' },
    { id: 'jarvis-pack-sn4', name: 'JARVIS Pack - SN4', basePath: '../JARVIS/SN4_UI_J.A.R.V.I.S' },
    { id: 'jarvis-pack-xeno2', name: 'JARVIS Pack - Xeno2', basePath: '../JARVIS/Xeno2_UI_J.A.R.V.I.S' },
    { id: 'jarvis-pack-xeno3', name: 'JARVIS Pack - Xeno3', basePath: '../JARVIS/Xeno3_UI_J.A.R.V.I.S' }
];

let selectedVoiceMode = 'tts'; // 'tts' | 'jarvis-pack'
let selectedJarvisPackId = null;
let currentPackAudio = null;
let lastJarvisPackClipByPack = {};
const defaultBridgeEnabled = localStorage.getItem('Nova_local_voice_bridge_enabled');
let localVoiceBridgeEnabled = defaultBridgeEnabled === null ? true : defaultBridgeEnabled === 'true';
let localVoiceBridgeUrl = localStorage.getItem('Nova_local_voice_bridge_url') || 'http://127.0.0.1:8765';
let currentBridgeAudio = null;
let lastBridgeFailureNoticeMs = 0;

function isUsableSpeechVoice(voice) {
    return !!(voice && typeof voice.name === 'string' && typeof voice.lang === 'string');
}

function getBestAvailableNovaVoice() {
    if (Array.isArray(window.availableNovaVoices) && window.availableNovaVoices.length > 0) {
        return window.availableNovaVoices[0];
    }

    if (isUsableSpeechVoice(currentVoiceSettings.voice)) {
        return currentVoiceSettings.voice;
    }

    return null;
}

function ensureJarvisResponseVoice() {
    const bestVoice = getBestAvailableNovaVoice();
    if (isUsableSpeechVoice(bestVoice)) {
        currentVoiceSettings.voice = bestVoice;
        window.selectedVoice = bestVoice;
        currentVoiceSettings.rate = 0.85;
        currentVoiceSettings.pitch = 0.75;
        currentVoiceSettings.volume = 0.85;
        console.log('🎯 JARVIS response TTS voice set to:', bestVoice.name, `(${bestVoice.lang})`);
        return bestVoice;
    }

    console.warn('🎯 No usable JARVIS response TTS voice available');
    return null;
}

function normalizeBridgeUrl(url) {
    if (!url || typeof url !== 'string') return 'http://127.0.0.1:8765';
    return url.trim().replace(/\/+$/, '');
}

function getBridgeVoiceName() {
    if (isUsableSpeechVoice(currentVoiceSettings.voice)) {
        return currentVoiceSettings.voice.name;
    }
    if (isUsableSpeechVoice(window.selectedVoice)) {
        return window.selectedVoice.name;
    }
    return null;
}

async function playViaLocalVoiceBridge(text, onEndCallback) {
    if (!localVoiceBridgeEnabled) {
        return false;
    }

    const bridgeUrl = normalizeBridgeUrl(localVoiceBridgeUrl);
    if (!bridgeUrl) {
        return false;
    }

    try {
        const response = await fetch(`${bridgeUrl}/speak`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                voice_name: getBridgeVoiceName(),
                rate: currentVoiceSettings.rate,
                volume: currentVoiceSettings.volume
            })
        });

        if (!response.ok) {
            throw new Error(`Bridge HTTP ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (!audioBlob || audioBlob.size === 0) {
            throw new Error('Bridge returned empty audio');
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentBridgeAudio = audio;

        isSpeaking = true;
        window.isSpeaking = true;
        isSpeechOutputActive = true;
        window.isSpeechOutputActive = true;
        updateSpeakingUI(true);

        audio.onended = function () {
            URL.revokeObjectURL(audioUrl);
            currentBridgeAudio = null;
            isSpeaking = false;
            window.isSpeaking = false;
            isSpeechOutputActive = false;
            window.isSpeechOutputActive = false;
            updateSpeakingUI(false);
            if (onEndCallback) onEndCallback();
        };

        audio.onerror = function (event) {
            URL.revokeObjectURL(audioUrl);
            currentBridgeAudio = null;
            isSpeaking = false;
            window.isSpeaking = false;
            isSpeechOutputActive = false;
            window.isSpeechOutputActive = false;
            updateSpeakingUI(false);
            console.error('🔊 Local voice bridge audio playback error:', event);
            if (onEndCallback) onEndCallback();
        };

        await audio.play();
        return true;
    } catch (error) {
        const now = Date.now();
        if (now - lastBridgeFailureNoticeMs > 6000) {
            lastBridgeFailureNoticeMs = now;
            showVoiceNotification('Local JARVIS bridge unavailable. Start Start_Voice_Bridge.bat in Jarvis-main.', 4500);
        }
        console.warn('🔊 Local voice bridge unavailable, falling back to browser TTS:', error.message);
        return false;
    }
}

// Wake phrase detection
const wakePhrases = ['hey nova', 'nova'];
const wakePhrasePatterns = wakePhrases.map((phrase) => new RegExp(`\\b${phrase.replace(/\s+/g, '\\s+')}\\b`));
const wakePhraseCompactPatterns = wakePhrases.map((phrase) => phrase.replace(/\s+/g, ''));
let wakeListeningTimeout = null;
let restartPending = false; // Prevent multiple restart attempts
let isSpeechOutputActive = false; // Track if Nova is currently speaking

// Voice command patterns
const voiceCommands = {
    greetings: ['hello', 'hi', 'good morning', 'good afternoon', 'good evening'],
    help: ['help', 'what can you do', 'commands', 'assistance'],
    clear: ['clear chat', 'clear messages', 'clear screen', 'new conversation'],
    modes: ['switch mode', 'change mode', 'genius mode', 'professor mode', 'analyst mode'],
    settings: ['settings', 'preferences', 'options', 'configuration'],
    status: ['status', 'how are you', 'system status', 'are you there']
};

// Microphone Permission Management
async function requestVoicePermission() {
    if (hasVoicePermission) {
        return true;
    }
    if (voicePermissionRequestInFlight) {
        return voicePermissionRequestInFlight;
    }
    
    voicePermissionRequestInFlight = (async () => {
        try {
            console.log('🎤 Requesting microphone permission...');
            showVoiceNotification('Requesting microphone access...', 3000);
            
            // Request permission through getUserMedia
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Permission granted - immediately close the stream
            stream.getTracks().forEach(track => track.stop());
            hasVoicePermission = true;
            
            console.log('✅ Microphone permission granted');
            showVoiceNotification('Microphone access granted - voice recognition ready!', 3000);
            
            // Update status in chat
            setTimeout(() => {
                addMessageToChat('Microphone access granted, sir. Voice recognition is now ready. Press and hold the microphone button to speak.', 'Nova');
            }, 500);
            
            return true;
            
        } catch (error) {
            hasVoicePermission = false;
            console.warn('⚠️ Microphone permission denied:', error);
            
            if (error.name === 'NotAllowedError') {
                showVoiceNotification('Microphone access denied. Please enable it in browser settings.', 5000);
                setTimeout(() => {
                    addMessageToChat('Microphone access was denied, sir. Voice recognition will not function. You can still use text input below.', 'Nova');
                }, 500);
            } else {
                showVoiceNotification('Microphone not available. Please check your device settings.', 5000);
                setTimeout(() => {
                    addMessageToChat('Microphone is not available, sir. Voice recognition will not function. You can still use text input below.', 'Nova');
                }, 500);
            }
            
            return false;
        } finally {
            voicePermissionRequestInFlight = null;
        }
    })();

    return voicePermissionRequestInFlight;
}

// Initialize Voice System
let voiceSystemInitialized = false;
function initializeVoice() {
    if (voiceSystemInitialized) {
        console.log('🎤 Voice system already initialized, skipping...');
        return;
    }
    
    console.log('🎤 Initializing N.O.V.A voice systems...');
    
    // Check browser support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        window.recognition = recognition; // Make globally accessible
        setupSpeechRecognition();
        isVoiceSupported = true;
        voiceSystemInitialized = true;
        console.log('✅ Speech Recognition initialized');
    } else {
        console.warn('⚠️ Speech Recognition not supported');
        disableVoiceFeatures();
    }
    
    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
        synthesis = window.speechSynthesis;
        loadVoices();
        console.log('✅ Speech Synthesis initialized');
    } else {
        console.warn('⚠️ Speech Synthesis not supported');
    }
    
    // Voice system ready - user must press and hold button to speak
    console.log('✅ Voice system ready. Press and hold microphone button to speak.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🤖 N.O.V.A Voice System Initialized');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function setupSpeechRecognition() {
    if (!recognition) return;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;
    
    recognition.onstart = function() {
        console.log('🎤 Voice recognition started');
        updateVoiceUI(true);
        isListening = true;
        window.isListening = true;
        // Don't clear transcripts on restart during hotkey hold - startVoiceRecognition clears them on initial press
        if (!hotkeyListening) {
            pendingTranscript = '';
            lastInterimTranscript = '';
        }
    };
    
    recognition.onend = function() {
        console.log('🎤 Voice recognition ended, isWakeListening:', isWakeListening, 'wakeWordEnabled:', wakeWordEnabled, 'hotkeyListening:', hotkeyListening, 'pttReleaseMode:', pttReleaseMode);
        updateVoiceUI(false);
        
        // PTT release: R was released, collect all results and process
        if (pttReleaseMode) {
            pttReleaseMode = false;
            isListening = false;
            window.isListening = false;
            const transcript = [pendingTranscript.trim(), lastInterimTranscript.trim()]
                .filter(Boolean).join(' ').trim();
            pendingTranscript = '';
            lastInterimTranscript = '';
            recreateRecognition(true);
            if (transcript) {
                console.log('⌨️ Processing command:', transcript);
                updateVoiceStatus('Processing command...');
                processVoiceCommand(transcript);
            } else {
                console.log('⌨️ No transcript captured');
                updateVoiceStatus(getDefaultReadyStatus());
            }
            return;
        }

        // R+T mode: process one natural turn, then wait for response to finish
        // and resume listening in restoreWakeListeningAfterResponse.
        if (alwaysListeningHotkeyMode && alwaysListeningTurnActive) {
            alwaysListeningTurnActive = false;
            isListening = false;
            window.isListening = false;
            const transcript = [pendingTranscript.trim(), lastInterimTranscript.trim()]
                .filter(Boolean).join(' ').trim();
            pendingTranscript = '';
            lastInterimTranscript = '';
            if (transcript) {
                console.log('🎙️ Always-listening turned-on captured:', transcript);
                isWakeWordSession = true;
                window.isWakeWordSession = true;
                updateVoiceStatus('Processing command...');
                processVoiceCommand(transcript);
            } else {
                console.log('🎙️ Always-listening turn ended with no transcript');
                updateVoiceStatus(getAlwaysListeningStatus());
                setTimeout(() => {
                    if (alwaysListeningHotkeyMode && !isListening) {
                        startAlwaysListeningTurn();
                    }
                }, 300);
            }
            return;
        }
        
        // If hotkey (R key) is still being held, restart recognition immediately
        if (hotkeyListening && hotkeyActive && !restartPending) {
            console.log('🎤 Hotkey still held - restarting recognition...');
            restartPending = true;
            
            setTimeout(() => {
                if (hotkeyListening && hotkeyActive) {
                    restartPending = false;
                    isListening = true;
                    window.isListening = true;
                    try {
                        recognition.continuous = true;
                        recognition.interimResults = true;
                        recognition.start();
                        console.log('🎤 Recognition restarted for continued hotkey hold');
                    } catch (e) {
                        console.log('🎤 Failed to restart:', e);
                        restartPending = false;
                    }
                } else {
                    console.log('🎤 Hotkey released - not restarting');
                    restartPending = false;
                }
            }, 100);
        }
        // If wake listening is active and enabled, restart it
        else if (isWakeListening && wakeWordEnabled && !restartPending && !isSpeechOutputActive) {
            console.log('🎤 Scheduling wake listening restart...');
            restartPending = true;
            
            setTimeout(() => {
                if (isWakeListening && wakeWordEnabled && !isSpeechOutputActive && !isListening) {
                    restartPending = false;
                    isListening = false;
                    window.isListening = false;
                    startWakeListening();
                } else {
                    console.log('🎤 Restart cancelled - conditions changed');
                    restartPending = false;
                    isListening = false;
                    window.isListening = false;
                }
            }, 1000);
        } else {
            // Not in wake mode, clean up
            isListening = false;
            window.isListening = false;
            isWakeListening = false;
            window.isWakeListening = false;
            console.log('🎤 Recognition ended, pending transcript:', pendingTranscript || 'none');
        }
    };
    
    recognition.onerror = function(event) {
        console.error('🎤 Voice recognition error:', event.error);
        updateVoiceUI(false);
        isListening = false;
        window.isListening = false;
        
        // If R was released and we're waiting for results, process whatever arrived
        if (pttReleaseMode) {
            pttReleaseMode = false;
            const transcript = [pendingTranscript.trim(), lastInterimTranscript.trim()]
                .filter(Boolean).join(' ').trim();
            pendingTranscript = '';
            lastInterimTranscript = '';
            recreateRecognition(true);
            if (transcript) {
                console.log('⌨️ Processing command (error recovery):', transcript);
                updateVoiceStatus('Processing command...');
                processVoiceCommand(transcript);
            } else {
                if (event.error === 'network') {
                    showVoiceNotification('Network error - please press R and repeat', 3000);
                }
                updateVoiceStatus(getDefaultReadyStatus());
            }
            return;
        }

        if (alwaysListeningHotkeyMode) {
            alwaysListeningTurnActive = false;
            if (event.error !== 'aborted' && event.error !== 'no-speech') {
                showVoiceNotification(`Voice recognition error: ${event.error}`, 2500);
            }
            setTimeout(() => {
                if (alwaysListeningHotkeyMode && !isListening && !isSpeechOutputActive) {
                    startAlwaysListeningTurn();
                }
            }, event.error === 'network' ? 1200 : 300);
            return;
        }
        
        // Show user-friendly error message
        if (event.error === 'not-allowed') {
            pendingTranscript = '';
            lastInterimTranscript = '';
            showVoiceNotification('Microphone access denied. Please allow microphone access.', 5000);
            isWakeListening = false;
            window.isWakeListening = false;
        } else if (event.error === 'network') {
            // Network error during hold: save any transcript already captured, then
            // recreate the recognition object (skip abort — connection already broken).
            // If R is still held, restart recognition immediately so the user doesn't
            // have to release and re-press.
            const savedTranscript = (pendingTranscript + ' ' + lastInterimTranscript).trim();
            pendingTranscript = '';
            lastInterimTranscript = '';
            const rStillHeld = hotkeyActive;
            recreateRecognition(true);
            if (rStillHeld) {
                // Restore hotkey state and restart immediately
                hotkeyListening = true;
                showVoiceNotification('Reconnecting...', 1000);
                setTimeout(() => {
                    if (hotkeyActive && hotkeyListening) {
                        try {
                            if (savedTranscript) pendingTranscript = savedTranscript;
                            recognition.continuous = true;
                            recognition.interimResults = true;
                            recognition.start();
                            console.log('🎤 Recognition restarted after network error (R still held)');
                        } catch(e) {
                            console.log('🎤 Failed to restart after network error:', e);
                            hotkeyListening = false;
                            showVoiceNotification('Network issue - press R to try again', 2000);
                        }
                    }
                }, 300);
            } else {
                showVoiceNotification('Network issue - press R to try again', 2000);
            }
        } else if (event.error === 'aborted') {
            pendingTranscript = '';
            lastInterimTranscript = '';
            if (hotkeyActive) {
                console.log('🎤 Spontaneous abort while R held - onend will restart recognition');
            } else {
                recreateRecognition(true);
            }
        } else if (event.error !== 'no-speech') {
            pendingTranscript = '';
            lastInterimTranscript = '';
            showVoiceNotification('Voice recognition error. Please try again.', 3000);
        }
        
        // Restart wake listening after error if enabled
        if (isWakeListening && wakeWordEnabled && !restartPending && !isSpeechOutputActive) {
            restartPending = true;
            setTimeout(() => {
                if (isVoiceSupported && wakeWordEnabled && !isSpeechOutputActive && !isListening) {
                    console.log('🎤 Restarting after error recovery...');
                    restartPending = false;
                    startWakeListening();
                } else {
                    console.log('🎤 Error restart cancelled - conditions changed');
                    restartPending = false;
                }
            }, 2000);
        } else if (event.error !== 'aborted' && event.error !== 'network') {
            updateVoiceStatus('Ready - Press and hold to speak');
        }
    };
    
    recognition.onresult = function(event) {
        if (isSpeechOutputActive || (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending))) {
            console.log('🎤 Ignoring recognition result while speech output is active');
            return;
        }

        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.trim();
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Handle wake phrase detection when wake listening is active
        if (isWakeListening && wakeWordEnabled) {
            const combinedText = [finalTranscript, interimTranscript]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .replace(/[^\w\s]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const compactCombinedText = combinedText.replace(/\s+/g, '');
            const wakeDetected =
                wakePhrasePatterns.some(pattern => pattern.test(combinedText)) ||
                wakePhraseCompactPatterns.some(phrase => compactCombinedText.includes(phrase));
            if (wakeDetected) {
                console.log('🎯 Wake phrase detected:', combinedText);
                handleWakePhrase();
                return;
            }
            
            // Show what we're hearing during wake listening
            if (interimTranscript) {
                updateVoiceStatus(`Listening: "${interimTranscript}"`);
            }
        } else {
            // Push-to-talk mode - accumulate transcript while button is held
            if (finalTranscript) {
                pendingTranscript = (pendingTranscript ? pendingTranscript + ' ' : '') + finalTranscript;
                lastInterimTranscript = '';
                console.log('🗣️ Captured final:', finalTranscript, '| Total:', pendingTranscript);
                updateVoiceStatus(`Captured: "${pendingTranscript}"`);
            } else if (interimTranscript) {
                lastInterimTranscript = interimTranscript;
                console.log('🗣️ Interim:', interimTranscript);
                updateVoiceStatus(`Listening: "${interimTranscript}"`);
            }
        }
    };
}

function recreateRecognition(skipAbort = false) {
    console.log('🔄 Recreating recognition object...');
    if (!skipAbort) {
        try {
            if (recognition) recognition.abort();
        } catch (e) {}
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    recognition = new SpeechRecognition();
    window.recognition = recognition;
    setupSpeechRecognition();
    isListening = false;
    window.isListening = false;
    hotkeyListening = false;
    console.log('✅ Recognition object recreated - ready for next R press');
}

function startWakeListening() {
    if (!wakeWordEnabled) {
        console.log('👂 Wake word disabled - toggle to enable');
        return;
    }
    
    if (!recognition || !isVoiceSupported || !hasVoicePermission) {
        console.warn('👂 Voice recognition not available or permission not granted');
        return;
    }
    
    // Check if speech is currently active (use our own isSpeaking flag as
    // primary — speechSynthesis.speaking can lag behind utterance.onend in
    // some browsers, causing the old single-shot retry to give up too early)
    const speechActive = isSpeaking ||
        (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
    if (speechActive) {
        console.log('👂 Cannot start listening - Nova is currently speaking');
        setTimeout(function retryWake() {
            const stillSpeaking = isSpeaking ||
                (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending));
            if (!stillSpeaking) {
                if (wakeWordEnabled) startWakeListening();
            } else if (wakeWordEnabled) {
                setTimeout(retryWake, 400);   // keep polling until speech clears
            }
        }, 400);
        return;
    }
    
    if (isListening || restartPending) {
        if (isListening) {
            console.log('👂 Recognition already running');
        }
        return;
    }
    
    console.log('👂 Starting wake phrase listening...');
    isWakeListening = true;
    window.isWakeListening = true;
    isListening = true;
    window.isListening = true;
    
    try {
        recognition.continuous = true;
        recognition.start();
        updateVoiceStatus('Listening for "Nova" or "Hey Nova"...');
        
        wakeListeningTimeout = setTimeout(() => {
            if (isWakeListening && isListening && wakeWordEnabled) {
                console.log('👂 Restarting wake listening (periodic refresh)');
                recognition.stop();
            }
        }, 30000);
        
    } catch (error) {
        console.error('👂 Error starting wake listening:', error);
        isListening = false;
        if (wakeWordEnabled && hasVoicePermission) {
            setTimeout(() => startWakeListening(), 2000);
        }
    }
}

function stopWakeListening() {
    console.log('👂 Stopping wake phrase listening...');
    
    if (wakeListeningTimeout) {
        clearTimeout(wakeListeningTimeout);
        wakeListeningTimeout = null;
    }
    
    // Clear any pending restarts
    restartPending = false;
    
    isWakeListening = false;
    window.isWakeListening = false; // Update global state
    
    if (recognition && isListening) {
        isListening = false; // Set this first to prevent restart loops
        window.isListening = false; // Update global state
        try {
            recognition.abort(); // Use abort for immediate stop
            console.log('👂 Voice recognition force stopped');
        } catch (e) {
            console.log('👂 Recognition already stopped:', e.message);
        }
    }
    
    updateVoiceStatus('Press and hold microphone to speak');
    console.log('👂 Wake phrase listening stopped');
}

// Function to restore wake listening after voice response completes
function restoreWakeListeningAfterResponse() {
    console.log('🔄 restoreWakeListeningAfterResponse called');
    console.log('🔄 wakeWordEnabled:', wakeWordEnabled);
    console.log('🔄 isWakeListening:', isWakeListening);
    console.log('🔄 isListening:', isListening);
    console.log('🔄 isWakeWordSession:', isWakeWordSession);
    
    if (alwaysListeningHotkeyMode) {
        console.log('🔄 R+T always-listening mode active - restoring continuous listening');
        isWakeWordSession = false;
        window.isWakeWordSession = false;
        updateVoiceStatus(getAlwaysListeningStatus());
        setTimeout(() => {
            if (alwaysListeningHotkeyMode && !isListening && !isSpeechOutputActive) {
                startAlwaysListeningTurn();
            }
        }, 400);
        return;
    }

    if (!wakeWordEnabled) {
        console.log('🔄 Wake word disabled - not restoring');
        // Reset session flag
        isWakeWordSession = false;
        window.isWakeWordSession = false;
        return;
    }
    
    if (isWakeListening || isListening) {
        console.log('🔄 Already listening - not restoring');
        return;
    }
    
    console.log('🔄 Restoring wake listening after response...');
    
    // Wait for any speech to fully complete
    setTimeout(() => {
        // Double check speech isn't active
        if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
            console.log('🔄 Speech still active, retrying in 500ms...');
            setTimeout(restoreWakeListeningAfterResponse, 500);
            return;
        }
        
        // Reset wake word session flag
        console.log('🔄 Resetting isWakeWordSession flag');
        isWakeWordSession = false;
        window.isWakeWordSession = false;
        
        // Restore handlers and start wake listening
        console.log('🔄 Speech complete - restoring handlers and starting wake listening');
        setupSpeechRecognition();
        
        setTimeout(() => {
            if (wakeWordEnabled && !isWakeListening && !isListening) {
                isWakeListening = true;
                window.isWakeListening = true;
                startWakeListening();
            }
        }, 300);
    }, 500);
}

// Export for global use
window.restoreWakeListeningAfterResponse = restoreWakeListeningAfterResponse;

// Manual microphone control function for user
function toggleMicrophone() {
    console.log('🎤 Push-to-talk mode enabled - press and hold microphone to speak');
    showVoiceNotification('Press and hold microphone to speak', 2000);
    
    if (!hasVoicePermission && isVoiceSupported) {
        console.log('🎤 Requesting microphone permission...');
        requestVoicePermission();
    }
}

function handleWakePhrase() {
    console.log('🎯 Wake phrase detected - transitioning to command mode');
    isWakeListening = false;
    isListening = false;
    isWakeWordSession = true; // Mark this as wake word session
    window.isWakeWordSession = true; // Also set global flag
    console.log('🎯 ✅ isWakeWordSession = true');
    
    // Stop recognition cleanly
    if (recognition) {
        try {
            recognition.stop();
        } catch (e) {
            console.log('🎯 Recognition already stopped:', e.message);
        }
    }
    
    // Visual feedback
    updateVoiceStatus('N.O.V.A activated! Listening...');
    showVoiceNotification('N.O.V.A listening...', 3000);
    
    // Audio feedback with proper callback
    speakText('Yes, sir? How may I assist you?', () => {
        console.log('🎯 Wake phrase response finished - starting command listening');
        // Start command listening after a small delay
        setTimeout(() => {
            startCommandListening();
        }, 500);
    });
    
    // Visual activation effect
    activateNovaUI();
}

function startCommandListening() {
    if (!recognition) return;
    
    console.log('🎤 Starting command listening...');
    updateVoiceStatus('Ready for your command...');
    isListening = true;
    window.isListening = true;
    
    let commandTranscript = '';
    
    // Set timeout for command listening
    const commandTimeout = setTimeout(() => {
        if (isListening) {
            console.log('🎤 Command timeout - no command received');
            recognition.stop();
            speakText('I didn\'t catch that, sir.', () => {
                console.log('🎤 Timeout message complete - restoring wake listening');
                if (wakeWordEnabled) {
                    setupSpeechRecognition();
                    setTimeout(() => {
                        isWakeListening = true;
                        window.isWakeListening = true;
                        startWakeListening();
                    }, 500);
                }
            });
        }
    }, 10000);
    
    // Override the onresult handler for command listening
    recognition.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript.trim();
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        console.log('🎤 Command recognition - Final:', finalTranscript, 'Interim:', interimTranscript);
        
        if (finalTranscript) {
            commandTranscript = finalTranscript;
            console.log('🎤 ✅ COMMAND CAPTURED:', commandTranscript);
            updateVoiceStatus(`Captured: "${commandTranscript}"`);
            
            // Process the command immediately
            clearTimeout(commandTimeout);
            recognition.stop();
            
            console.log('🎤 Recognition stopped, processing command in 500ms...');
            // Process the command after recognition stops
            setTimeout(() => {
                if (commandTranscript) {
                    console.log('🎤 ➡️ Calling processVoiceCommand with:', commandTranscript);
                    processVoiceCommand(commandTranscript);
                } else {
                    console.error('🎤 ❌ commandTranscript is empty!');
                }
            }, 500);
        } else if (interimTranscript) {
            updateVoiceStatus(`Listening: "${interimTranscript}"`);
        }
    };
    
    // Override the onend handler for command listening
    recognition.onend = function() {
        console.log('🎤 Command listening ended');
        clearTimeout(commandTimeout);
        updateVoiceUI(false);
        isListening = false;
        window.isListening = false;
        isWakeListening = false;
        
        // Set a failsafe timeout - if wake listening hasn't restarted in 15 seconds, force restart
        // This ensures we don't get stuck if something fails in the response chain
        if (wakeWordEnabled) {
            console.log('🎤 Setting failsafe timeout for wake listening restoration...');
            setTimeout(() => {
                if (wakeWordEnabled && !isWakeListening && !isListening) {
                    console.warn('⚠️ FAILSAFE: Wake listening not restored after 15s - forcing restart');
                    restoreWakeListeningAfterResponse();
                }
            }, 15000);
        }
        
        console.log('🎤 Command recognition ended - waiting for response to complete');
    };
    
    try {
        recognition.continuous = false;
        recognition.start();
        console.log('🎤 Command listening started successfully');
    } catch (error) {
        console.error('🎤 Error starting command listening:', error);
        clearTimeout(commandTimeout);
        updateVoiceUI(false);
        isListening = false;
        window.isListening = false;
    }
}

function processVoiceCommand(transcript) {
    console.log('🗣️ ==========================================');
    console.log('🗣️ PROCESSING VOICE COMMAND:', transcript);
    console.log('🗣️ ==========================================');
    
    try {
        const command = transcript.toLowerCase().trim();
        console.log('🗣️ Lowercase command:', command);
        
        // Handle specific voice commands through chat system
        if (voiceCommands.greetings.some(greeting => command.includes(greeting))) {
            // Add user message for specific commands we handle directly
            addMessageToChat(transcript, 'user');
            const greetingResponses = [
                "At your service, sir.",
                "Hello, sir. N.O.V.A at your service. How may I assist you today?",
                "Good day, sir. At your service.",
                "Greetings, sir. N.O.V.A at your service."
            ];
            const response = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (voiceCommands.help.some(help => command.includes(help))) {
            addMessageToChat(transcript, 'user');
            const response = 'I can help you with various tasks including answering questions, analyzing data, creating lesson plans, and more. You can also use voice commands by saying "Nova" or "Hey Nova".';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (voiceCommands.clear.some(clear => command.includes(clear))) {
            addMessageToChat(transcript, 'user');
            clearChat();
            const response = 'Chat history cleared, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (command.includes('genius mode') || command.includes('switch to genius')) {
            addMessageToChat(transcript, 'user');
            const response = 'Switching to Genius Mode for advanced problem solving, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (command.includes('professor mode') || command.includes('switch to professor')) {
            addMessageToChat(transcript, 'user');
            const response = 'Switching to Professor Mode for educational assistance, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (command.includes('analyst mode') || command.includes('data analyst')) {
            addMessageToChat(transcript, 'user');
            const response = 'Switching to Data Analyst Mode for research and analysis, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (command.includes('Nova mode') || command.includes('switch to Nova')) {
            addMessageToChat(transcript, 'user');
            const response = 'N.O.V.A Mode active. Sophisticated AI assistance engaged, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (voiceCommands.status.some(status => command.includes(status))) {
            addMessageToChat(transcript, 'user');
            const response = 'All systems are operational. N.O.V.A is online and ready to assist, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else if (voiceCommands.settings.some(setting => command.includes(setting))) {
            addMessageToChat(transcript, 'user');
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) settingsBtn.click();
            const response = 'Opening settings panel for you, sir.';
            addMessageToChat(response, 'Nova');
            if (isWakeWordSession) {
                speakText(response, restoreWakeListeningAfterResponse);
            } else {
                speakText(response);
            }
            
        } else {
            // Process through main interface with OpenAI API
            console.log('🗣️ ==========================================');
            console.log('🗣️ ➡️ No special command matched - routing to AI processing');
            console.log('🗣️ Query:', transcript);
            console.log('🗣️ isWakeWordSession:', isWakeWordSession);
            console.log('🗣️ ==========================================');
            
            // Store wake word flag in window for generateAIResponse to use
            window.isWakeWordSession = isWakeWordSession;
            
            // Use the main interface's processUserMessage function which calls OpenAI API
            if (typeof window.processUserMessage === 'function') {
                console.log('🗣️ ✅ window.processUserMessage found - calling it now...');
                window.processUserMessage(transcript);
                console.log('🗣️ ✅ window.processUserMessage called successfully');
            } else {
                // Fallback - processUserMessage not available, handle manually
                console.error('🗣️ ❌ processUserMessage not available, using fallback');
                addMessageToChat(transcript, 'user');
                
                // Call the main generateAIResponse function directly
                if (typeof window.generateAIResponse === 'function') {
                    console.log('🗣️ ⚠️ Using fallback - calling generateAIResponse directly');
                    window.generateAIResponse(transcript, window.currentPersonality || 'Nova');
                } else {
                    console.error('🗣️ ❌ No AI processing function available');
                    const response = 'I received your query but there seems to be a system issue. Please try typing your request instead, sir.';
                    addMessageToChat(response, 'Nova');
                    if (isWakeWordSession) {
                        speakText(response, restoreWakeListeningAfterResponse);
                    } else {
                        speakText(response);
                    }
                }
            }
        }
    } catch (error) {
        console.error('🗣️ ❌ Error in processVoiceCommand:', error);
        const errorResponse = 'I encountered an error processing your command, sir. Please try again.';
        try {
            addMessageToChat(transcript, 'user');
            addMessageToChat(errorResponse, 'Nova');
            if (isWakeWordSession) {
                speakText(errorResponse, restoreWakeListeningAfterResponse);
            } else {
                speakText(errorResponse);
            }
        } catch (e) {
            console.error('🗣️ ❌ Critical error in error handler:', e);
            // Last resort - just restore wake listening if in wake word mode
            if (isWakeWordSession && typeof restoreWakeListeningAfterResponse === 'function') {
                restoreWakeListeningAfterResponse();
            }
        }
    }
}

function switchVoiceMode(mode) {
    const modeCard = document.querySelector(`[data-personality="${mode}"]`);
    if (modeCard) {
        modeCard.click();
        const modeName = modeCard.querySelector('.mode-name').textContent;
        speakText(`Switching to ${modeName}, sir.`, restoreWakeListeningAfterResponse);
    }
}

// Speech Synthesis Functions
function loadVoices() {
    if (!synthesis) return;
    
    const voices = synthesis.getVoices();
    console.log('🎤 Available voices:', voices.length);
    
    // If no voices loaded yet, wait for them
    if (voices.length === 0) {
        console.log('🎤 Waiting for voices to load...');
        synthesis.onvoiceschanged = loadVoices;
        return;
    }
    
    console.log('🎤 Voices loaded successfully, selecting best Nova voice...');
    // Select best voice for N.O.V.A
    selectBestVoice(voices);
}

function selectBestVoice(voices) {
    // Enhanced voice selection for N.O.V.A
    const NovaVoices = getNovaLikeVoices(voices);
    
    // Store available voices for settings
    window.availableNovaVoices = NovaVoices;
    
    if (NovaVoices.length > 0) {
        // First try to load saved voice preference
        const savedVoice = loadSavedVoicePreference();
        if (savedVoice) {
            console.log('🎯 Using saved Nova voice preference:', savedVoice.name);
            return savedVoice;
        }
        
        // Otherwise use the best scored voice
        const bestVoice = NovaVoices[0]; // Already sorted by preference
        
        // Validate the voice object before using it
        if (isUsableSpeechVoice(bestVoice)) {
            currentVoiceSettings.voice = bestVoice;
            window.selectedVoice = bestVoice; // Sync with global voice system
            console.log('🎯 ✅ Nova VOICE SELECTED:', bestVoice.name);
            console.log('   - Quality Score:', bestVoice.NovaScore);
            console.log('   - Language:', bestVoice.lang);
            console.log('   - Voice Settings: Rate=' + currentVoiceSettings.rate + ', Pitch=' + currentVoiceSettings.pitch + ', Volume=' + currentVoiceSettings.volume);
            return bestVoice;
        } else {
            console.error('🎯 Best voice is not a valid SpeechSynthesisVoice:', bestVoice);
            console.log('🎯 Falling back to browser default voice');
            currentVoiceSettings.voice = null;
            return null;
        }
    } else {
        console.warn('⚠️ No suitable Nova voices found, using default');
        const fallback = voices.find(voice => voice.lang.startsWith('en'));
        if (fallback) {
            currentVoiceSettings.voice = fallback;
            window.selectedVoice = fallback; // Sync with global voice system
            window.availableNovaVoices = [fallback];
        }
        return fallback;
    }
}

function getNovaLikeVoices(voices) {
    // Enhanced voice filtering and ranking for Nova
    const NovaVoicePatterns = [
        // JARVIS-specific voices (Paul Bettany style - highest priority)
        { pattern: /liam.*(brit|united kingdom|uk|gb)/i, score: 115, name: 'Liam (British JARVIS)' },
        { pattern: /paul.*(brit|united kingdom|uk|gb)/i, score: 114, name: 'Paul (British JARVIS)' },
        
        // Premium Nova-like voices (highest priority - British)
        { pattern: /ryan.*(brit|united kingdom|uk|gb)/i, score: 110, name: 'Ryan (British)' },
        { pattern: /george.*(brit|united kingdom|uk|gb)/i, score: 110, name: 'George (British)' },
        { pattern: /oliver.*(brit|united kingdom|uk|gb)/i, score: 108, name: 'Oliver (British)' },
        { pattern: /thomas.*(brit|united kingdom|uk|gb)/i, score: 108, name: 'Thomas (British)' },
        { pattern: /hazel.*(brit|united kingdom|uk|gb)/i, score: 107, name: 'Hazel (British)' },
        { pattern: /alfie.*(brit|united kingdom|uk|gb)/i, score: 109, name: 'Alfie (British)' },
        { pattern: /liam/i, score: 105, name: 'Liam (JARVIS Voice)' },
        { pattern: /google.*uk.*male/i, score: 100, name: 'Google UK Male' },
        { pattern: /microsoft.*david/i, score: 95, name: 'Microsoft David' },
        { pattern: /alex/i, score: 90, name: 'Alex (macOS)' },
        { pattern: /google.*us.*male/i, score: 85, name: 'Google US Male' },
        
        // Good Nova alternatives
        { pattern: /ryan/i, score: 82, name: 'Ryan Voice' },
        { pattern: /george/i, score: 82, name: 'George Voice' },
        { pattern: /microsoft.*mark/i, score: 80, name: 'Microsoft Mark' },
        { pattern: /google.*en.*male/i, score: 75, name: 'Google English Male' },
        { pattern: /oliver/i, score: 72, name: 'Oliver Voice' },
        { pattern: /thomas/i, score: 72, name: 'Thomas Voice' },
        { pattern: /alfie/i, score: 72, name: 'Alfie Voice' },
        { pattern: /microsoft.*.*male/i, score: 70, name: 'Microsoft Male Voice' },
        { pattern: /arthur/i, score: 68, name: 'Arthur Voice' },
        
        // Acceptable alternatives
        { pattern: /daniel/i, score: 65, name: 'Daniel Voice' },
        { pattern: /james/i, score: 60, name: 'James Voice' },
        { pattern: /matthew/i, score: 55, name: 'Matthew Voice' },
        { pattern: /william/i, score: 52, name: 'William Voice' },
        
        // Fallback male voices
        { pattern: /male/i, score: 30, name: 'Generic Male Voice' },
        
        // Last resort (avoid female voices for Nova)
        { pattern: /.*/, score: 10, name: 'Any Voice' }
    ];
    
    const rankedVoices = [];
    
    voices.forEach(voice => {
        // Only consider English voices
        if (!voice.lang.startsWith('en')) return;
        
        let bestScore = 0;
        let bestPattern = null;
        
        // Find the best matching pattern
        for (const pattern of NovaVoicePatterns) {
            if (pattern.pattern.test(voice.name)) {
                if (pattern.score > bestScore) {
                    bestScore = pattern.score;
                    bestPattern = pattern;
                }
            }
        }
        
        // Additional scoring factors
        if (voice.name.toLowerCase().includes('british') || 
            voice.name.toLowerCase().includes('united kingdom') || 
            voice.name.toLowerCase().includes('uk')) {
            bestScore += 10; // British accent bonus for Nova
        }
        
        if (voice.name.toLowerCase().includes('liam') || voice.lang.includes('CA')) {
            bestScore += 12; // Canadian (Liam) accent bonus for JARVIS voice
        }
        
        if (voice.name.toLowerCase().includes('neural') || 
            voice.name.toLowerCase().includes('natural') || 
            voice.name.toLowerCase().includes('premium')) {
            bestScore += 5; // Premium voice bonus
        }
        
        // Penalty for female voices (Nova should be male)
        if (voice.name.toLowerCase().includes('female') || 
            voice.name.toLowerCase().includes('woman') ||
            voice.name.toLowerCase().includes('zira') ||
            voice.name.toLowerCase().includes('susan') ||
            voice.name.toLowerCase().includes('victoria')) {
            bestScore = Math.max(5, bestScore - 50);
        }
        
        if (bestScore > 15) { // Only include decent voices
            // Don't spread the voice object as it breaks SpeechSynthesisVoice
            // Instead, add properties directly to the original voice object
            voice.NovaScore = bestScore;
            voice.patternMatch = bestPattern?.name || 'Unknown';
            rankedVoices.push(voice);
        }
    });
    
    // Sort by score (highest first)
    rankedVoices.sort((a, b) => b.NovaScore - a.NovaScore);
    
    console.log('🎤 Available Nova voices:', rankedVoices.map(v => `${v.name} (Score: ${v.NovaScore})`));
    
    if (rankedVoices.length > 0) {
        console.log('🎯 Top 3 Nova voice recommendations:');
        rankedVoices.slice(0, 3).forEach((v, i) => {
            console.log(`  ${i + 1}. ${v.name} - Score: ${v.NovaScore} (${v.lang})`);
        });
    }
    
    return rankedVoices;
}

function speakText(text, onEndCallback = null) {
    console.log('🔊 speakText called with:', text);
    console.log('🔊 synthesis available:', !!synthesis);
    console.log('🔊 isSpeaking:', isSpeaking);
    console.log('🔊 currentVoiceSettings:', currentVoiceSettings);
    console.log('🔊 selectedVoiceMode:', selectedVoiceMode, 'selectedJarvisPackId:', selectedJarvisPackId);
    
    if (!synthesis) {
        console.error('🔊 Speech synthesis not available');
        return;
    }
    
    const shouldResumeWakeListening = wakeWordEnabled && (isWakeListening || isWakeWordSession);

    if (recognition && isListening) {
        console.log('🔇 Pausing speech recognition before speaking...');
        restartPending = false;
        if (isWakeListening) {
            stopWakeListening();
        } else {
            isListening = false;
            window.isListening = false;
            try {
                recognition.abort();
            } catch (error) {
                console.warn('🔇 Could not abort recognition before speech:', error);
            }
        }
    }

    const finalOnEndCallback = function() {
        if (typeof onEndCallback === 'function') {
            onEndCallback();
        } else if (shouldResumeWakeListening) {
            restoreWakeListeningAfterResponse();
        }
    };

    // CRITICAL: Stop recognition and wait before speaking to prevent feedback loop
    const startSpeaking = async () => {
        if (isSpeaking) {
            console.log('🔊 Already speaking, canceling previous');
            synthesis.cancel();
            setTimeout(() => speakText(text, finalOnEndCallback), 100);
            return;
        }

        if (selectedVoiceMode === 'jarvis-pack' && selectedJarvisPackId) {
            ensureJarvisResponseVoice();
        }

        const usedBridge = await playViaLocalVoiceBridge(text, finalOnEndCallback);
        if (usedBridge) {
            return;
        }

        setupUtteranceAndSpeak(text, finalOnEndCallback);
    };
    
    // Wait a bit before speaking to ensure any active recognition has stopped
    setTimeout(startSpeaking, 600);
}

function setupUtteranceAndSpeak(text, onEndCallback) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply current voice settings with validation
    if (isUsableSpeechVoice(currentVoiceSettings.voice)) {
        try {
            utterance.voice = currentVoiceSettings.voice;
            console.log('🔊 Using voice:', currentVoiceSettings.voice.name);
        } catch (error) {
            console.error('🔊 Error setting voice:', error);
            console.log('🔊 Voice object:', currentVoiceSettings.voice);
            // Don't set voice, use browser default
        }
    } else {
        console.log('🔊 No valid voice set, using browser default');
        console.log('🔊 Current voice setting:', currentVoiceSettings.voice);
    }
    
    utterance.rate = currentVoiceSettings.rate;
    utterance.pitch = currentVoiceSettings.pitch;
    utterance.volume = currentVoiceSettings.volume;
    
    console.log('🔊 Voice settings - Rate:', utterance.rate, 'Pitch:', utterance.pitch, 'Volume:', utterance.volume);
    
    utterance.onstart = function() {
        isSpeaking = true;
        window.isSpeaking = true;
        isSpeechOutputActive = true;
        window.isSpeechOutputActive = true;
        updateSpeakingUI(true);
        console.log('🔊 N.O.V.A started speaking:', text);
    };
    
    utterance.onend = function() {
        isSpeaking = false;
        window.isSpeaking = false;
        isSpeechOutputActive = false;
        window.isSpeechOutputActive = false;
        updateSpeakingUI(false);
        console.log('🔊 Speech ended successfully');
        
        // Call the provided callback - let the callback handle wake listening restart
        if (onEndCallback) {
            onEndCallback();
        }
    };
    
    utterance.onerror = function(event) {
        console.error('🔊 Speech synthesis error:', event.error);
        isSpeaking = false;
        window.isSpeaking = false;
        isSpeechOutputActive = false;
        window.isSpeechOutputActive = false;
        updateSpeakingUI(false);
        if (onEndCallback) onEndCallback();
    };
    
    console.log('🔊 Starting speech synthesis...');
    synthesis.speak(utterance);
}

function stopSpeech() {
    if (currentBridgeAudio) {
        currentBridgeAudio.pause();
        currentBridgeAudio.currentTime = 0;
        currentBridgeAudio = null;
    }
    if (synthesis) {
        synthesis.cancel();
        isSpeaking = false;
        window.isSpeaking = false;
        isSpeechOutputActive = false;
        window.isSpeechOutputActive = false;
        updateSpeakingUI(false);
    }
}

// Voice Sampling and Selection Functions
function previewVoice(voice, sampleText = "Greetings, sir. This is how I sound. Do you approve of this voice selection?") {
    if (!synthesis) {
        console.error('Speech synthesis not available for voice preview');
        return;
    }
    
    // Stop any current speech
    synthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(sampleText);
    utterance.voice = voice;
    utterance.rate = currentVoiceSettings.rate;
    utterance.pitch = currentVoiceSettings.pitch;
    utterance.volume = currentVoiceSettings.volume;
    
    console.log('🎤 Previewing voice:', voice.name);
    synthesis.speak(utterance);
    
    return utterance;
}

function selectVoiceById(voiceIndex) {
    if (window.availableNovaVoices && window.availableNovaVoices[voiceIndex]) {
        const selectedVoice = window.availableNovaVoices[voiceIndex];
        currentVoiceSettings.voice = selectedVoice;
        window.selectedVoice = selectedVoice; // Sync with global voice system
        selectedVoiceMode = 'tts';
        selectedJarvisPackId = null;
        console.log('🎯 Voice manually selected:', selectedVoice.name);
        
        // Save preference
        localStorage.setItem('Nova_selected_voice', selectedVoice.name);
        localStorage.setItem('Nova_voice_mode', selectedVoiceMode);
        localStorage.removeItem('Nova_selected_jarvis_pack');
        
        // Preview the selected voice
        previewVoice(selectedVoice, "Voice selection updated, sir. This is your new N.O.V.A voice.");
        
        return selectedVoice;
    }
    return null;
}

function getAvailableVoices() {
    return window.availableNovaVoices || [];
}

function createVoiceSamplePhrase() {
    if (typeof window.getRandomJarvisStylePhrase === 'function') {
        const dynamicPhrase = window.getRandomJarvisStylePhrase();
        if (dynamicPhrase && typeof dynamicPhrase === 'string' && dynamicPhrase.trim().length > 0) {
            return dynamicPhrase.trim();
        }
    }

    const phrases = [
        "At your service, sir.",
        "Good evening, sir. All systems are operational and ready for your commands.",
        "N.O.V.A online. How may I assist you today, sir?",
        "Systems check complete. All parameters are within normal limits.",
        "Standing by for your instructions, sir. All systems are green.",
        "Good day, sir. N.O.V.A is at your service. What can I help you with?",
        "At your service, sir. How may I be of assistance?",
        "Power levels optimal. All systems functioning normally, sir."
    ];
    
    return phrases[Math.floor(Math.random() * phrases.length)];
}

function loadSavedVoicePreference() {
    const savedVoiceName = localStorage.getItem('Nova_selected_voice');
    console.log('🔍 Loading saved voice preference...');
    console.log('🔍 Saved voice name from localStorage:', savedVoiceName);
    console.log('🔍 Available voices count:', window.availableNovaVoices?.length);
    
    if (savedVoiceName && window.availableNovaVoices) {
        console.log('🔍 Searching for voice:', savedVoiceName);
        console.log('🔍 Available voice names:', window.availableNovaVoices.map(v => v.name));
        
        const savedVoice = window.availableNovaVoices.find(v => v.name === savedVoiceName);
        if (savedVoice) {
            currentVoiceSettings.voice = savedVoice;
            window.selectedVoice = savedVoice; // Sync with global voice system
            console.log('🎯 ✅ Loaded saved voice preference:', savedVoice.name);
            return savedVoice;
        } else {
            console.warn('🎯 ⚠️ Saved voice not found in available voices:', savedVoiceName);
        }
    } else {
        console.log('🔍 No saved voice or available voices not ready');
    }
    return null;
}

// Voice Settings Management
function updateVoiceSettings(settings) {
    if (settings) {
        currentVoiceSettings = { ...currentVoiceSettings, ...settings };
        console.log('Voice settings updated:', currentVoiceSettings);
    }
}

function setVoiceVolume(volume) {
    currentVoiceSettings.volume = Math.max(0, Math.min(1, parseFloat(volume)));
    console.log('🔊 Voice volume updated to:', currentVoiceSettings.volume);
}

function setVoiceSpeed(rate) {
    currentVoiceSettings.rate = Math.max(0.5, Math.min(2, parseFloat(rate)));
    console.log('🔊 Voice speed updated to:', currentVoiceSettings.rate);
}

function setVoicePitch(pitch) {
    currentVoiceSettings.pitch = Math.max(0, Math.min(2, parseFloat(pitch)));
    console.log('🔊 Voice pitch updated to:', currentVoiceSettings.pitch);
}

// UI Update Functions
function updateVoiceUI(listening) {
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voiceCircles = document.querySelectorAll('.voice-circle');
    
    if (listening) {
        voiceBtn?.classList.add('active');
        voiceInputBtn?.classList.add('active');
        voiceCircles.forEach(circle => {
            circle.style.borderColor = 'rgba(0, 170, 255, 0.8)';
            circle.style.boxShadow = '0 0 20px rgba(0, 170, 255, 0.5)';
        });
    } else {
        voiceBtn?.classList.remove('active');
        voiceInputBtn?.classList.remove('active');
        voiceCircles.forEach(circle => {
            circle.style.borderColor = 'rgba(0, 170, 255, 0.3)';
            circle.style.boxShadow = 'none';
        });
    }
}

function updateSpeakingUI(speaking) {
    const arcReactor = document.querySelector('.arc-reactor');
    const arcCore = document.querySelector('.arc-core');
    
    if (speaking) {
        arcReactor?.classList.add('speaking');
        arcCore?.style.setProperty('animation', 'coreFlicker 0.3s ease-in-out infinite alternate');
        document.querySelector('.chat-status')?.setAttribute('textContent', 'Speaking...');
    } else {
        arcReactor?.classList.remove('speaking');
        arcCore?.style.setProperty('animation', 'coreFlicker 2s ease-in-out infinite alternate');
        document.querySelector('.chat-status')?.setAttribute('textContent', 'Ready');
    }
}

function updateVoiceStatus(status) {
    const statusElement = document.querySelector('.voice-status-text');
    if (statusElement) {
        statusElement.textContent = status;
    }
    
    // Update button visual state
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        if (isListening) {
            voiceBtn.classList.add('listening');
            voiceBtn.style.color = '#00ff00';
            voiceBtn.title = 'Listening - Release to stop';
        } else {
            voiceBtn.classList.remove('listening');
            voiceBtn.style.color = '#00aaff';
            voiceBtn.title = 'Press and hold to speak';
        }
    }
    
    console.log('🎤 Voice Status:', status);
}

function activateNovaUI() {
    // Add activation animation to arc reactor
    const arcReactor = document.querySelector('.arc-reactor');
    if (arcReactor) {
        arcReactor.style.animation = 'arcReactorGlow 1s ease-in-out';
        setTimeout(() => {
            arcReactor.style.animation = 'arcReactorGlow 3s ease-in-out infinite';
        }, 1000);
    }
    
    // Pulse voice visualizer
    const voiceCircles = document.querySelectorAll('.voice-circle');
    voiceCircles.forEach((circle, index) => {
        circle.style.animation = `voicePulse 0.5s ease-in-out ${index * 0.1}s`;
        setTimeout(() => {
            circle.style.animation = 'voicePulse 2s ease-in-out infinite';
            circle.style.animationDelay = `${index * 0.2}s`;
        }, 1000);
    });
}

function showVoiceNotification(message, duration = 3000) {
    if (window.NovaInterface && window.NovaInterface.showNotification) {
        window.NovaInterface.showNotification(message, duration);
    } else {
        // Fallback notification
        console.log('Voice notification:', message);
    }
}

function disableVoiceFeatures() {
    // Disable voice-related UI elements
    const voiceBtn = document.getElementById('voiceBtn');
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    const voiceInterface = document.querySelector('.voice-interface');
    
    if (voiceBtn) {
        voiceBtn.disabled = true;
        voiceBtn.style.opacity = '0.5';
        voiceBtn.title = 'Voice recognition not supported in this browser';
    }
    
    if (voiceInputBtn) {
        voiceInputBtn.disabled = true;
        voiceInputBtn.style.opacity = '0.5';
        voiceInputBtn.title = 'Voice recognition not supported in this browser';
    }
    
    if (voiceInterface) {
        const status = voiceInterface.querySelector('.voice-status-text');
        if (status) {
            status.textContent = 'Voice recognition not supported in this browser';
        }
    }
    
    isVoiceSupported = false;
}

// Manual Voice Control Functions
function startVoiceRecognition() {
    console.log('🎤 startVoiceRecognition called - isVoiceSupported:', isVoiceSupported, 'hasPermission:', hasVoicePermission, 'recognition:', !!recognition);
    
    if (!isVoiceSupported || !recognition || !hasVoicePermission) {
        console.log('🎤 Cannot start recognition - requirements not met');
        showVoiceNotification('Voice recognition not available or permission not granted', 3000);
        return;
    }
    
    // Don't start if Nova is currently speaking
    const synthSpeaking = window.speechSynthesis &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if ((isSpeaking || isSpeechOutputActive) && !synthSpeaking) {
        isSpeaking = false;
        isSpeechOutputActive = false;
        window.isSpeaking = false;
        window.isSpeechOutputActive = false;
    }
    if (isSpeaking || isSpeechOutputActive || synthSpeaking) {
        console.log('🎤 Cannot start recognition - Nova is speaking');
        showVoiceNotification('Wait for Nova to finish speaking', 2000);
        return;
    }
    
    if (isListening) {
        recognition.stop();
        return;
    }
    
    // Clear any pending transcript and release state
    pendingTranscript = '';
    lastInterimTranscript = '';
    pttReleaseMode = false;
    
    // Stop wake listening temporarily (will be restarted when button is released if enabled)
    const wasWakeListening = isWakeListening;
    if (wasWakeListening) {
        console.log('🎤 Temporarily stopping wake listening for push-to-talk');
        stopWakeListening();
    }
    
    updateVoiceStatus('Listening for your command...');
    
    try {
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.start();
    } catch (error) {
        console.error('Error starting manual voice recognition:', error);
        updateVoiceUI(false);
        isListening = false;
        pendingTranscript = '';
        
        // Restart wake listening if it was active
        if (wasWakeListening && wakeWordEnabled) {
            isWakeListening = true;
            setTimeout(() => startWakeListening(), 1000);
        }
    }
}

// Settings Integration
async function enableWakeListening(enabled) {
    console.log('🎤 Wake listening toggle:', enabled);
    localStorage.setItem('Nova_wake_word_enabled', enabled ? 'true' : 'false');
    
    if (enabled) {
        // Enable wake listening
        if (!isVoiceSupported) {
            console.warn('⚠️ Voice recognition not supported');
            showVoiceNotification('Voice recognition not supported in this browser', 3000);
            return;
        }
        
        if (!hasVoicePermission) {
            console.log('🎤 Requesting microphone permission for wake listening...');
            const granted = await requestVoicePermission();
            if (!granted) {
                console.log('🎤 Permission denied - cannot enable wake listening');
                updateVoiceStatus('Microphone access required to enable wake phrase listening');
                return;
            }
        }
        
        wakeWordEnabled = true;
        // Do NOT pre-set isWakeListening here — startWakeListening() sets it
        // when recognition actually starts. Pre-setting it causes
        // restoreWakeListeningAfterResponse to wrongly skip a restart.
        
        console.log('🎤 Wake listening enabled - starting...');
        showVoiceNotification('Wake word enabled - Say "Nova" or "Hey Nova"', 3000);
        updateVoiceStatus('Listening for "Nova" or "Hey Nova"...');
        
        startWakeListening();
    } else {
        // Disable wake listening
        wakeWordEnabled = false;
        console.log('🎤 Wake listening disabled - using push-to-talk mode only');
        showVoiceNotification('Wake word disabled - Press and hold mic to speak', 3000);
        updateVoiceStatus('Press and hold microphone to speak');
        
        stopWakeListening();
    }
}

function enableVoiceResponse(enabled) {
    isVoiceResponseEnabled = enabled;
}

// Test speech function for debugging
function testSpeech() {
    console.log('🔊 Testing speech synthesis...');
    console.log('🔊 Available voices:', synthesis.getVoices().length);
    console.log('🔊 Current voice settings:', currentVoiceSettings);
    
    if (!synthesis) {
        console.error('🔊 Speech synthesis not available');
        return;
    }
    
    speakText('Testing speech synthesis, sir. If you can hear this, voice output is working properly.');
}

// Export functions for main interface
window.initializeVoice = initializeVoice;
window.startVoiceRecognition = startVoiceRecognition;
window.speakText = speakText;
window.stopSpeech = stopSpeech;
window.updateVoiceSettings = updateVoiceSettings;
window.setVoiceVolume = setVoiceVolume;
window.setVoiceSpeed = setVoiceSpeed;
window.setVoicePitch = setVoicePitch;
window.enableWakeListening = enableWakeListening;
window.enableVoiceResponse = enableVoiceResponse;
window.testSpeech = testSpeech;

// Voice selection and sampling functions
window.getAvailableVoices = getAvailableVoices;
window.previewVoice = previewVoice;
window.selectVoiceById = selectVoiceById;
window.createVoiceSamplePhrase = createVoiceSamplePhrase;

// Voice Selection UI Functions
function populateVoiceSelection() {
    const voiceSelect = document.getElementById('voiceSelection');
    if (!voiceSelect || !window.availableNovaVoices) return;

    voiceSelect.innerHTML = '';

    const jarvisPacks = Array.isArray(window.JARVIS_AUDIO_PACKS) ? window.JARVIS_AUDIO_PACKS : [];
    if (jarvisPacks.length > 0) {
        const packSeparator = document.createElement('option');
        packSeparator.value = '';
        packSeparator.textContent = '───── JARVIS Audio Packs (.wav) ─────';
        packSeparator.disabled = true;
        voiceSelect.appendChild(packSeparator);

        jarvisPacks.forEach(pack => {
            const option = document.createElement('option');
            option.value = `pack:${pack.id}`;
            option.textContent = `${pack.name} 🎵`;
            if (selectedVoiceMode === 'jarvis-pack' && selectedJarvisPackId === pack.id) {
                option.selected = true;
            }
            voiceSelect.appendChild(option);
        });
    }

    const ttsSeparator = document.createElement('option');
    ttsSeparator.value = '';
    ttsSeparator.textContent = '───── Browser TTS Voices ─────';
    ttsSeparator.disabled = true;
    voiceSelect.appendChild(ttsSeparator);

    const availableVoices = window.availableNovaVoices;
    availableVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = `tts:${index}`;
        option.textContent = `${voice.name} (Score: ${voice.NovaScore})`;
        if (selectedVoiceMode !== 'jarvis-pack' && currentVoiceSettings.voice && voice.name === currentVoiceSettings.voice.name) {
            option.selected = true;
        }
        voiceSelect.appendChild(option);
    });

    if (selectedVoiceMode === 'jarvis-pack' && selectedJarvisPackId) {
        const packOption = `pack:${selectedJarvisPackId}`;
        if (Array.from(voiceSelect.options).some(option => option.value === packOption)) {
            voiceSelect.value = packOption;
        }
    }

    console.log(`🎤 Populated voice selection with ${availableVoices.length} browser voices`);
}

function initializeVoiceSelectionUI() {
    const voiceSelect = document.getElementById('voiceSelection');
    const previewBtn = document.getElementById('previewVoiceBtn');
    
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue.startsWith('pack:')) {
                const packId = selectedValue.replace('pack:', '');
                localVoiceBridgeEnabled = true;
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'true');
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('jarvis-pack', packId);
                }
                ensureJarvisResponseVoice();
                const played = playJarvisPackSample('Voice pack selected, sir.');
                if (!played) speakText('Voice pack selected, sir.');
                return;
            }

            const selectedIndex = parseInt(selectedValue.replace('tts:', ''), 10);
            if (!isNaN(selectedIndex) && window.availableNovaVoices && window.availableNovaVoices[selectedIndex]) {
                localVoiceBridgeEnabled = false;
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'false');
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                selectVoiceById(selectedIndex);
                showVoiceNotification('Browser TTS voice selected', 2000);
            }
        });
    }
    
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            const selectedValue = voiceSelect ? voiceSelect.value : '';
            const sampleText = createVoiceSamplePhrase();

            if (selectedValue && selectedValue.startsWith('pack:')) {
                const packId = selectedValue.replace('pack:', '');
                localVoiceBridgeEnabled = true;
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'true');
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('jarvis-pack', packId);
                }
                const played = playJarvisPackSample(sampleText);
                if (!played) speakText(sampleText);
                return;
            }

            const selectedIndex = parseInt((selectedValue || '').replace('tts:', ''), 10);
            if (!isNaN(selectedIndex) && window.availableNovaVoices && window.availableNovaVoices[selectedIndex]) {
                localVoiceBridgeEnabled = false;
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'false');
                previewVoice(window.availableNovaVoices[selectedIndex], sampleText);
                return;
            }

            speakText(sampleText);
        });
    }
}

function setupSettingsEventListeners() {
    // Voice volume control
    const volumeSlider = document.getElementById('voiceVolume');
    if (volumeSlider) {
        volumeSlider.addEventListener('input', function() {
            setVoiceVolume(parseFloat(this.value));
        });
    }
    
    // Voice speed control
    const speedSlider = document.getElementById('voiceSpeed');
    if (speedSlider) {
        speedSlider.addEventListener('input', function() {
            setVoiceSpeed(parseFloat(this.value));
        });
    }
    
    // Wake phrase toggle
    const wakeToggle = document.getElementById('wakePhraseEnabled');
    if (wakeToggle) {
        wakeToggle.checked = wakeWordEnabled;
        wakeToggle.addEventListener('change', function() {
            enableWakeListening(this.checked);
        });
    }
    
    // Voice response toggle
    const responseToggle = document.getElementById('voiceResponse');
    if (responseToggle) {
        responseToggle.addEventListener('change', function() {
            enableVoiceResponse(this.checked);
        });
    }

    const localBridgeToggle = document.getElementById('localVoiceBridgeEnabled');
    if (localBridgeToggle) {
        localBridgeToggle.checked = localVoiceBridgeEnabled;
        localBridgeToggle.addEventListener('change', function() {
            localVoiceBridgeEnabled = !!this.checked;
            localStorage.setItem('Nova_local_voice_bridge_enabled', localVoiceBridgeEnabled ? 'true' : 'false');
            showVoiceNotification(
                localVoiceBridgeEnabled
                    ? 'Local Python voice bridge enabled'
                    : 'Local Python voice bridge disabled',
                2500
            );
        });
    }

    const localBridgeUrlInput = document.getElementById('localVoiceBridgeUrl');
    if (localBridgeUrlInput) {
        localBridgeUrlInput.value = normalizeBridgeUrl(localVoiceBridgeUrl);
        localBridgeUrlInput.addEventListener('change', function() {
            localVoiceBridgeUrl = normalizeBridgeUrl(this.value);
            this.value = localVoiceBridgeUrl;
            localStorage.setItem('Nova_local_voice_bridge_url', localVoiceBridgeUrl);
            showVoiceNotification('Local voice bridge URL saved', 2000);
        });
    }
}

function setupVoiceButtons() {
    console.log('🎤 Setting up voice buttons (Push-to-Talk mode)...');
    console.log('🎤 Current state - isVoiceSupported:', isVoiceSupported, 'hasPermission:', hasVoicePermission);
    
    // Main voice button - push-to-talk mode
    const voiceBtn = document.getElementById('voiceBtn');
    console.log('🎤 Voice button element:', !!voiceBtn);
    if (voiceBtn) {
        // Ensure only one event listener per button by cloning
        const newVoiceBtn = voiceBtn.cloneNode(true);
        voiceBtn.parentNode.replaceChild(newVoiceBtn, voiceBtn);
        
        // Press and hold to talk
        const startListening = async function(e) {
            e.preventDefault();
            console.log('🎤 Voice button pressed - starting listening...');
            
            // Ensure this is NOT a wake word session (push-to-talk mode)
            isWakeWordSession = false;
            window.isWakeWordSession = false;
            console.log('🎤 Push-to-talk mode - isWakeWordSession = false');
            
            if (!isVoiceSupported) {
                showVoiceNotification('Voice recognition not supported in this browser', 3000);
                return;
            }
            
            if (!hasVoicePermission) {
                console.log('🎤 Requesting microphone permission...');
                const granted = await requestVoicePermission();
                if (!granted) {
                    console.log('🎤 Permission denied');
                    return;
                }
                console.log('🎤 Permission granted - starting listening now');
                showVoiceNotification('Microphone ready! Listening...', 2000);
                // Fall through to start listening immediately
            }
            
            newVoiceBtn.classList.add('recording');
            updateVoiceStatus('Hold to speak - Release when done');
            startVoiceRecognition();
        };
        
        const stopListening = function(e) {
            e.preventDefault();
            console.log('🎤 Voice button released - stopping listening...');
            
            newVoiceBtn.classList.remove('recording');
            
            if (isListening && recognition) {
                try {
                    recognition.stop();
                    console.log('🎤 Recognition stopped - waiting for final results');
                } catch (err) {
                    console.log('🎤 Recognition already stopped');
                }
                
                // Process after recognition has time to finalize
                setTimeout(() => {
                    if (pendingTranscript) {
                        const transcript = pendingTranscript;
                        pendingTranscript = '';
                        isListening = false;
                        window.isListening = false;
                        console.log('🗣️ Processing command on button release:', transcript);
                        updateVoiceStatus('Processing command...');
                        processVoiceCommand(transcript);
                    } else {
                        console.log('🗣️ No transcript captured');
                        isListening = false;
                        window.isListening = false;
                        
                        // Restart wake listening if enabled
                        if (wakeWordEnabled) {
                            console.log('🎤 Restarting wake listening after button release');
                            isWakeListening = true;
                            window.isWakeListening = true;
                            setTimeout(() => startWakeListening(), 1000);
                        } else {
                            updateVoiceStatus('Ready - Press and hold to speak');
                        }
                    }
                }, 500);
            }
        };
        
        // Desktop events
        newVoiceBtn.addEventListener('mousedown', startListening);
        newVoiceBtn.addEventListener('mouseup', stopListening);
        newVoiceBtn.addEventListener('mouseleave', stopListening);
        
        // Mobile events
        newVoiceBtn.addEventListener('touchstart', startListening);
        newVoiceBtn.addEventListener('touchend', stopListening);
        newVoiceBtn.addEventListener('touchcancel', stopListening);
        
        console.log('✅ Main voice button (Push-to-Talk) event listeners attached');
    }
    
    // Input voice button - push-to-talk mode
    const voiceInputBtn = document.getElementById('voiceInputBtn');
    if (voiceInputBtn) {
        // Ensure only one event listener per button by cloning
        const newVoiceInputBtn = voiceInputBtn.cloneNode(true);
        voiceInputBtn.parentNode.replaceChild(newVoiceInputBtn, voiceInputBtn);
        
        const startListening = async function(e) {
            e.preventDefault();
            console.log('🎤 Input voice button pressed - starting listening...');
            
            // Ensure this is NOT a wake word session (push-to-talk mode)
            isWakeWordSession = false;
            window.isWakeWordSession = false;
            console.log('🎤 Push-to-talk mode (input) - isWakeWordSession = false');
            
            if (!isVoiceSupported) {
                showVoiceNotification('Voice recognition not supported in this browser', 3000);
                return;
            }
            
            if (!hasVoicePermission) {
                console.log('🎤 Requesting microphone permission...');
                const granted = await requestVoicePermission();
                if (!granted) {
                    console.log('🎤 Permission denied');
                    return;
                }
                console.log('🎤 Permission granted - starting listening now');
                showVoiceNotification('Microphone ready! Listening...', 2000);
                // Fall through to start listening immediately
            }
            
            newVoiceInputBtn.classList.add('recording');
            updateVoiceStatus('Hold to speak - Release when done');
            startVoiceRecognition();
        };
        
        const stopListening = function(e) {
            e.preventDefault();
            console.log('🎤 Input voice button released - stopping listening...');
            
            newVoiceInputBtn.classList.remove('recording');
            
            if (isListening && recognition) {
                try {
                    recognition.stop();
                    console.log('🎤 Recognition stopped - waiting for final results');
                } catch (err) {
                    console.log('🎤 Recognition already stopped');
                }
                
                // Process after recognition has time to finalize
                setTimeout(() => {
                    if (pendingTranscript) {
                        const transcript = pendingTranscript;
                        pendingTranscript = '';
                        isListening = false;
                        window.isListening = false;
                        console.log('🗣️ Processing command on button release:', transcript);
                        updateVoiceStatus('Processing command...');
                        processVoiceCommand(transcript);
                    } else {
                        console.log('🗣️ No transcript captured');
                        isListening = false;
                        window.isListening = false;
                        
                        // Restart wake listening if enabled
                        if (wakeWordEnabled) {
                            console.log('🎤 Restarting wake listening after input button release');
                            isWakeListening = true;
                            window.isWakeListening = true;
                            setTimeout(() => startWakeListening(), 1000);
                        } else {
                            updateVoiceStatus('Ready - Press and hold to speak');
                        }
                    }
                }, 500);
            }
        };
        
        // Desktop events
        newVoiceInputBtn.addEventListener('mousedown', startListening);
        newVoiceInputBtn.addEventListener('mouseup', stopListening);
        newVoiceInputBtn.addEventListener('mouseleave', stopListening);
        
        // Mobile events
        newVoiceInputBtn.addEventListener('touchstart', startListening);
        newVoiceInputBtn.addEventListener('touchend', stopListening);
        newVoiceInputBtn.addEventListener('touchcancel', stopListening);
        
        console.log('✅ Input voice button (Push-to-Talk) event listeners attached');
    }
    
    // Wake word toggle button
    // ====== WAKE WORD BUTTON - DISABLED/COMMENTED OUT ======
    /*const wakeToggleBtn = document.getElementById('wakeToggleBtn');
    if (wakeToggleBtn) {
        // Load saved state
        const savedState = localStorage.getItem('Nova_wake_word_enabled');
        if (savedState === 'true') {
            wakeWordEnabled = true;
            wakeToggleBtn.classList.add('active');
            wakeToggleBtn.querySelector('i').classList.remove('fa-volume-mute');
            wakeToggleBtn.querySelector('i').classList.add('fa-volume-up');
            wakeToggleBtn.title = '"Hey Nova" wake word ENABLED';
            
            // Auto-start wake listening if permission is already granted
            setTimeout(() => {
                if (hasVoicePermission && wakeWordEnabled) {
                    console.log('🎤 Auto-starting wake listening from saved state');
                    isWakeListening = true;
                    window.isWakeListening = true;
                    startWakeListening();
                }
            }, 2000);
        }
        
        wakeToggleBtn.addEventListener('click', async function() {
            if (!isVoiceSupported) {
                showVoiceNotification('Voice recognition not supported in this browser', 3000);
                return;
            }
            
            if (!hasVoicePermission) {
                const granted = await requestVoicePermission();
                if (!granted) return;
            }
            
            // Toggle state
            wakeWordEnabled = !wakeWordEnabled;
            localStorage.setItem('Nova_wake_word_enabled', wakeWordEnabled);
            
            const icon = this.querySelector('i');
            
            if (wakeWordEnabled) {
                this.classList.add('active');
                icon.classList.remove('fa-volume-mute');
                icon.classList.add('fa-volume-up');
                this.title = '"Hey Nova" wake word ENABLED';
                
                console.log('🎤 Wake word enabled - starting wake listening');
                showVoiceNotification('Wake word enabled - Say "Nova" or "Hey Nova"', 3000);
                updateVoiceStatus('Say "Nova" or "Hey Nova", or press and hold microphone');
                
                // Start wake listening
                isWakeListening = true;
                window.isWakeListening = true;
                startWakeListening();
            } else {
                this.classList.remove('active');
                icon.classList.remove('fa-volume-up');
                icon.classList.add('fa-volume-mute');
                this.title = '"Hey Nova" wake word DISABLED';
                
                console.log('🎤 Wake word disabled - stopping wake listening');
                showVoiceNotification('Wake word disabled - Press and hold mic only', 3000);
                updateVoiceStatus('Press and hold microphone to speak');
                
                // Stop wake listening
                stopWakeListening();
            }
        });
        
        console.log('✅ Wake word toggle button initialized');
        
        // Auto-start wake listening if enabled
        if (wakeWordEnabled && hasVoicePermission) {
            console.log('🎤 Auto-starting wake listening (enabled by user preference)');
            isWakeListening = true;
            window.isWakeListening = true;
            setTimeout(() => startWakeListening(), 1000);
        }
    }*/
    // ====== END WAKE WORD BUTTON - DISABLED ======
    
    console.log('🎤 Voice buttons initialized');
}

// ====== GROQ WHISPER PTT RECORDING ======
let groqMediaRecorder = null;
let groqAudioChunks = [];
let groqRecordingActive = false;

async function startGroqRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        groqAudioChunks = [];

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : '';

        groqMediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType })
            : new MediaRecorder(stream);

        groqMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) groqAudioChunks.push(e.data);
        };

        groqMediaRecorder.start(100);
        groqRecordingActive = true;
        updateVoiceUI(true);
        updateVoiceStatus('Listening for your command...');
        console.log('🎤 Groq Whisper recording started');
    } catch (err) {
        console.error('🎤 Failed to start Groq recording:', err);
        showVoiceNotification('Microphone access denied. Please allow microphone access.', 4000);
        hotkeyActive = false;
        hotkeyListening = false;
    }
}

async function stopGroqRecordingAndTranscribe() {
    if (!groqMediaRecorder || !groqRecordingActive) return;

    groqRecordingActive = false;
    updateVoiceUI(false);
    updateVoiceStatus('Processing...');

    return new Promise((resolve) => {
        groqMediaRecorder.onstop = async () => {
            groqMediaRecorder.stream.getTracks().forEach(t => t.stop());

            if (groqAudioChunks.length === 0) {
                updateVoiceStatus(getDefaultReadyStatus());
                showVoiceNotification('No audio captured', 2000);
                return resolve();
            }

            const mimeType = groqMediaRecorder.mimeType || 'audio/webm';
            const audioBlob = new Blob(groqAudioChunks, { type: mimeType });
            groqAudioChunks = [];

            try {
                const formData = new FormData();
                const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
                formData.append('file', audioBlob, `recording.${ext}`);
                formData.append('model', 'whisper-large-v3-turbo');
                formData.append('language', 'en');
                formData.append('response_format', 'json');

                const apiKey = (typeof GROQ_API_KEY !== 'undefined' && GROQ_API_KEY) || '';

                const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                    body: formData
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`Groq API ${response.status}: ${errText}`);
                }

                const data = await response.json();
                const transcript = data.text && data.text.trim();

                if (transcript) {
                    console.log('🎤 Groq Whisper transcript:', transcript);
                    updateVoiceStatus('Processing command...');
                    processVoiceCommand(transcript);
                } else {
                    updateVoiceStatus(getDefaultReadyStatus());
                    showVoiceNotification('No speech detected - try again', 2000);
                }
            } catch (err) {
                console.error('🎤 Groq Whisper transcription error:', err);
                showVoiceNotification('Transcription failed - please try again', 3000);
                updateVoiceStatus(getDefaultReadyStatus());
            }

            resolve();
        };

        groqMediaRecorder.stop();
    });
}
// ====== END GROQ WHISPER PTT RECORDING ======

// ====== HOTKEY 'R' FOR PUSH-TO-TALK + 'R+T' TOGGLE ======
let hotkeyActive = false;
let hotkeyListening = false;
let pttReleaseMode = false;
let hotkeyRPressed = false;
let hotkeyTPressed = false;
let hotkeyComboHandled = false;

function getDefaultReadyStatus() {
    return alwaysListeningHotkeyMode
        ? 'Always listening (R+T to turn off)'
        : 'Ready - Press and hold R to speak';
}

function getAlwaysListeningStatus() {
    return 'Always listening... Speak naturally (R+T to turn off)';
}

function clearHotkeyRecordingUI() {
    const voiceBtn = document.getElementById('voiceBtn');
    if (voiceBtn) {
        voiceBtn.classList.remove('recording');
    }
}

async function toggleAlwaysListeningMode() {
    if (alwaysListeningHotkeyMode) {
        alwaysListeningHotkeyMode = false;
        alwaysListeningTurnActive = false;
        window.alwaysListeningHotkeyMode = false;
        hotkeyActive = false;
        hotkeyListening = false;
        clearHotkeyRecordingUI();
        if (recognition && isListening) {
            try { recognition.abort(); } catch (e) {}
        }
        updateVoiceStatus(getDefaultReadyStatus());
        showVoiceNotification('Always-listening mode disabled', 2000);
        return;
    }

    if (!isVoiceSupported) {
        showVoiceNotification('Voice recognition not supported in this browser', 3000);
        return;
    }

    if (!hasVoicePermission) {
        const granted = await requestVoicePermission();
        if (!granted) {
            return;
        }
    }

    hotkeyActive = false;
    hotkeyListening = false;
    pttReleaseMode = false;
    clearHotkeyRecordingUI();
    if (groqRecordingActive) {
        await stopGroqRecordingAndTranscribe();
    } else if (recognition && isListening) {
        try { recognition.abort(); } catch (e) {}
    }

    isWakeListening = false;
    window.isWakeListening = false;
    alwaysListeningHotkeyMode = true;
    alwaysListeningTurnActive = false;
    window.alwaysListeningHotkeyMode = true;
    showVoiceNotification('Always-listening mode enabled (R+T to turn off)', 2500);
    updateVoiceStatus(getAlwaysListeningStatus());
    startAlwaysListeningTurn();
}

function startAlwaysListeningTurn() {
    if (!alwaysListeningHotkeyMode || !recognition || !hasVoicePermission || !isVoiceSupported) {
        return;
    }

    const synthSpeaking = window.speechSynthesis &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if (isSpeaking || isSpeechOutputActive || synthSpeaking) {
        setTimeout(() => {
            if (alwaysListeningHotkeyMode) startAlwaysListeningTurn();
        }, 500);
        return;
    }

    if (isListening || alwaysListeningTurnActive) {
        return;
    }

    pendingTranscript = '';
    lastInterimTranscript = '';
    alwaysListeningTurnActive = true;
    isWakeWordSession = true;
    window.isWakeWordSession = true;
    updateVoiceStatus(getAlwaysListeningStatus());
    try {
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.start();
    } catch (error) {
        console.error('🎙️ Failed to start always-listening turn:', error);
        alwaysListeningTurnActive = false;
        setTimeout(() => {
            if (alwaysListeningHotkeyMode) startAlwaysListeningTurn();
        }, 600);
    }
}

function setupPushToTalkHotkey() {
    console.log('⌨️ Setting up push-to-talk hotkey (R) and always-listening toggle (R+T)...');
    
    document.addEventListener('keydown', async function(e) {
        const target = e.target;
        const key = e.key.toLowerCase();
        const isInInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        
        // Never intercept R or T while user is typing in any input/textarea
        if (isInInput) {
            return;
        }

        if (key === 'r') hotkeyRPressed = true;
        if (key === 't') hotkeyTPressed = true;

        if (hotkeyRPressed && hotkeyTPressed && !hotkeyComboHandled) {
            e.preventDefault();
            hotkeyComboHandled = true;
            await toggleAlwaysListeningMode();
            return;
        }

        if (alwaysListeningHotkeyMode) {
            return;
        }
        
        // Check if 'R' key is pressed (case insensitive)
        if (key === 'r' && !hotkeyActive) {
            e.preventDefault();
            hotkeyActive = true;
            
            console.log('⌨️ Hotkey R pressed - starting voice recognition...');
            
            if (!isVoiceSupported) {
                showVoiceNotification('Voice recognition not supported in this browser', 3000);
                hotkeyActive = false;
                return;
            }
            
            // Ensure this is NOT a wake word session (push-to-talk mode)
            isWakeWordSession = false;
            window.isWakeWordSession = false;
            
            const voiceBtn = document.getElementById('voiceBtn');
            
            // Request mic permission if needed, then start listening
            if (!hasVoicePermission) {
                requestVoicePermission().then(granted => {
                    if (!granted) { hotkeyActive = false; return; }
                    hotkeyListening = true;
                    updateVoiceStatus('Hold R to speak - Release when done');
                    showVoiceNotification('Listening...', 2000);
                    if (voiceBtn) voiceBtn.classList.add('recording');
                    startVoiceRecognition();
                });
                return;
            }
            
            // Visual feedback
            updateVoiceStatus('Hold R to speak - Release when done');
            showVoiceNotification('Listening...', 2000);
            if (voiceBtn) voiceBtn.classList.add('recording');
            
            hotkeyListening = true;
            startVoiceRecognition();
        }
    });
    
    document.addEventListener('keyup', function(e) {
        const key = e.key.toLowerCase();
        if (key === 'r') hotkeyRPressed = false;
        if (key === 't') hotkeyTPressed = false;
        if (!hotkeyRPressed && !hotkeyTPressed) {
            hotkeyComboHandled = false;
        }

        if (alwaysListeningHotkeyMode) {
            return;
        }

        // Check if 'R' key is released
        if (key === 'r' && hotkeyActive) {
            e.preventDefault();
            hotkeyActive = false;
            
            console.log('⌨️ Hotkey R released - stopping voice recognition...');
            
            // Remove visual indicator
            const voiceBtn = document.getElementById('voiceBtn');
            if (voiceBtn) {
                voiceBtn.classList.remove('recording');
            }
            
            if (hotkeyListening) {
                hotkeyListening = false;
                if (groqRecordingActive) {
                    stopGroqRecordingAndTranscribe();
                } else if (recognition && isListening) {
                    updateVoiceStatus('Processing...');
                    pttReleaseMode = true;
                    isListening = false;
                    window.isListening = false;
                    try { recognition.stop(); } catch(e) {}
                }
            }
        }
    });
    
    console.log('✅ Push-to-talk hotkey (R) initialized, always-listening combo: R+T');
}

// Initialize hotkey on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPushToTalkHotkey);
} else {
    setupPushToTalkHotkey();
}
// ====== END HOTKEY IMPLEMENTATION ======

async function toggleVoiceListening() {
    if (!isVoiceSupported) {
        showVoiceNotification('Voice recognition not supported in this browser', 3000);
        return;
    }

    if (isWakeListening || isListening) {
        // Force stop all recognition
        console.log('🎤 Force stopping all voice recognition...');
        isWakeListening = false;
        isListening = false;
        
        if (wakeListeningTimeout) {
            clearTimeout(wakeListeningTimeout);
            wakeListeningTimeout = null;
        }
        
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {
                console.log('🎤 Recognition already stopped:', e.message);
            }
        }
        
        updateVoiceStatus('Click microphone to enable "Nova" or "Hey Nova" listening');
        showVoiceNotification('Voice recognition disabled', 2000);
        
        // Hide visualizer when voice is disabled
        if (typeof updateVoiceVisualizer === 'function') {
            updateVoiceVisualizer(false);
        }
        
        console.log('🎤 Voice recognition fully disabled');
    } else {
        // Request permission first (only happens once)
        const permissionGranted = await requestVoicePermission();
        
        if (permissionGranted) {
            // Turn on wake listening
            await enableWakeListening(true);
            updateVoiceStatus('Say "Nova" or "Hey Nova" to activate');
            showVoiceNotification('Say "Nova" or "Hey Nova" to activate', 3000);
            
            // Show voice enabled message and activate visualizer
            if (typeof showVoiceEnabledMessage === 'function') {
                showVoiceEnabledMessage();
            }
            if (typeof updateVoiceVisualizer === 'function') {
                updateVoiceVisualizer(true);
            }
            
            console.log('🎤 Wake listening enabled - say "Nova" or "Hey Nova"');
        } else {
            updateVoiceStatus('Microphone access required for voice recognition');
            console.log('🎤 Cannot start voice recognition - permission denied');
        }
    }
}

// Chat System Functions
function setupChatSystem() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearChat');
    
    // Send button handler
    if (sendBtn) {
        sendBtn.addEventListener('click', function() {
            sendMessage();
        });
    }
    
    // Enter key handler
    if (messageInput) {
        messageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    // Clear chat button handler
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            clearChat();
            addMessageToChat('Chat history cleared, sir.', 'Nova');
        });
    }
    
    // Quick action buttons
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(button => {
        button.addEventListener('click', function() {
            const command = this.getAttribute('data-command');
            if (command) {
                addMessageToChat(command, 'user');
                processUserMessage(command);
            }
        });
    });
    
    // Add welcome message
    setTimeout(() => {
        if (isVoiceSupported) {
            addMessageToChat('Good day, sir. N.O.V.A systems are online and ready. To speak: Press and hold the microphone button or the "R" key. For AlwaysListening, press R + T.', 'Nova');
        } else {
            addMessageToChat('Good day, sir. N.O.V.A systems are online and ready. Voice recognition is not supported in this browser, but you can type your message below.', 'Nova');
        }
    }, 1000);
    
    console.log('💬 Chat system initialized');
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    if (!messageInput) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    // Clear input
    messageInput.value = '';
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    
    // Process the message
    processUserMessage(message);
}

function addMessageToChat(message, sender = 'user') {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;
    
    const messageTime = document.createElement('div');
    messageTime.className = 'message-time';
    messageTime.textContent = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(messageTime);
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// This function is now handled by the main interface with OpenAI API
// Voice commands are routed through the main processUserMessage function

function generateNovaResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Greeting patterns
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
        const greetingResponses = [
            "At your service, sir.",
            "Good day, sir. N.O.V.A at your service. How may I assist you today?",
            "Hello, sir. At your service.",
            "Greetings, sir. N.O.V.A systems are online and ready."
        ];
        return greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
    }
    
    // Status and personal queries
    if (lowerMessage.includes('how are you') || lowerMessage.includes('how\'re you') || lowerMessage.includes('status') || lowerMessage.includes('how do you feel')) {
        const statusResponses = [
            "All systems operational, sir. Power levels optimal, voice recognition active, and ready for your commands.",
            "I'm functioning at peak efficiency, sir. All subsystems are green and ready to serve.",
            "Operating at full capacity, sir. How may I be of assistance today?",
            "Systems nominal, sir. Voice synthesis online, cognitive functions optimal. How may I help?"
        ];
        return statusResponses[Math.floor(Math.random() * statusResponses.length)];
    }
    
    // Help requests
    if (lowerMessage.includes('help') || lowerMessage.includes('assist') || lowerMessage.includes('what can you do')) {
        return "I can assist with various tasks, sir. Try asking me about science, mathematics, analysis, or general information. You can also use voice commands by saying 'Nova' or 'Hey Nova'.";
    }
    
    // Chat management
    if (lowerMessage.includes('clear') && (lowerMessage.includes('chat') || lowerMessage.includes('history'))) {
        setTimeout(clearChat, 500);
        return "Clearing chat history, sir.";
    }
    
    // Conversational responses
    if (lowerMessage.includes('thank') || lowerMessage.includes('thanks')) {
        return "You're most welcome, sir. Always a pleasure to assist.";
    }
    
    if (lowerMessage.includes('good morning') || lowerMessage.includes('good afternoon') || lowerMessage.includes('good evening')) {
        const timeGreetings = {
            'good morning': 'Good morning, sir. I trust you slept well?',
            'good afternoon': 'Good afternoon, sir. How may I assist you today?',
            'good evening': 'Good evening, sir. What can I help you with this evening?'
        };
        for (const [greeting, response] of Object.entries(timeGreetings)) {
            if (lowerMessage.includes(greeting)) {
                return response;
            }
        }
    }
    
    if (lowerMessage.includes('voice')) {
        return "Voice systems are fully operational, sir. Press and hold the microphone button to speak directly to me.";
    }
    
    // Default responses
    const defaultResponses = [
        "I understand your inquiry, sir. Let me process that information for you.",
        "Interesting question, sir. My databases are searching for the most relevant information.",
        "Processing your request, sir. My systems are working on that query.",
        "Acknowledged, sir. Allow me to assist you with that matter.",
        "Very good, sir. I'll handle that request with my full analytical capabilities.",
        "Fascinating topic, sir. Let me access my knowledge banks for you."
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function addThinkingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message Nova-message thinking-indicator';
    thinkingDiv.innerHTML = `
        <div class="message-content">
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
            N.O.V.A is thinking...
        </div>
    `;
    
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeThinkingIndicator() {
    const thinking = document.querySelector('.thinking-indicator');
    if (thinking) {
        thinking.remove();
    }
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        // Also clear conversation history if it exists
        if (typeof conversationHistory !== 'undefined') {
            conversationHistory = [];
        }
        // Clear chatHistory if it exists  
        if (typeof chatHistory !== 'undefined') {
            chatHistory = [];
        }
        console.log('💬 Chat and conversation history cleared');
    }
}

// Initialize when DOM is loaded
function initializeFullSystem() {
    initializeVoice();
    setupVoiceButtons();
    setupChatSystem();
    
    // Wait a moment for voices to load, then setup UI
    setTimeout(() => {
        populateVoiceSelection();
        initializeVoiceSelectionUI();
        setupSettingsEventListeners();

        const wakeToggle = document.getElementById('wakePhraseEnabled');
        const storedWakeWordEnabled = localStorage.getItem('Nova_wake_word_enabled');
        const shouldEnableWakeWord = storedWakeWordEnabled === null
            ? (wakeToggle ? !!wakeToggle.checked : true)
            : storedWakeWordEnabled === 'true';

        wakeWordEnabled = shouldEnableWakeWord;
        if (wakeToggle) {
            wakeToggle.checked = shouldEnableWakeWord;
        }

        if (shouldEnableWakeWord) {
            enableWakeListening(true);
        } else {
            updateVoiceStatus('Press and hold microphone to speak');
        }
    }, 1000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFullSystem);
} else {
    initializeFullSystem();
}

// Export key functions and variables globally for integration
window.startWakeListening = startWakeListening;
window.stopWakeListening = stopWakeListening;
window.toggleMicrophone = toggleMicrophone;
window.initializeVoice = initializeVoice;
window.setupVoiceButtons = setupVoiceButtons;
window.requestVoicePermission = requestVoicePermission;
window.isSpeechOutputActive = isSpeechOutputActive;
window.restartPending = restartPending;

// Export voice state getters for hotkey integration
Object.defineProperty(window, 'hasVoicePermission', {
    get: function() { return hasVoicePermission; }
});
Object.defineProperty(window, 'isListening', {
    get: function() { return isListening; }
});

function getSelectedJarvisPack() {
    if (!selectedJarvisPackId) return null;
    return JARVIS_AUDIO_PACKS.find(p => p.id === selectedJarvisPackId) || null;
}

function dedupeClipList(clips) {
    return Array.from(new Set((clips || []).filter(Boolean)));
}

function shuffleClipList(clips) {
    const shuffled = clips.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
    }
    return shuffled;
}

function chooseJarvisPackClip(pack, text = '') {
    const normalized = (text || '').toLowerCase();
    const packId = pack ? pack.id : '';

    const genericCatalog = {
        preview: ['ready.wav', 'poweron.wav', 'power on.wav', 'poweron.wav', 'powerup.wav', 'power up.wav', 'system.wav', 'ok.wav'],
        greeting: ['ready.wav', 'poweron.wav', 'power on.wav', 'welcome.wav', 'hello.wav'],
        confirm: ['updatesuccess.wav', 'updatesuccessful.wav', 'connected.wav', 'configsaved.wav', 'ok.wav'],
        error: ['error.wav', 'failed.wav', 'warning.wav', 'alert.wav', 'sensorerror.wav', 'sdcarderror.wav', 'lowbattery.wav'],
        volume: ['volume.wav', 'volumelevel.wav', 'volup.wav', 'voldown.wav', 'volumecontrol.wav'],
        default: ['ready.wav', 'poweron.wav', 'power on.wav', 'boot.wav', 'powerup.wav']
    };

    const packCatalogs = {
        'jarvis-pack-cfx': {
            preview: ['extra/UI/system.wav', 'extra/UI/diagnostics.wav', 'extra/UI/ok.wav', 'tracks/font.wav', 'tracks/font-alt.wav'],
            greeting: ['extra/UI/system.wav', 'extra/UI/menu.wav', 'extra/UI/ok.wav'],
            confirm: ['extra/UI/configsaved.wav', 'extra/UI/colorsconfigsaved.wav', 'extra/UI/fontconfigsaved.wav', 'extra/UI/ok.wav'],
            error: ['extra/UI/lowbattery.wav', 'extra/UI/lowbattery-alt.wav', 'extra/UI/deadbattery.wav', 'extra/UI/deadbattery-alt.wav'],
            volume: ['extra/UI/volume.wav', 'extra/UI/plus.wav', 'extra/UI/minus.wav'],
            default: ['extra/UI/system.wav', 'tracks/font.wav', 'extra/UI/ok.wav']
        },
        'jarvis-pack-ghv4': {
            preview: ['UserInterfaceSounds/BatteryIndicator/battpwron.wav', 'UserInterfaceSounds/Miscellaneous/bleenabled.wav', 'UserInterfaceSounds/Miscellaneous/wifienabled.wav'],
            greeting: ['UserInterfaceSounds/BatteryIndicator/battpwron.wav', 'UserInterfaceSounds/Miscellaneous/blepairingsuccessful.wav'],
            confirm: ['UserInterfaceSounds/Miscellaneous/blepairingsuccessful.wav', 'UserInterfaceSounds/FirmwareUpdate/endupdate.wav'],
            error: ['UserInterfaceSounds/BatteryIndicator/lowbatt.wav', 'UserInterfaceSounds/Miscellaneous/soundfilemissing.wav', 'UserInterfaceSounds/Miscellaneous/effectfontsmissing.wav'],
            volume: ['UserInterfaceSounds/VolumeControl/bgnvolumecontrol.wav', 'UserInterfaceSounds/VolumeControl/endvolumecontrol.wav'],
            default: ['UserInterfaceSounds/BatteryIndicator/battpwron.wav', 'UserInterfaceSounds/Miscellaneous/rebooting.wav']
        },
        'jarvis-pack-proffie': {
            preview: ['common/mpwrup.wav', 'common/msetting.wav', 'common/mconfirm.wav', 'common/mmain.wav'],
            greeting: ['common/mpwrup.wav', 'common/mconfirm.wav', 'common/maffirm.wav'],
            confirm: ['common/mconfirm.wav', 'common/msave.wav', 'common/maffirm.wav'],
            error: ['common/mcancel.wav', 'common/mlb.wav', 'common/mfalse.wav'],
            volume: ['common/vmbegin.wav', 'common/volup.wav', 'common/voldown.wav', 'common/vmend.wav'],
            default: ['common/mpwrup.wav', 'common/mconfirm.wav', 'common/msetting.wav']
        },
        'jarvis-pack-sn4': {
            preview: ['ready.wav', 'poweron.wav', 'appconnected.wav', 'batterylevel.wav'],
            greeting: ['ready.wav', 'poweron.wav', 'appconnected.wav'],
            confirm: ['updatesuccessful.wav', 'colorselected.wav', 'appconnected.wav'],
            error: ['sensorerror.wav', 'SDcarderror.wav', 'lowbattery.wav'],
            volume: ['volumelevel.wav'],
            default: ['ready.wav', 'poweron.wav', 'blade.wav']
        },
        'jarvis-pack-xeno2': {
            preview: ['PowerOn.wav', 'PowerUp.wav', 'Connected.wav', 'ChargeFull.wav'],
            greeting: ['PowerOn.wav', 'Connected.wav', 'PowerUp.wav'],
            confirm: ['UpgradeSuccess.wav', 'ChargeFull.wav', 'Connected.wav'],
            error: ['LowBattery.wav'],
            volume: ['VolumeLoud.wav', 'VolumeLow.wav', 'VolumeMedia.wav'],
            default: ['PowerOn.wav', 'PowerUp.wav', 'Connected.wav']
        },
        'jarvis-pack-xeno3': {
            preview: ['ready.wav', 'poweron.wav', 'appconnected.wav', 'power (1).wav', 'power (2).wav'],
            greeting: ['ready.wav', 'poweron.wav', 'appconnected.wav'],
            confirm: ['updatesuccessful.wav', 'colorselected.wav', 'appconnected.wav'],
            error: ['sensorerror.wav', 'SDcarderror.wav', 'lowbattery.wav'],
            volume: ['volumelevel.wav'],
            default: ['ready.wav', 'poweron.wav', 'blade.wav']
        }
    };

    let category = 'default';
    if (normalized.includes('error') || normalized.includes('failed') || normalized.includes('problem')) {
        category = 'error';
    } else if (normalized.includes('volume') || normalized.includes('loud') || normalized.includes('quiet')) {
        category = 'volume';
    } else if (normalized.includes('updated') || normalized.includes('selected') || normalized.includes('saved') || normalized.includes('success')) {
        category = 'confirm';
    } else if (normalized.includes('preview') || normalized.includes('test') || normalized.includes('voice') || normalized.includes('sound')) {
        category = 'preview';
    } else if (normalized.includes('hello') || normalized.includes('hi') || normalized.includes('good') || normalized.includes('greetings')) {
        category = 'greeting';
    }

    const packCatalog = packCatalogs[packId] || {};
    const fallbackCategories = ['preview', 'confirm', 'default'];
    const candidates = [];

    candidates.push(...(packCatalog[category] || []));
    candidates.push(...(genericCatalog[category] || []));

    fallbackCategories.forEach(fallbackCategory => {
        if (fallbackCategory !== category) {
            candidates.push(...(packCatalog[fallbackCategory] || []));
            candidates.push(...(genericCatalog[fallbackCategory] || []));
        }
    });

    const dedupedCandidates = dedupeClipList(candidates);
    const lastPlayedClip = lastJarvisPackClipByPack[packId];
    const prioritizedCandidates = dedupedCandidates.filter(clip => clip !== lastPlayedClip);

    if (lastPlayedClip && dedupedCandidates.includes(lastPlayedClip)) {
        prioritizedCandidates.push(lastPlayedClip);
    }

    return shuffleClipList(prioritizedCandidates);
}

function playJarvisPackSample(text = '', onEndCallback = null) {
    const pack = getSelectedJarvisPack();
    if (!pack) return false;

    const clipCandidates = chooseJarvisPackClip(pack, text);
    let candidateIndex = 0;

    const tryPlayNext = () => {
        if (candidateIndex >= clipCandidates.length) {
            console.warn('🔊 No playable JARVIS clip found in pack:', pack.name);
            return false;
        }

        const clip = clipCandidates[candidateIndex++];
        const src = `${pack.basePath}/${clip}`;
        const audio = new Audio(src);
        currentPackAudio = audio;

        audio.onplay = function () {
            lastJarvisPackClipByPack[pack.id] = clip;
            isSpeaking = true;
            window.isSpeaking = true;
            isSpeechOutputActive = true;
            window.isSpeechOutputActive = true;
            updateSpeakingUI(true);
            console.log('🔊 Playing JARVIS pack clip:', src);
        };

        audio.onended = function () {
            isSpeaking = false;
            window.isSpeaking = false;
            isSpeechOutputActive = false;
            window.isSpeechOutputActive = false;
            updateSpeakingUI(false);
            currentPackAudio = null;
            if (onEndCallback) onEndCallback();
        };

        audio.onerror = function () {
            // Try next clip candidate
            if (!tryPlayNext()) {
                // Final failure - cleanup and callback
                isSpeaking = false;
                window.isSpeaking = false;
                isSpeechOutputActive = false;
                window.isSpeechOutputActive = false;
                updateSpeakingUI(false);
                currentPackAudio = null;
                if (onEndCallback) onEndCallback();
            }
        };

        audio.play().catch(() => {
            if (!tryPlayNext()) {
                isSpeaking = false;
                window.isSpeaking = false;
                isSpeechOutputActive = false;
                window.isSpeechOutputActive = false;
                updateSpeakingUI(false);
                currentPackAudio = null;
                if (onEndCallback) onEndCallback();
            }
        });

        return true;
    };

    return tryPlayNext();
}

window.JARVIS_AUDIO_PACKS = JARVIS_AUDIO_PACKS;
window.setVoiceModeSelection = function(mode, packId = null) {
    selectedVoiceMode = mode === 'jarvis-pack' ? 'jarvis-pack' : 'tts';
    selectedJarvisPackId = selectedVoiceMode === 'jarvis-pack' ? packId : null;
    localStorage.setItem('Nova_voice_mode', selectedVoiceMode);
    if (selectedJarvisPackId) {
        localStorage.setItem('Nova_selected_jarvis_pack', selectedJarvisPackId);
        ensureJarvisResponseVoice();
    } else {
        localStorage.removeItem('Nova_selected_jarvis_pack');
    }
    console.log('🎤 Voice mode selection updated:', selectedVoiceMode, selectedJarvisPackId);
};

window.loadVoiceModeSelection = function() {
    const savedMode = localStorage.getItem('Nova_voice_mode');
    const savedPack = localStorage.getItem('Nova_selected_jarvis_pack');
    selectedVoiceMode = savedMode === 'jarvis-pack' ? 'jarvis-pack' : 'tts';
    selectedJarvisPackId = savedMode === 'jarvis-pack' ? savedPack : null;
    console.log('🎤 Loaded voice mode selection:', selectedVoiceMode, selectedJarvisPackId);
};

window.loadVoiceModeSelection();

console.log('🎤 N.O.V.A Voice System loaded successfully');
