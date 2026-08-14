// Runtime UI events + initialization module
// Extracted from nova_runtime_features.js.

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Mode selection
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            const personality = card.dataset.personality;
            if (personality) {
                selectPersonality(personality);
            }
        });
    });
    
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            sendMessageWithAttachment();
        });
    }

    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            continueConversation();
        });
    }
    
    // Enter key for message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Handle Enter key (send message) and Shift+Enter (new line)
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent new line
                sendMessageWithAttachment();
            }
            // Shift+Enter naturally creates new line, no need to handle
        });
        
        // Auto-resize textarea as user types
        messageInput.addEventListener('input', () => {
            autoResizeTextarea(messageInput);
        });
    }
    
    // Quick actions
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(action => {
        action.addEventListener('click', () => {
            const command = action.dataset.command;
            if (command) {
                processUserMessage(command);
            }
        });
    });
    
    // Clear chat
    const clearChatBtn = document.getElementById('clearChat');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }
    
    // Export chat
    const exportChatBtn = document.getElementById('exportChat');
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', openExportModal);
    }
    
    // Close export modal
    const closeExportModalBtn = document.getElementById('closeExportModal');
    if (closeExportModalBtn) {
        closeExportModalBtn.addEventListener('click', closeExportModal);
    }
    
    // Close export modal when clicking outside
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                closeExportModal();
            }
        });
    }
    
    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            if (typeof window.openSettings === 'function') {
                window.openSettings();
            } else {
                settingsModal.style.display = 'flex';
                settingsModal.classList.add('active');
            }
            renderMaterialList();
        });
    }
    
    if (closeSettings && settingsModal) {
        closeSettings.addEventListener('click', () => {
            if (typeof window.closeSettings === 'function') {
                window.closeSettings();
            } else {
                settingsModal.style.display = 'none';
                settingsModal.classList.remove('active');
            }
        });
    }

    // Close settings when clicking outside the modal box
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                if (typeof window.closeSettings === 'function') {
                    window.closeSettings();
                } else {
                    settingsModal.style.display = 'none';
                    settingsModal.classList.remove('active');
                }
            }
        });
    }

    // Material upload input listener
    const materialFileInput = document.getElementById('materialFileInput');
    if (materialFileInput) {
        materialFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                handleMaterialFileUpload(file);
                e.target.value = '';
            }
        });
    }

    // Material paste/add button
    const addMaterialTextBtn = document.getElementById('addMaterialTextBtn');
    const materialTextInput = document.getElementById('materialTextInput');
    const materialTextName = document.getElementById('materialTextName');
    if (addMaterialTextBtn && materialTextInput) {
        addMaterialTextBtn.addEventListener('click', () => {
            const content = materialTextInput.value.trim();
            const name = (materialTextName && materialTextName.value.trim()) || 'Pasted Knowledge Base Entry';
            if (!content) {
                showNotification('Paste some text first.', 2000);
                return;
            }
            addPersistentMaterialItem(name, content);
            materialTextInput.value = '';
            if (materialTextName) materialTextName.value = '';
            showNotification('Knowledge Base item added!', 2000);
        });
    }

    // Clear all material
    const clearAllMaterialBtn = document.getElementById('clearAllMaterialBtn');
    if (clearAllMaterialBtn) {
        clearAllMaterialBtn.addEventListener('click', () => {
            if (persistentMaterial.length === 0) return;
            if (confirm('Remove all Knowledge Base items?')) {
                persistentMaterial = [];
                knowledgeBaseGroups = [];
                collapsedKnowledgeBaseGroups.clear();
                initializedKnowledgeBaseGroups.clear();
                savePersistentMaterial();
                saveKnowledgeBaseGroups();
                renderMaterialList();
                showNotification('Knowledge Base cleared.', 2000);
            }
        });
    }

    const kbCreateGroupBtn = document.getElementById('kbCreateGroupBtn');
    if (kbCreateGroupBtn) {
        kbCreateGroupBtn.addEventListener('click', () => {
            createKnowledgeBaseGroup();
        });
    }
    
    // File upload
    const attachBtn = document.getElementById('attachBtn');
    const fileMenu = document.getElementById('fileMenu');
    
    if (attachBtn && fileMenu) {
        console.log('📎 [nova_main.js] Attaching event listener to attachBtn');
        
        // Ensure menu starts closed
        fileMenu.classList.remove('active');
        console.log('📎 [nova_main.js] Menu initialized as closed');
        
        attachBtn.addEventListener('click', (e) => {
            console.log('📎 Attach button clicked');
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = fileMenu.classList.contains('active');
            
            if (isActive) {
                fileMenu.classList.remove('active');
                console.log('📎 Menu closed');
            } else {
                fileMenu.classList.add('active');
                console.log('📎 Menu opened');
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !attachBtn.contains(e.target)) {
                if (fileMenu.classList.contains('active')) {
                    console.log('📎 [nova_main.js] Closing menu (clicked outside)');
                    fileMenu.classList.remove('active');
                }
            }
        });
    } else {
        console.error('📎 [nova_main.js] Could not find attachBtn or fileMenu!', {attachBtn, fileMenu});
    }

    updateContinuationButtonState();
    renderMaterialList();
}

// Voice Integration Fixes
window.voiceIntegrationFix = function() {
    console.log('🔧 Fixing voice integration...');
    
    // Check if voice script loaded properly
    if (typeof window.initializeVoice !== 'function') {
        console.error('❌ Voice script not loaded properly');
        return false;
    }
    
    // Force initialize voice system
    if (typeof window.initializeVoice === 'function') {
        window.initializeVoice();
    }
    
    // Fix speakText function if not available (with voice recognition coordination)
    if (typeof window.speakText !== 'function') {
        window.speakText = function(text, callback) {
            // Make text speech-friendly
            const speechText = window.makeSpeechFriendly(text);
            
            console.log('🔊 Fallback speakText with voice coordination (original):', text);
            console.log('🔊 Fallback speakText with voice coordination (speech-friendly):', speechText);
            
            if (!window.speechSynthesis) {
                console.error('🔊 Speech synthesis not available');
                return;
            }
            
            // Stop voice recognition during speech (same as enhanced version)
            console.log('🔊 Fallback: Stopping voice recognition during speech...');
            let wasListening = false;
            let wasWakeListening = false;
            
            if (window.isListening) {
                wasListening = true;
                window.isListening = false;
            }
            if (window.isWakeListening) {
                wasWakeListening = true;
                window.isWakeListening = false;
            }
            
            // Stop any active recognition
            if (window.recognition && window.recognition.stop) {
                try {
                    window.recognition.stop();
                    console.log('🔊 Fallback: Voice recognition stopped');
                } catch (e) {
                    console.log('🔊 Fallback: Recognition already stopped');
                }
            }
            
            const utterance = new SpeechSynthesisUtterance(speechText);
            if (window.selectedVoice) {
                utterance.voice = window.selectedVoice;
            }
            utterance.rate = 0.9;
            utterance.pitch = 0.8;
            utterance.volume = 0.7;
            
            utterance.onend = () => {
                console.log('🔊 Fallback: Finished speaking - restarting voice recognition...');
                
                // Restart voice recognition after speech ends
                setTimeout(() => {
                    if (wasWakeListening || wasListening) {
                        console.log('🔊 Fallback: Restarting wake listening after speech...');
                        if (typeof window.startWakeListening === 'function') {
                            window.isWakeListening = true;
                            window.startWakeListening();
                        }
                    }
                }, 500);
                
                if (callback) callback();
            };
            
            utterance.onerror = (e) => {
                console.error('🔊 Fallback: Speech error:', e);
                
                // Restart voice recognition even on error
                setTimeout(() => {
                    if (wasWakeListening || wasListening) {
                        console.log('🔊 Fallback: Restarting wake listening after speech error...');
                        if (typeof window.startWakeListening === 'function') {
                            window.isWakeListening = true;
                            window.startWakeListening();
                        }
                    }
                }, 500);
            };
            
            window.speechSynthesis.speak(utterance);
        };
    }
    
    // Setup proper voice system integration
    setTimeout(() => {
        populateVoiceSelection();
        console.log('✅ Voice integration fixed');
    }, 1000);
    
    return true;
};

// Function to make text more natural for speech synthesis (globally accessible)
window.makeSpeechFriendly = function(text) {
    const withoutSources = String(text || '')
        // Remove markdown-style sources section
        .replace(/\n\s*---\s*\n\s*\*\*?\s*Sources\s*&\s*References\s*\*\*?[\s\S]*$/i, '')
        // Remove plain heading section fallback
        .replace(/\n\s*Sources\s*&\s*References\s*:?\s*[\s\S]*$/i, '');

    return withoutSources
        // Remove any trailing standalone source-link lines that may remain
        .replace(/\n\s*Link:\s*https?:\/\/[^\s]+/gi, '')
        .replace(/N\.O\.V\.A/g, 'Nova')  // Convert N.O.V.A to Nova
        .replace(/N\.O\.V\.A\./g, 'Nova.')  // Handle with trailing period
        .replace(/N\.O\.V\.A,/g, 'Nova,')  // Handle with comma
        .replace(/N\.O\.V\.A!/g, 'Nova!')  // Handle with exclamation
        .replace(/Dr\./g, 'Doctor')  // Convert Dr. to Doctor
        .replace(/Mr\./g, 'Mister')  // Convert Mr. to Mister
        .replace(/Mrs\./g, 'Missus')  // Convert Mrs. to Missus
        .replace(/\s+/g, ' ')  // Clean up multiple spaces
        .trim();
};

// Enhanced voice text function that coordinates with voice recognition
window.enhancedSpeakText = function(text, callback) {
    // Make text speech-friendly
    const speechText = window.makeSpeechFriendly(text);
    
    console.log('🔊 Enhanced speak text (original):', text);
    console.log('🔊 Enhanced speak text (speech-friendly):', speechText);
    console.log('🔊 Selected voice:', window.selectedVoice ? window.selectedVoice.name : 'default');
    
    if (!window.speechSynthesis) {
        console.error('🔊 Speech synthesis not available');
        return;
    }
    
    // CRITICAL: Stop voice recognition to prevent feedback loop
    console.log('🔊 Stopping voice recognition during speech...');
    let wasListening = false;
    let wasWakeListening = false;
    
    // Store current listening states
    if (window.isListening) {
        wasListening = true;
        window.isListening = false;
    }
    if (window.isWakeListening) {
        wasWakeListening = true;
        window.isWakeListening = false;
    }
    
    // Stop any active recognition
    if (window.recognition && window.recognition.stop) {
        try {
            window.recognition.stop();
            console.log('🔊 Voice recognition stopped');
        } catch (e) {
            console.log('🔊 Recognition already stopped');
        }
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(speechText);
    
    // Apply selected voice if available
    if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
        utterance.voice = window.selectedVoice;
        console.log('🔊 Using voice:', window.selectedVoice.name);
    } else {
        console.log('🔊 Using default voice');
    }
    
    // Apply voice settings
    utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
    utterance.pitch = 0.8; // Nova-like pitch
    utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
    
    utterance.onstart = () => {
        console.log('🔊 Started speaking - voice recognition disabled');
    };
    
    utterance.onend = () => {
        console.log('🔊 Finished speaking - restarting voice recognition...');
        
        // Restart voice recognition after speech ends
        setTimeout(() => {
            if (wasWakeListening || wasListening) {
                console.log('🔊 Restarting wake listening after speech...');
                if (typeof window.startWakeListening === 'function') {
                    window.isWakeListening = true;
                    window.startWakeListening();
                } else {
                    console.log('🔊 Wake listening function not available');
                }
            }
        }, 500); // Small delay to ensure speech is completely finished
        
        if (callback) callback();
    };
    
    utterance.onerror = (e) => {
        console.error('🔊 Speech error:', e);
        
        // Restart voice recognition even on error
        setTimeout(() => {
            if (wasWakeListening || wasListening) {
                console.log('🔊 Restarting wake listening after speech error...');
                if (typeof window.startWakeListening === 'function') {
                    window.isWakeListening = true;
                    window.startWakeListening();
                }
            }
        }, 500);
    };
    
    window.speechSynthesis.speak(utterance);
};

// Override the main speakText function
window.speakText = window.enhancedSpeakText;

// Fix voice command processing
window.processVoiceCommand = function(command) {
    console.log('🎤 Processing voice command:', command);
    
    // Use the main interface's processUserMessage function
    if (typeof processUserMessage === 'function') {
        processUserMessage(command);
    } else {
        console.error('🎤 processUserMessage not available');
        // Fallback - add to chat manually
        addMessage(command, 'user');
        setTimeout(() => {
            const response = `I heard "${command}" but there seems to be a system issue. Please try typing your request instead, sir.`;
            addMessage(response, 'Nova');
            window.speakText(response);
        }, 1000);
    }
};

// Manual microphone permission request
window.requestMicPermission = function() {
    console.log('🎤 Requesting microphone permission...');
    return navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            console.log('✅ Microphone permission granted');
            stream.getTracks().forEach(track => track.stop());
            
            // Set permission flag
            window.hasVoicePermission = true;
            
            // Now try to initialize voice recognition
            if (typeof window.initializeVoice === 'function') {
                window.initializeVoice();
            }
            
            // Test if recognition is available after permission
            setTimeout(() => {
                testVoiceRecognitionSetup();
            }, 1000);
            
            showNotification('Microphone access granted! Voice recognition ready.', 3000);
            return true;
        })
        .catch(error => {
            console.error('❌ Microphone permission denied:', error);
            window.hasVoicePermission = false;
            showNotification('Microphone access denied. Voice recognition will not work.', 5000);
            throw error;
        });
};

// Test voice recognition setup and capabilities
window.testVoiceRecognitionSetup = function() {
    console.log('🔬 Testing voice recognition setup...');
    
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('❌ Speech Recognition not supported in this browser');
        showNotification('Voice recognition not supported in this browser', 5000);
        return false;
    }
    
    console.log('✅ Speech Recognition API available');
    
    // Check if recognition object exists
    if (window.recognition) {
        console.log('✅ Recognition object exists');
        console.log('🎤 Recognition state:', {
            continuous: window.recognition.continuous,
            interimResults: window.recognition.interimResults,
            lang: window.recognition.lang
        });
    } else {
        console.error('❌ Recognition object missing - initializing...');
        initializeVoiceRecognitionDirect();
    }
    
    // Check voice system variables
    console.log('🔬 Voice system state:', {
        isVoiceSupported: window.isVoiceSupported,
        isWakeListening: window.isWakeListening,
        isListening: window.isListening,
        hasVoicePermission: window.hasVoicePermission
    });
    
    // Check if voice functions exist
    console.log('🔬 Voice functions available:');
    console.log('  - startWakeListening:', typeof window.startWakeListening);
    console.log('  - stopWakeListening:', typeof window.stopWakeListening);
    console.log('  - toggleVoiceRecognition:', typeof window.toggleVoiceRecognition);
    
    return true;
};

// Direct voice recognition initialization (bypass the external script)
window.initializeVoiceRecognitionDirect = function() {
    console.log('🔧 Initializing voice recognition directly...');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('❌ No Speech Recognition support');
        return false;
    }
    
    // Create recognition instance
    window.recognition = new SpeechRecognition();
    window.recognition.continuous = true;
    window.recognition.interimResults = true;
    window.recognition.lang = 'en-US';
    
    // Set up event handlers
    window.recognition.onstart = function() {
        console.log('🎤 Direct recognition started');
        window.isListening = true;
        updateVoiceVisualizer(true);
        updateVoiceStatus('Listening...');
    };
    
    window.recognition.onend = function() {
        console.log('🎤 Direct recognition ended');
        window.isListening = false;
        updateVoiceVisualizer(false);
        updateVoiceStatus('Click microphone to activate');
    };
    
    window.recognition.onerror = function(event) {
        console.error('🎤 Direct recognition error:', event.error);
        window.isListening = false;
        updateVoiceVisualizer(false);
        updateVoiceStatus('Voice recognition error: ' + event.error);
    };
    
    window.recognition.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        console.log('🗣️ Direct recognition result:', finalTranscript || interimTranscript);
        
        if (finalTranscript.trim()) {
            // Process the command
            console.log('🎯 Processing final transcript:', finalTranscript);
            processUserMessage(finalTranscript);
            
            // Stop recognition after receiving command
            window.recognition.stop();
        } else if (interimTranscript.trim()) {
            updateVoiceStatus(`Hearing: "${interimTranscript}"`);
        }
    };
    
    console.log('✅ Direct voice recognition initialized');
    window.isVoiceSupported = true;
    return true;
};

// Simple start listening function
window.startListeningDirect = function() {
    if (!window.recognition) {
        console.log('🔧 No recognition object, initializing...');
        if (!initializeVoiceRecognitionDirect()) {
            return false;
        }
    }
    
    if (window.isListening) {
        console.log('🎤 Already listening, stopping first...');
        window.recognition.stop();
        return false;
    }
    
    console.log('🎤 Starting direct listening...');
    try {
        window.recognition.start();
        return true;
    } catch (error) {
        console.error('🎤 Error starting recognition:', error);
        updateVoiceStatus('Error starting voice recognition');
        return false;
    }
};

// Simple stop listening function
window.stopListeningDirect = function() {
    if (window.recognition && window.isListening) {
        console.log('🎤 Stopping direct listening...');
        window.recognition.stop();
        return true;
    }
    return false;
};

// Test the direct voice recognition
window.testDirectVoiceRecognition = function() {
    console.log('🧪 Testing direct voice recognition...');
    console.log('🧪 Current permission status:', window.hasVoicePermission);
    
    // First request permission if needed
    if (!window.hasVoicePermission) {
        console.log('🎤 Requesting permission first...');
        window.requestMicPermission()
            .then(() => {
                // Retry after permission granted
                setTimeout(() => {
                    if (window.hasVoicePermission) {
                        console.log('🎤 Permission granted, retrying...');
                        window.testDirectVoiceRecognition();
                    }
                }, 2000);
            })
            .catch(error => {
                console.error('🎤 Permission denied, cannot test voice recognition');
                updateVoiceStatus('Microphone permission denied.');
            });
        return;
    }
    
    // Initialize and start
    if (window.initializeVoiceRecognitionDirect()) {
        console.log('🎤 Starting test listening session...');
        if (window.startListeningDirect()) {
            showNotification('Voice recognition active! Say something...', 3000);
            updateVoiceStatus('Say something to test voice recognition...');
            
            // Auto-stop after 15 seconds for testing
            setTimeout(() => {
                if (window.isListening) {
                    window.stopListeningDirect();
                    console.log('🧪 Test session ended');
                    updateVoiceStatus('Test session completed. Click microphone to activate again.');
                }
            }, 15000);
        } else {
            console.error('🧪 Failed to start listening');
            updateVoiceStatus('Failed to start listening. Check browser permissions.');
        }
    } else {
        console.error('🧪 Failed to initialize voice recognition');
        updateVoiceStatus('Failed to initialize voice recognition.');
    }
};

// Note: Microphone buttons are now handled exclusively by nova_voice.js (nova_voice.js)
// to prevent conflicts and ensure proper voice recognition functionality

// Test functions for debugging
window.testVoiceResponse = function(message) {
    message = message || "Hello sir, this is a voice response test.";
    console.log('🔊 Testing voice response:', message);
    if (typeof window.speakText === 'function') {
        window.speakText(message);
    } else {
        console.error('🔊 speakText function not available');
    }
};

window.testVoiceSelection = function() {
    console.log('🎛️ Testing voice selection...');
    if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        console.log('🔊 Total voices available:', voices.length);
        
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        console.log('🔊 English voices:', englishVoices.length);
        
        englishVoices.forEach((voice, i) => {
            console.log(`🔊 Voice ${i + 1}: ${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`);
        });
        
        if (englishVoices.length > 0) {
            console.log('🔊 Testing first English voice...');
            window.selectedVoice = englishVoices[0];
            window.testVoiceResponse("Testing voice selection with " + englishVoices[0].name);
        }
    }
};

window.testFullVoiceWorkflow = function() {
    console.log('🎬 Testing complete voice workflow...');
    
    // Step 1: Test basic speech
    console.log('Step 1: Basic speech test');
    window.testVoiceResponse("Voice synthesis test, sir.");
    
    setTimeout(() => {
        // Step 2: Test voice selection
        console.log('Step 2: Voice selection test');
        window.testVoiceSelection();
    }, 3000);
    
    setTimeout(() => {
        // Step 3: Test voice command processing
        console.log('Step 3: Voice command test');
        window.testVoiceCommand("tell me about quantum physics");
    }, 6000);
    
    setTimeout(() => {
        // Step 4: Test voice recognition if available
        console.log('Step 4: Voice recognition test');
        if (typeof window.startWakeListening === 'function') {
            console.log('🎤 Voice recognition available - you can now say "Nova" or "Hey Nova"');
        } else {
            console.log('🎤 Voice recognition not available');
        }
    }, 9000);
};

// Helper functions
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
            <span class="thinking-text">N.O.V.A is thinking...</span>
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
        chatHistory = [];
        conversationHistory = [];  // Also clear conversation history for OpenAI
        console.log('💬 Chat and conversation history cleared');
    }
}

// ========================================
// API KEY MANAGEMENT
// ========================================
function setupApiKeyManagement() {
    console.log('🔑 Setting up API key management...');
    
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const openrouterApiKeyInput = document.getElementById('openrouterApiKey');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const apiKeySavedMsg = document.getElementById('apiKeySaved');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    
    // Load saved API keys into inputs when settings open
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            if (openrouterApiKeyInput) {
                const savedKey = localStorage.getItem('openrouter_api_key');
                if (savedKey && savedKey.trim() !== '') {
                    openrouterApiKeyInput.value = savedKey;
                }
            }
            if (openaiApiKeyInput) {
                const savedKey = localStorage.getItem('openai_api_key');
                if (savedKey && savedKey !== 'YOUR_OPENAI_API_KEY_HERE' && savedKey.trim() !== '') {
                    openaiApiKeyInput.value = savedKey;
                }
            }
            refreshModelSelectionUI();
            fetchOpenRouterModels();
        });
    }
    
    // Save API keys button
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            let saved = false;
            
            // Save OpenRouter API key (primary)
            if (openrouterApiKeyInput) {
                const apiKey = openrouterApiKeyInput.value.trim();
                if (apiKey && apiKey !== '') {
                    localStorage.setItem('openrouter_api_key', apiKey);
                    OPENROUTER_API_KEY = apiKey;
                    if (providerConfig.openrouter) {
                        providerConfig.openrouter.apiKey = apiKey;
                    }
                    saved = true;
                    console.log('✅ OpenRouter API key saved successfully!');
                    const warning = document.querySelector('.api-key-warning');
                    if (warning) warning.remove();
                }
            }
            
            // Save OpenAI API key (fallback)
            if (openaiApiKeyInput) {
                const apiKey = openaiApiKeyInput.value.trim();
                if (apiKey && apiKey !== '') {
                    localStorage.setItem('openai_api_key', apiKey);
                    OPENAI_API_KEY = apiKey;
                    if (providerConfig.openai) {
                        providerConfig.openai.apiKey = apiKey;
                    }
                    saved = true;
                    console.log('✅ OpenAI API key saved successfully!');
                }
            }
            
            if (!saved) {
                alert('Please enter at least the OpenRouter API key');
                return;
            }
            
            // Show success message
            if (apiKeySavedMsg) {
                apiKeySavedMsg.style.display = 'inline';
                setTimeout(() => {
                    apiKeySavedMsg.style.display = 'none';
                }, 3000);
            }
        });
    }
}

function checkApiKeyStatus() {
    console.log('🔍 Checking API key status...');
    // Server proxy (/api/chat) handles requests when no user key is set,
    // so we only log a console warning rather than showing a UI banner.
    const hasUserKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') ||
                       (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '');
    if (hasUserKey) {
        console.log('✅ User API key is configured');
    } else {
        console.log('ℹ️ No user API key — will use server proxy (/api/chat)');
    }
}

function showApiKeyWarning() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Check if warning already exists
    if (document.querySelector('.api-key-warning')) return;
    
    const warningDiv = document.createElement('div');
    warningDiv.className = 'message Nova-message api-key-warning';
    warningDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">⚠️ System Notice</span>
        </div>
        <div class="message-content" style="background: rgba(255, 193, 7, 0.1); border-left: 3px solid #FFC107; padding: 1rem;">
            <strong>API Key Required</strong><br>
            Please configure your OpenRouter API key to use N.O.V.A:<br>
            1. Click the ⚙️ Settings button above<br>
            2. Enter your OpenRouter API key (get one free at <a href="https://openrouter.ai/keys" target="_blank" style="color: #FFD700;">openrouter.ai/keys</a>)<br>
            3. Click "Save API Keys"
        </div>
    `;
    
    chatMessages.appendChild(warningDiv);
}

// Initialize when DOM is loaded
function initializeMainSystem() {
    console.log('🚀 Initializing N.O.V.A main system...');
    loadnovaStylePhrases().catch(error => {
        console.warn('🎭 Failed loading nova style phrases:', error);
    });
    
    // Initialize core systems
    initializeNova();
    setupEventListeners();
    setupApiKeyManagement();
    setupModelControls();
    setupFileUploadListeners();
    setupChatHistoryListeners();

    // Fetch weather in background; refresh every 15 min
    fetchWeatherData();
    setInterval(fetchWeatherData, WEATHER_CACHE_MS);
    
    // Wait for voices to load
    setTimeout(() => {
        populateVoiceSelection();
    }, 1000);
    
    // Check if API key is configured
    checkApiKeyStatus();
    
    console.log('🚀 N.O.V.A loaded successfully');
    console.log('🚀 Available test functions:');
    console.log('');
    console.log('🔊 VOICE SYNTHESIS (Speaking):');
    console.log('  - testVoiceResponse("hello") - Test voice synthesis');
    console.log('  - testVoiceSelection() - Test different voices');
    console.log('  - testSpeech() - Main speech test (if voice script loaded)');
    console.log('');
    console.log('🎤 VOICE RECOGNITION (Listening):');
    console.log('  - requestMicPermission() - Request microphone access FIRST');
    console.log('  - testVoiceRecognitionSetup() - Check voice recognition system');
    console.log('  - testDirectVoiceRecognition() - Test direct voice recognition');
    console.log('  - startListeningDirect() - Start listening directly');
    console.log('  - stopListeningDirect() - Stop listening directly');
    console.log('');
    console.log('🧪 FULL TESTS:');
    console.log('  - testFullVoiceWorkflow() - Complete voice test sequence');
    console.log('  - debugVoice() - Check voice system status');
    console.log('');
    console.log('🎭 OTHER FUNCTIONS:');
    console.log('  - testModeClick("genius") - Test mode selection');
    console.log('  - checkModeCards() - Check mode card status');
    console.log('  - testAI("hello", "genius") - Test AI responses');
    console.log('  - testVoiceCommand("tell me about Mars") - Test voice processing');
    console.log('');
    console.log('🎤 MICROPHONE CONTROL:');
    console.log('  - toggleMicrophone() - Turn microphone on/off manually');
    console.log('');
    console.log('🎭 VOICE CONTROL:');
    console.log('  - findBritishVoices() - Discover available British voices');
    console.log('  - testNovaVoice() - Test current voice with Nova phrase');
    console.log('  - showAvailableVoices() - List all available voices');
    console.log('  - testVoiceByName("Voice Name") - Test specific voice');
    console.log('  - setNovaVoice("Voice Name") - Set and save voice preference');
    console.log('');
    console.log('🚨 TROUBLESHOOTING STEPS:');
    console.log('1. requestMicPermission() - Allow microphone access');
    console.log('2. testVoiceRecognitionSetup() - Check if system is working');
    console.log('3. testDirectVoiceRecognition() - Test if it can hear you');
    console.log('4. Try clicking the microphone button to activate voice recognition');
    console.log('');
    console.log('🚀 Main functions loaded:', typeof window.testSpeech !== 'undefined' ? '✅' : '❌');
    console.log('🎤 Note: Mixpanel errors are harmless (analytics blocked by browser)');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMainSystem);
} else {
    initializeMainSystem();
}

// ========================================
// GLOBAL EXPORTS FOR VOICE INTEGRATION
// ========================================
// Make key functions globally available for voice and other integrations
console.log('🌐 Exporting functions to window object...');
window.processUserMessage = processUserMessage;
window.generateAIResponse = generateAIResponse;
window.addMessage = addMessage;
window.currentPersonality = currentPersonality;
window.getRandomnovaStylePhrase = getRandomnovaStylePhrase;
window.fetchOpenRouterModels = fetchOpenRouterModels;
window.refreshModelSelectionUI = refreshModelSelectionUI;
console.log('🌐 ✅ window.processUserMessage:', typeof window.processUserMessage);
console.log('🌐 ✅ window.generateAIResponse:', typeof window.generateAIResponse);
console.log('🌐 ✅ window.addMessage:', typeof window.addMessage);

// Update global personality when it changes
function updateGlobalPersonality() {
    window.currentPersonality = currentPersonality;
}

// ========================================
// VOICE DISCOVERY AND TESTING FUNCTIONS
// ========================================


