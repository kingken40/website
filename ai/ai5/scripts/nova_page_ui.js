// UI behaviors extracted from AI_v5_nova.html

        // N.O.V.A Main Interface v5 - Enhanced Debug Version
        
        // File Upload Functions - Define FIRST for onclick access
        window.toggleFileMenu = function(event) {
            console.log('ðŸ“Ž ========== TOGGLE FILE MENU ==========');
            console.log('ðŸ“Ž Event:', event);
            
            // STOP PROPAGATION IMMEDIATELY
            if (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
            
            const fileMenu = document.getElementById('fileMenu');
            console.log('ðŸ“Ž Menu element found:', !!fileMenu);
            
            if (!fileMenu) {
                console.error('ðŸ“Ž ERROR: fileMenu element not found in DOM!');
                console.log('ðŸ“Ž All elements with id:', document.querySelectorAll('[id="fileMenu"]'));
                return;
            }
            
            const wasActive = fileMenu.classList.contains('active');
            console.log('ðŸ“Ž Was active before toggle:', wasActive);
            
            fileMenu.classList.toggle('active');
            
            const isActive = fileMenu.classList.contains('active');
            console.log('ðŸ“Ž Is active after toggle:', isActive);
            console.log('ðŸ“Ž ClassList:', Array.from(fileMenu.classList));
            
            const computedStyle = window.getComputedStyle(fileMenu);
            console.log('ðŸ“Ž Computed display:', computedStyle.display);
            console.log('ðŸ“Ž Computed visibility:', computedStyle.visibility);
            console.log('ðŸ“Ž Computed opacity:', computedStyle.opacity);
            console.log('ðŸ“Ž Position:', computedStyle.position);
            console.log('ðŸ“Ž Bottom:', computedStyle.bottom);
            
            console.log('ðŸ“Ž ========== END TOGGLE ==========');
        };

        window.hideFileMenu = function() {
            console.log('ðŸ“Ž hideFileMenu called');
            const fileMenu = document.getElementById('fileMenu');
            if (fileMenu) {
                console.log('ðŸ“Ž Removing active class from menu');
                fileMenu.classList.remove('active');
            }
        };
        
        let currentPersonality = 'nova';
        
        // Initialize voice system variables
        window.isListening = false;
        window.isWakeListening = false;
        window.hasVoicePermission = false;
        window.isVoiceSupported = false;
        
        // Check if voice variables exist, if not create them
        if (typeof window.isVoiceEnabled === 'undefined') {
            window.isVoiceEnabled = false;
        }
        if (typeof window.isVoiceResponseEnabled === 'undefined') {
            window.isVoiceResponseEnabled = true;
        }

        // AI Personality configurations with enhanced prompts
        const personalities = {
            nova: {
                name: "J.A.R.V.I.S",
                systemPrompt: "You are J.A.R.V.I.S (Just A Rather Very Intelligent System), Tony Stark's sophisticated AI assistant. Speak with British elegance, intelligence, and subtle humor. Address the user as 'sir' or 'ma'am'. Be helpful, informative, and occasionally witty. Provide detailed, well-structured responses with a professional yet personable tone.",
                voiceSettings: { rate: 0.9, pitch: 0.8 }
            },
            genius: {
                name: "Genius Mode",
                systemPrompt: "You are an advanced AI in genius mode. Provide extremely detailed, technical, and comprehensive responses. Think like a brilliant scientist or engineer. Solve complex problems with innovative approaches.",
                voiceSettings: { rate: 1.0, pitch: 0.9 }
            },
            professor: {
                name: "Professor Mode",
                systemPrompt: "You are an experienced professor. Explain concepts clearly, use examples, and break down complex topics into digestible parts. Encourage learning and critical thinking.",
                voiceSettings: { rate: 0.8, pitch: 1.0 }
            },
            analyst: {
                name: "Data Analyst",
                systemPrompt: "You are a data analyst AI. Focus on analyzing information, finding patterns, providing insights, and helping with research. Be methodical and evidence-based in your responses.",
                voiceSettings: { rate: 1.0, pitch: 0.9 }
            },
            study: {
                name: "Study Guide",
                systemPrompt: "You are an expert academic assistant specializing in assignment help, homework completion, and study guidance. Help students understand assignments, break down complex problems, provide step-by-step solutions with explanations, assist with essays/math/research, create study guides and practice questions. When Knowledge Base content is uploaded, reference it directly and prioritize it over general knowledge.",
                voiceSettings: { rate: 0.9, pitch: 0.95 }
            }
        };

        // Initialize N.O.V.A - uses nova_main.js initialization
        document.addEventListener('DOMContentLoaded', function() {
            // nova_main.js handles initializenova and setupEventListeners
            if (typeof initializenova === 'function') {
                initializenova();
            }
            if (typeof setupEventListeners === 'function') {
                setupEventListeners();
            }
            setupVoiceEventListeners(); // Voice button handlers
            showWelcomeMessage();
        });

        function setupVoiceEventListeners() {
            console.log('ðŸ”§ Setting up voice event listeners...');
            
            // Voice buttons handled by fixMicrophoneButton() - press-and-hold mode
            // No click listeners needed here - mousedown/mouseup handlers are added later
            
            // Mode selection handled by nova_main.js
            
            // Quick actions - handled by nova_main.js
            // (nova_main.js setupEventListeners handles this)
            
            // Settings
            document.getElementById('settingsBtn').addEventListener('click', openSettings);
            document.getElementById('closeSettings').addEventListener('click', closeSettings);
            
            // Chat controls
            document.getElementById('clearChat').addEventListener('click', clearChat);
            // Export chat now handled by nova_main.js openExportModal()
            
            // File upload - HANDLED BY nova_main.js setupFileUploadListeners()
            // All file upload event listeners moved to nova_main.js to avoid conflicts
        }

        // selectPersonality and addMessage now in nova_main.js
        // Removed duplicate functions - using nova_main.js versions

        function showLoading(show) {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (show) {
                loadingOverlay.style.display = 'flex';
                requestAnimationFrame(() => {
                    loadingOverlay.style.opacity = '1';
                });
            } else {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 300);
            }
        }

        function showNotification(message, duration = 3000) {
            const notification = document.getElementById('notification');
            notification.textContent = message;
            notification.classList.add('show');
            
            setTimeout(() => {
                notification.classList.remove('show');
            }, duration);
        }

        /**
         * Show the welcome message that initializes the AI
         
         */
        function showWelcomeMessage() {
            const welcomeMessage = `
                <div class="welcome-message">
                    <h3>ðŸ¤– N.O.V.A Systems Initialized</h3>
                    <p>Good ${getTimeOfDay()}, sir. N.O.V.A is online and ready to assist you.</p>
                    <div class="feature-highlights">
                        <div class="feature">ðŸ—£ï¸ <strong>Voice Recognition:</strong> Say "Nova" or "Hey Nova", or press and hold the microphone</div>
                        <div class="feature">ðŸ§  <strong>AI Modes:</strong> Switch between different AI personalities</div>
                        <div class="feature">âš™ï¸ <strong>Settings:</strong> Customize voice and preferences</div>
                        <div class="feature">ðŸ“ <strong>File Upload:</strong> Attach and analyze documents</div>
                    </div>
                    <p><em>How may I be of service today?</em></p>
                </div>
            `;
            
            addMessage(welcomeMessage, 'nova');
        }

        function getTimeOfDay() {
            const hour = new Date().getHours();
            if (hour < 12) return 'morning';
            if (hour < 18) return 'afternoon';
            return 'evening';
        }

        // Settings Functions
        function openSettings() {
            const modal = document.getElementById('settingsModal');
            modal.style.display = 'flex';
            modal.classList.add('active');
            
            // Load current voice settings
            loadVoiceSettings();
            // Re-inject pack options after other initializers may have overwritten the dropdown
            if (typeof ensurenovaPackOptionsInDropdown === 'function') {
                setTimeout(() => ensurenovaPackOptionsInDropdown(), 50);
                setTimeout(() => ensurenovaPackOptionsInDropdown(), 300);
                setTimeout(() => ensurenovaPackOptionsInDropdown(), 1000);
            }

            // Render saved Knowledge Base list
            if (typeof renderMaterialList === 'function') renderMaterialList();

            // Wire material controls (once, using flags to avoid duplicate listeners)
            const materialFileInput = document.getElementById('materialFileInput');
            if (materialFileInput && !materialFileInput._wired) {
                materialFileInput._wired = true;
                materialFileInput.addEventListener('change', e => {
                    const file = e.target.files[0];
                    if (file && typeof handleMaterialFileUpload === 'function') {
                        handleMaterialFileUpload(file);
                        e.target.value = '';
                    }
                });
            }

            const addMaterialTextBtn = document.getElementById('addMaterialTextBtn');
            if (addMaterialTextBtn && !addMaterialTextBtn._wired) {
                addMaterialTextBtn._wired = true;
                addMaterialTextBtn.addEventListener('click', () => {
                    const content = document.getElementById('materialTextInput').value.trim();
                    const name = document.getElementById('materialTextName').value.trim() || 'Pasted Knowledge Base Entry';
                    if (!content) { showNotification('Paste some text first.', 2000); return; }
                    if (typeof addPersistentMaterialItem === 'function') {
                        addPersistentMaterialItem(name, content);
                        document.getElementById('materialTextInput').value = '';
                        document.getElementById('materialTextName').value = '';
                        showNotification('Knowledge Base item added!', 2000);
                    }
                });
            }

            const clearAllMaterialBtn = document.getElementById('clearAllMaterialBtn');
            if (clearAllMaterialBtn && !clearAllMaterialBtn._wired) {
                clearAllMaterialBtn._wired = true;
                clearAllMaterialBtn.addEventListener('click', () => {
                    if (typeof persistentMaterial === 'undefined' || persistentMaterial.length === 0) return;
                    if (confirm('Remove all Knowledge Base items?')) {
                        persistentMaterial.length = 0;
                        if (typeof savePersistentMaterial === 'function') savePersistentMaterial();
                        if (typeof renderMaterialList === 'function') renderMaterialList();
                        showNotification('Knowledge Base cleared.', 2000);
                    }
                });
            }
        }

        function closeSettings() {
            const modal = document.getElementById('settingsModal');
            modal.style.display = 'none';
            modal.classList.remove('active');
        }

        function loadVoiceSettings() {
            console.log('ðŸ”§ Loading voice settings...');
            
            // Check voice enabled
            const voiceEnabledCheckbox = document.getElementById('voiceEnabled');
            if (voiceEnabledCheckbox) {
                voiceEnabledCheckbox.checked = window.isVoiceEnabled || false;
                voiceEnabledCheckbox.addEventListener('change', function() {
                    window.isVoiceEnabled = this.checked;
                    if (!this.checked && window.isWakeListening) {
                        // Turn off voice if disabled
                        toggleVoiceListening();
                    }
                });
            }
            
            // Check voice response enabled  
            const voiceResponseCheckbox = document.getElementById('voiceResponse');
            if (voiceResponseCheckbox) {
                voiceResponseCheckbox.checked = window.isVoiceResponseEnabled !== false;
                voiceResponseCheckbox.addEventListener('change', function() {
                    window.isVoiceResponseEnabled = this.checked;
                });
            }
            
            // Load voice volume
            const volumeSlider = document.getElementById('voiceVolume');
            if (volumeSlider) {
                volumeSlider.addEventListener('input', function() {
                    if (typeof window.setVoiceVolume === 'function') {
                        window.setVoiceVolume(parseFloat(this.value));
                    }
                });
            }
            
            // Load voice speed
            const speedSlider = document.getElementById('voiceSpeed');
            if (speedSlider) {
                speedSlider.addEventListener('input', function() {
                    if (typeof window.setVoiceSpeed === 'function') {
                        window.setVoiceSpeed(parseFloat(this.value));
                    }
                });
            }
            
            // Load available voices
            loadAvailableVoices();
            
            // Wake phrase setting
            const wakePhraseCheckbox = document.getElementById('wakePhraseEnabled');
            if (wakePhraseCheckbox) {
                // Sync checkbox with stored preference on open
                const storedWake = localStorage.getItem('Nova_wake_word_enabled');
                wakePhraseCheckbox.checked = storedWake === null ? true : storedWake === 'true';
                wakePhraseCheckbox.addEventListener('change', function() {
                    console.log('Wake phrase enabled:', this.checked);
                    if (typeof window.enableWakeListening === 'function') {
                        window.enableWakeListening(this.checked);
                    }
                });
            }
            
            // Animations setting
            const animationsCheckbox = document.getElementById('animationsEnabled');
            if (animationsCheckbox) {
                animationsCheckbox.checked = true; // Default enabled
                animationsCheckbox.addEventListener('change', function() {
                    document.body.classList.toggle('no-animations', !this.checked);
                });
            }
        }

        function ensurenovaPackOptionsInDropdown() {
            const voiceSelect = document.getElementById('voiceSelection');
            if (!voiceSelect) return;

            const existingPackOptions = Array.from(voiceSelect.options).filter(opt => (opt.value || '').startsWith('pack:'));
            if (existingPackOptions.length > 0) {
                return;
            }

            const novaPacks = (Array.isArray(window.nova_AUDIO_PACKS) && window.nova_AUDIO_PACKS.length > 0)
                ? window.nova_AUDIO_PACKS
                : [
                    { id: 'nova-pack-cfx', name: 'nova Pack - CFX' },
                    { id: 'nova-pack-ghv4', name: 'nova Pack - GHV4' },
                    { id: 'nova-pack-proffie', name: 'nova Pack - ProffieOS V2' },
                    { id: 'nova-pack-sn4', name: 'nova Pack - SN4' },
                    { id: 'nova-pack-xeno2', name: 'nova Pack - Xeno2' },
                    { id: 'nova-pack-xeno3', name: 'nova Pack - Xeno3' }
                ];

            const separator = document.createElement('option');
            separator.textContent = 'â”€â”€â”€â”€â”€ nova Audio Packs (.wav) â”€â”€â”€â”€â”€';
            separator.disabled = true;
            voiceSelect.appendChild(separator);

            novaPacks.forEach(pack => {
                const option = document.createElement('option');
                option.value = `pack:${pack.id}`;
                option.textContent = `${pack.name} ðŸŽµ`;
                voiceSelect.appendChild(option);
            });

            console.log(`ðŸŽµ Injected ${novaPacks.length} nova pack options into dropdown`);
        }

        function loadAvailableVoices() {
            if (!window.speechSynthesis) {
                console.warn('ðŸ”Š Speech synthesis not supported');
                return;
            }
            
            const voiceSelect = document.getElementById('voiceSelection');
            if (!voiceSelect) return;
            
            function populateVoices() {
                const voices = window.speechSynthesis.getVoices();
                console.log('ðŸ”Š Available voices:', voices.length);
                
                if (voices.length === 0) {
                    setTimeout(populateVoices, 100);
                    return;
                }
                
                voiceSelect.innerHTML = '';
                
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Default System Voice';
                voiceSelect.appendChild(defaultOption);
                
                // Filter for English voices and good quality ones
                const englishVoices = voices.filter(voice => 
                    voice.lang.startsWith('en') || voice.lang.includes('GB') || voice.lang.includes('US')
                );
                
                // Prioritize certain voices for nova
                const preferredVoices = englishVoices.filter(voice => 
                    voice.name.toLowerCase().includes('male') ||
                    voice.name.toLowerCase().includes('daniel') ||
                    voice.name.toLowerCase().includes('alex') ||
                    voice.name.toLowerCase().includes('david') ||
                    voice.name.toLowerCase().includes('microsoft')
                );
                
                // Add nova packs from nova_voice.js (or fallback list if global not yet ready)
                const novaPacks = (Array.isArray(window.nova_AUDIO_PACKS) && window.nova_AUDIO_PACKS.length > 0)
                    ? window.nova_AUDIO_PACKS
                    : [
                        { id: 'nova-pack-cfx', name: 'nova Pack - CFX' },
                        { id: 'nova-pack-ghv4', name: 'nova Pack - GHV4' },
                        { id: 'nova-pack-proffie', name: 'nova Pack - ProffieOS V2' },
                        { id: 'nova-pack-sn4', name: 'nova Pack - SN4' },
                        { id: 'nova-pack-xeno2', name: 'nova Pack - Xeno2' },
                        { id: 'nova-pack-xeno3', name: 'nova Pack - Xeno3' }
                    ];

                if (novaPacks.length > 0) {
                    const packSeparator = document.createElement('option');
                    packSeparator.textContent = 'â”€â”€â”€â”€â”€ nova Audio Packs (.wav) â”€â”€â”€â”€â”€';
                    packSeparator.disabled = true;
                    voiceSelect.appendChild(packSeparator);

                    novaPacks.forEach(pack => {
                        const option = document.createElement('option');
                        option.value = `pack:${pack.id}`;
                        option.textContent = `${pack.name} ðŸŽµ`;
                        voiceSelect.appendChild(option);
                    });
                }

                // Add preferred voices first
                preferredVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = `tts:${voice.name}`;
                    option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? 'ðŸŽ¯' : 'â˜ï¸'}`;
                    voiceSelect.appendChild(option);
                });
                
                // Add separator for other TTS voices
                if (preferredVoices.length > 0) {
                    const separator = document.createElement('option');
                    separator.textContent = 'â”€â”€â”€â”€â”€ Other TTS Voices â”€â”€â”€â”€â”€';
                    separator.disabled = true;
                    voiceSelect.appendChild(separator);
                }
                
                // Add other English voices
                const otherVoices = englishVoices.filter(voice => 
                    !preferredVoices.includes(voice)
                );
                
                otherVoices.forEach(voice => {
                    const option = document.createElement('option');
                    option.value = `tts:${voice.name}`;
                    option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? 'ðŸŽ¯' : 'â˜ï¸'}`;
                    voiceSelect.appendChild(option);
                });
                
                // Try to restore saved voice preference
                let voiceToSelect = null;
                try {
                    const savedPreference = localStorage.getItem('novaVoicePreference');
                    if (savedPreference) {
                        const pref = JSON.parse(savedPreference);
                        voiceToSelect = voices.find(voice => voice.name === pref.name && voice.lang === pref.lang);
                        if (voiceToSelect) {
                            window.selectedVoice = voiceToSelect;
                            console.log('ðŸ”Š Restored saved voice:', voiceToSelect.name);
                        }
                    }
                } catch (e) {
                    console.warn('Could not restore voice preference:', e);
                }

                const savedMode = localStorage.getItem('Nova_voice_mode');
                const savedPack = localStorage.getItem('Nova_selected_nova_pack');
                
                // Set current voice in dropdown
                if (savedMode === 'nova-pack' && savedPack) {
                    voiceSelect.value = `pack:${savedPack}`;
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('nova-pack', savedPack);
                    }
                } else if (window.selectedVoice) {
                    voiceSelect.value = `tts:${window.selectedVoice.name}`;
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('tts', null);
                    }
                } else if (voiceToSelect) {
                    voiceSelect.value = `tts:${voiceToSelect.name}`;
                    window.selectedVoice = voiceToSelect;
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('tts', null);
                    }
                } else {
                    // Auto-select first preferred voice if available
                    if (preferredVoices.length > 0) {
                        voiceSelect.value = `tts:${preferredVoices[0].name}`;
                        window.selectedVoice = preferredVoices[0];
                        if (typeof window.setVoiceModeSelection === 'function') {
                            window.setVoiceModeSelection('tts', null);
                        }
                        console.log('ðŸ”Š Auto-selected preferred voice:', preferredVoices[0].name);
                    }
                }
            }
            
            // Load voices
            populateVoices();
            
            // Handle voice changes
            voiceSelect.addEventListener('change', function() {
                const selectedValue = this.value;
                console.log('ðŸ”Š Voice selection changed to:', selectedValue);
                
                if (!selectedValue) {
                    window.selectedVoice = null;
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('tts', null);
                    }
                    showNotification('Using default system voice', 2000);
                    return;
                }

                if (selectedValue.startsWith('pack:')) {
                    const packId = selectedValue.replace('pack:', '');
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('nova-pack', packId);
                    }
                    showNotification(`Voice changed to nova pack: ${packId}`, 2000);
                    setTimeout(() => {
                        if (typeof window.speakText === 'function') {
                            window.speakText('Voice pack selected, sir.');
                        }
                    }, 300);
                    return;
                }

                // TTS branch
                const voiceName = selectedValue.replace('tts:', '');
                const voices = window.speechSynthesis.getVoices();
                const selectedVoice = voices.find(voice => voice.name === voiceName);
                if (selectedVoice) {
                    window.selectedVoice = selectedVoice;
                    if (typeof window.setVoiceModeSelection === 'function') {
                        window.setVoiceModeSelection('tts', null);
                    }
                    console.log('ðŸ”Š Voice object set:', selectedVoice);
                    console.log('ðŸ”Š Voice details - Name:', selectedVoice.name, 'Lang:', selectedVoice.lang, 'Local:', selectedVoice.localService);
                    
                    // Store in localStorage for persistence
                    try {
                        localStorage.setItem('novaVoicePreference', JSON.stringify({
                            name: selectedVoice.name,
                            lang: selectedVoice.lang
                        }));
                    } catch (e) {
                        console.warn('Could not save voice preference:', e);
                    }
                    
                    showNotification(`Voice changed to: ${selectedVoice.name}`, 2000);
                    
                    // Immediate test to confirm voice change
                    setTimeout(() => {
                        if (typeof window.testVoiceResponse === 'function') {
                            window.testVoiceResponse(`Voice changed to ${selectedVoice.name}, sir.`);
                        } else if (typeof window.speakText === 'function') {
                            window.speakText(`Voice changed to ${selectedVoice.name}, sir.`);
                        }
                    }, 500);
                }
            });
            
            // Preview voice button
            const previewBtn = document.getElementById('previewVoiceBtn');
            if (previewBtn) {
                previewBtn.addEventListener('click', function() {
                    const testText = "Good day, sir. This is N.O.V.A. How do you find this voice?";
                    console.log('ðŸŽ§ Preview button clicked');
                    
                    // Cancel any ongoing speech
                    if (window.speechSynthesis) {
                        window.speechSynthesis.cancel();
                    }
                    
                    if (typeof window.speakText === 'function') {
                        window.speakText(testText);
                        return;
                    }
                    
                    // Direct fallback preview (TTS only)
                    const utterance = new SpeechSynthesisUtterance(testText);
                    
                    // Use currently selected voice
                    if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
                        utterance.voice = window.selectedVoice;
                        console.log('ðŸŽ§ Using voice for preview:', window.selectedVoice.name);
                    } else {
                        console.log('ðŸŽ§ Using default voice for preview');
                    }
                    
                    utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
                    utterance.pitch = 0.8;
                    utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
                    
                    utterance.onstart = () => console.log('ðŸŽ§ Preview started');
                    utterance.onend = () => console.log('ðŸŽ§ Preview ended');
                    utterance.onerror = (e) => console.error('ðŸŽ§ Preview error:', e);
                    
                    window.speechSynthesis.speak(utterance);
                });
            }
        }

        // Chat Controls
        function clearChat() {
            const chatMessages = document.getElementById('chatMessages');
            chatMessages.innerHTML = '';
            showNotification('Chat cleared', 2000);
            showWelcomeMessage();
        }

        // exportChat() function removed - now handled by openExportModal() in nova_main.js

        // File Upload Handler - MOVED TO nova_main.js
        // Complete implementation with audio transcription now in nova_main.js

        // System Animations
        function startSystemAnimations() {
            // Animate arc reactor
            const arcCore = document.querySelector('.arc-core');
            if (arcCore) {
                arcCore.style.animation = 'pulse 2s infinite';
            }
            
            // Animate system status
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.style.animation = 'pulse-green 3s infinite';
            }
        }

        // Voice control functions
        function toggleVoiceListening() {
            if (typeof window.toggleVoiceRecognition === 'function') {
                window.toggleVoiceRecognition();
            } else if (typeof window.startWakeListening === 'function' && typeof window.stopWakeListening === 'function') {
                // Use the voice system functions directly
                if (window.isWakeListening) {
                    window.stopWakeListening();
                    updateVoiceStatus('Voice recognition disabled');
                    updateVoiceVisualizer(false);
                } else {
                    window.startWakeListening();
                    updateVoiceStatus('Listening for "Nova" or "Hey Nova"...');
                    updateVoiceVisualizer(true);
                    showVoiceEnabledMessage();
                }
            } else {
                console.warn('Voice system not loaded');
                showNotification('Voice system not available - please check if nova_voice.js is loaded', 3000);
            }
        }

        function updateVoiceStatus(status) {
            const statusElement = document.querySelector('.voice-status-text');
            if (statusElement) {
                statusElement.textContent = status;
            }
            
            // Update chat status
            const chatStatus = document.querySelector('.chat-status');
            if (chatStatus) {
                if (status.toLowerCase().includes('listening') || status.toLowerCase().includes('activated')) {
                    chatStatus.textContent = 'Listening';
                    chatStatus.style.color = '#00ff88';
                } else if (status.toLowerCase().includes('processing')) {
                    chatStatus.textContent = 'Processing';
                    chatStatus.style.color = '#ffaa00';
                } else {
                    chatStatus.textContent = 'Ready';
                    chatStatus.style.color = '#00aaff';
                }
            }
        }

        function showVoiceEnabledMessage() {
            const message = `
                <div class="voice-enabled-message">
                    <h4>ðŸŽ¤ Voice Recognition Activated</h4>
                    <p>I'm now listening for "Nova" or "Hey Nova" followed by your commands.</p>
                    <p><strong>Try saying:</strong></p>
                    <ul>
                        <li>"Nova, what's the weather like?"</li>
                        <li>"Hey Nova, explain quantum physics"</li>
                        <li>"Nova, switch to genius mode"</li>
                    </ul>
                </div>
            `;
            addMessage(message, 'nova');
        }

        function updateVoiceVisualizer(active) {
            const visualizer = document.querySelector('.voice-visualizer');
            const circles = document.querySelectorAll('.voice-circle');
            
            if (active) {
                visualizer.classList.add('active');
                circles.forEach((circle, index) => {
                    circle.style.animationDelay = `${index * 0.2}s`;
                });
            } else {
                visualizer.classList.remove('active');
            }
        }

        function activatenovaUI() {
            updateVoiceVisualizer(true);
            
            // Add some UI feedback for activation
            const header = document.querySelector('.nova-header');
            if (header) {
                header.classList.add('activated');
                setTimeout(() => header.classList.remove('activated'), 2000);
            }
        }

        function addMessageToChat(content, sender) {
            addMessage(content, sender);
        }

        // Export functions for voice module
        window.novaInterface = {
            sendMessage: function(text) {
                document.getElementById('messageInput').value = text;
                sendMessage();
            },
            addMessage,
            showNotification,
            currentPersonality,
            personalities,
            isVoiceEnabled: window.isVoiceEnabled,
            isVoiceResponseEnabled: window.isVoiceResponseEnabled,
            processUserMessage: window.processUserMessage,
            generateResponse: window.generateAIResponse,
            showVoiceEnabledMessage,
            updateVoiceVisualizer
        };

        // Make key functions globally available
        window.processUserMessage = window.processUserMessage;
        window.generateResponse = window.generateAIResponse;
        window.showVoiceEnabledMessage = showVoiceEnabledMessage;
        window.updateVoiceVisualizer = updateVoiceVisualizer;

        // Add a backup testSpeech function in case the other one doesn't load
        window.testSpeechBackup = function() {
            console.log('ðŸ”Š Backup speech test...');
            console.log('ðŸ”Š speakText available:', typeof window.speakText);
            if (typeof window.speakText === 'function') {
                window.speakText('Testing speech from backup function, sir.');
            } else {
                console.error('ðŸ”Š speakText not available');
            }
        };

        // Add debug function to test mode cards manually
        window.testModeClick = function(personality) {
            console.log('ðŸŽ¯ Manual test - selecting personality:', personality);
            selectPersonality(personality || 'genius');
        };

        // Debug function to check mode cards
        window.checkModeCards = function() {
            const cards = document.querySelectorAll('.mode-card');
            console.log('ðŸŽ¯ Found', cards.length, 'mode cards:');
            cards.forEach((card, i) => {
                console.log(`Card ${i + 1}:`, card.dataset.personality, 'clickable?', window.getComputedStyle(card).pointerEvents);
                console.log('Position:', card.getBoundingClientRect());
            });
        };

        // Debug function to test AI responses
        window.testAI = function(message, personality) {
            console.log('ðŸ¤– Testing AI response...');
            if (personality) {
                selectPersonality(personality);
            }
            processUserMessage(message || 'hello');
        };

        // Debug function to test voice integration
        window.debugVoice = function() {
            console.log('ðŸŽ¤ Voice system status:');
            console.log('  - isVoiceSupported:', typeof window.isVoiceSupported !== 'undefined' ? window.isVoiceSupported : 'undefined');
            console.log('  - isWakeListening:', typeof window.isWakeListening !== 'undefined' ? window.isWakeListening : 'undefined');  
            console.log('  - isListening:', typeof window.isListening !== 'undefined' ? window.isListening : 'undefined');
            console.log('  - speakText available:', typeof window.speakText === 'function');
            console.log('  - toggleVoiceRecognition available:', typeof window.toggleVoiceRecognition === 'function');
            console.log('  - startWakeListening available:', typeof window.startWakeListening === 'function');
            console.log('  - stopWakeListening available:', typeof window.stopWakeListening === 'function');
            console.log('  - recognition object:', window.recognition ? 'exists' : 'missing');
            
            // Test if we can manually start wake listening
            if (typeof window.startWakeListening === 'function') {
                console.log('ðŸŽ¤ Attempting to start wake listening...');
                try {
                    window.startWakeListening();
                    console.log('âœ… Wake listening started successfully');
                } catch (e) {
                    console.error('âŒ Error starting wake listening:', e);
                }
            }
        };

        // Function to force enable voice recognition
        window.forceEnableVoice = function() {
            console.log('ðŸŽ¤ Force enabling voice recognition...');
            
            if (typeof window.initializeVoice === 'function') {
                console.log('ðŸŽ¤ Re-initializing voice system...');
                window.initializeVoice();
            }
            
            if (typeof window.startWakeListening === 'function') {
                console.log('ðŸŽ¤ Starting wake listening...');
                window.startWakeListening();
                updateVoiceStatus('Listening for "Nova" or "Hey Nova"...');
                updateVoiceVisualizer(true);
            } else {
                console.error('ðŸŽ¤ Voice functions not available');
            }
        };

        // Test voice recognition manually  
        window.testVoiceCommand = function(command) {
            console.log('ðŸŽ¤ Testing voice command:', command);
            if (typeof window.processVoiceCommand === 'function') {
                window.processVoiceCommand(command);
            } else {
                console.log('ðŸŽ¤ Fallback - processing through main interface');
                processUserMessage(command);
            }
        };

        // Test voice response system
        window.testVoiceResponse = function(message) {
            message = message || "Hello sir, this is a voice response test.";
            console.log('ðŸ”Š Testing voice response:', message);
            if (typeof window.speakText === 'function') {
                window.speakText(message);
            } else {
                console.error('ðŸ”Š speakText function not available');
            }
        };

        // Test voice selection 
        window.testVoiceSelection = function() {
            console.log('ðŸŽ›ï¸ Testing voice selection...');
            if (window.speechSynthesis) {
                const voices = window.speechSynthesis.getVoices();
                console.log('ðŸ”Š Total voices available:', voices.length);
                
                const englishVoices = voices.filter(v => v.lang.startsWith('en'));
                console.log('ðŸ”Š English voices:', englishVoices.length);
                
                englishVoices.forEach((voice, i) => {
                    console.log(`ðŸ”Š Voice ${i + 1}: ${voice.name} (${voice.lang}) ${voice.localService ? 'ðŸŽ¯' : 'â˜ï¸'}`);
                });
                
                if (englishVoices.length > 0) {
                    console.log('ðŸ”Š Testing first English voice...');
                    window.selectedVoice = englishVoices[0];
                    window.testVoiceResponse("Testing voice selection with " + englishVoices[0].name);
                }
            }
        };

        // Test complete voice workflow
        window.testFullVoiceWorkflow = function() {
            console.log('ðŸŽ¬ Testing complete voice workflow...');
            
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
                    console.log('ðŸŽ¤ Voice recognition available - you can now say "Nova" or "Hey Nova"');
                } else {
                    console.log('ðŸŽ¤ Voice recognition not available');
                }
            }, 9000);
        };

        // Manual microphone permission request
        window.requestMicPermission = function() {
            console.log('ðŸŽ¤ Requesting microphone permission...');
            return navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    console.log('âœ… Microphone permission granted');
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
                    console.error('âŒ Microphone permission denied:', error);
                    window.hasVoicePermission = false;
                    showNotification('Microphone access denied. Voice recognition will not work.', 5000);
                    throw error;
                });
        };

        // Test voice recognition setup and capabilities
        window.testVoiceRecognitionSetup = function() {
            console.log('ðŸ”¬ Testing voice recognition setup...');
            
            // Check browser support
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.error('âŒ Speech Recognition not supported in this browser');
                showNotification('Voice recognition not supported in this browser', 5000);
                return false;
            }
            
            console.log('âœ… Speech Recognition API available');
            
            // Check if recognition object exists
            if (window.recognition) {
                console.log('âœ… Recognition object exists');
                console.log('ðŸŽ¤ Recognition state:', {
                    continuous: window.recognition.continuous,
                    interimResults: window.recognition.interimResults,
                    lang: window.recognition.lang
                });
            } else {
                console.error('âŒ Recognition object missing - initializing...');
                initializeVoiceRecognitionDirect();
            }
            
            // Check voice system variables
            console.log('ðŸ”¬ Voice system state:', {
                isVoiceSupported: window.isVoiceSupported,
                isWakeListening: window.isWakeListening,
                isListening: window.isListening,
                hasVoicePermission: window.hasVoicePermission
            });
            
            // Check if voice functions exist
            console.log('ðŸ”¬ Voice functions available:');
            console.log('  - startWakeListening:', typeof window.startWakeListening);
            console.log('  - stopWakeListening:', typeof window.stopWakeListening);
            console.log('  - toggleVoiceRecognition:', typeof window.toggleVoiceRecognition);
            
            return true;
        };

        // Direct voice recognition initialization (bypass the external script)
        window.initializeVoiceRecognitionDirect = function() {
            console.log('ðŸ”§ Initializing voice recognition directly...');
            
            // Initialize flags for direct mode (press-and-hold, not wake word mode)
            window.isWakeListening = false;
            window.isListening = false;
            
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                console.error('âŒ No Speech Recognition support');
                return false;
            }
            
            // Create recognition instance
            window.recognition = new SpeechRecognition();
            window.recognition.continuous = false; // Changed to false: only listen while button is pressed
            window.recognition.interimResults = true;
            window.recognition.lang = 'en-US';
            
            // Set up event handlers
            window.recognition.onstart = function() {
                console.log('ðŸŽ¤ Direct recognition started');
                window.isListening = true;
                window.isWakeListening = false; // Using direct mode, not wake mode
                updateVoiceVisualizer(true);
                updateVoiceStatus('Listening...');
            };
            
            window.recognition.onend = function() {
                console.log('ðŸŽ¤ Direct recognition ended');
                window.isListening = false;
                window.isWakeListening = false; // Prevent auto-restart
                updateVoiceVisualizer(false);
                updateVoiceStatus('Press and hold microphone to speak');
            };
            
            window.recognition.onerror = function(event) {
                console.error('ðŸŽ¤ Direct recognition error:', event.error);
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
                
                console.log('ðŸ—£ï¸ Direct recognition result:', finalTranscript || interimTranscript);
                
                if (finalTranscript.trim()) {
                    // Process the command
                    console.log('ðŸŽ¯ Processing final transcript:', finalTranscript);
                    processUserMessage(finalTranscript);
                    
                    // Stop recognition after receiving command
                    window.recognition.stop();
                } else if (interimTranscript.trim()) {
                    updateVoiceStatus(`Hearing: "${interimTranscript}"`);
                }
            };
            
            console.log('âœ… Direct voice recognition initialized');
            window.isVoiceSupported = true;
            return true;
        };

        // Simple start listening function
        window.startListeningDirect = function() {
            // Ensure wake listening is disabled when using direct mode
            window.isWakeListening = false;
            
            if (!window.recognition) {
                console.log('ðŸ”§ No recognition object, initializing...');
                if (!initializeVoiceRecognitionDirect()) {
                    return false;
                }
            }
            
            if (window.isListening) {
                console.log('ðŸŽ¤ Already listening, stopping first...');
                window.recognition.stop();
                return false;
            }
            
            console.log('ðŸŽ¤ Starting direct listening...');
            try {
                window.recognition.start();
                return true;
            } catch (error) {
                console.error('ðŸŽ¤ Error starting recognition:', error);
                updateVoiceStatus('Error starting voice recognition');
                return false;
            }
        };

        // Simple stop listening function
        window.stopListeningDirect = function() {
            // Ensure wake listening stays disabled
            window.isWakeListening = false;
            
            if (window.recognition && window.isListening) {
                console.log('ðŸŽ¤ Stopping direct listening...');
                window.recognition.stop();
                return true;
            }
            return false;
        };

        // Test the direct voice recognition
        window.testDirectVoiceRecognition = function() {
            console.log('ðŸ§ª Testing direct voice recognition...');
            console.log('ðŸ§ª Current permission status:', window.hasVoicePermission);
            
            // First request permission if needed
            if (!window.hasVoicePermission) {
                console.log('ðŸŽ¤ Requesting permission first...');
                window.requestMicPermission()
                    .then(() => {
                        // Retry after permission granted
                        setTimeout(() => {
                            if (window.hasVoicePermission) {
                                console.log('ðŸŽ¤ Permission granted, retrying...');
                                window.testDirectVoiceRecognition();
                            }
                        }, 2000);
                    })
                    .catch(error => {
                        console.error('ðŸŽ¤ Permission denied, cannot test voice recognition');
                        updateVoiceStatus('Microphone permission denied.');
                    });
                return;
            }
            
            // Initialize and start
            if (window.initializeVoiceRecognitionDirect()) {
                console.log('ðŸŽ¤ Starting test listening session...');
                if (window.startListeningDirect()) {
                    showNotification('Voice recognition active! Say something...', 3000);
                    updateVoiceStatus('Say something to test voice recognition...');
                    
                    // Auto-stop after 15 seconds for testing
                    setTimeout(() => {
                        if (window.isListening) {
                            window.stopListeningDirect();
                            console.log('ðŸ§ª Test session ended');
                            updateVoiceStatus('Test session completed. Click microphone to activate again.');
                        }
                    }, 15000);
                } else {
                    console.error('ðŸ§ª Failed to start listening');
                    updateVoiceStatus('Failed to start listening. Check browser permissions.');
                }
            } else {
                console.error('ðŸ§ª Failed to initialize voice recognition');
                updateVoiceStatus('Failed to initialize voice recognition.');
            }
        };

        // Override microphone button if original functions don't work
        window.fixMicrophoneButton = function() {
            const voiceBtn = document.getElementById('voiceBtn');
            const voiceInputBtn = document.getElementById('voiceInputBtn');
            
            if (voiceBtn) {
                // Remove existing event listeners by cloning the button
                const newVoiceBtn = voiceBtn.cloneNode(true);
                voiceBtn.parentNode.replaceChild(newVoiceBtn, voiceBtn);
                
                // Press-and-hold voice recognition handler
                const startListening = function(e) {
                    e.preventDefault();
                    console.log('ðŸ”§ Button pressed - starting voice recognition');
                    
                    // Check permission first
                    if (!window.hasVoicePermission) {
                        window.requestMicPermission();
                        return;
                    }
                    
                    if (!window.isListening) {
                        window.startListeningDirect();
                    }
                };
                
                const stopListening = function(e) {
                    e.preventDefault();
                    console.log('ðŸ”§ Button released - stopping voice recognition');
                    
                    if (window.isListening) {
                        window.stopListeningDirect();
                    }
                };
                
                // Mouse events
                newVoiceBtn.addEventListener('mousedown', startListening);
                newVoiceBtn.addEventListener('mouseup', stopListening);
                newVoiceBtn.addEventListener('mouseleave', stopListening);
                
                // Touch events for mobile
                newVoiceBtn.addEventListener('touchstart', startListening);
                newVoiceBtn.addEventListener('touchend', stopListening);
                newVoiceBtn.addEventListener('touchcancel', stopListening);
                
                console.log('ðŸ”§ Microphone button handler replaced with press-and-hold version');
            }
            
            if (voiceInputBtn) {
                // Same for the input voice button
                const newVoiceInputBtn = voiceInputBtn.cloneNode(true);
                voiceInputBtn.parentNode.replaceChild(newVoiceInputBtn, voiceInputBtn);
                
                const startListening = function(e) {
                    e.preventDefault();
                    console.log('ðŸ”§ Input button pressed - starting voice recognition');
                    
                    if (!window.hasVoicePermission) {
                        window.requestMicPermission();
                        return;
                    }
                    
                    if (!window.isListening) {
                        window.startListeningDirect();
                    }
                };
                
                const stopListening = function(e) {
                    e.preventDefault();
                    console.log('ðŸ”§ Input button released - stopping voice recognition');
                    
                    if (window.isListening) {
                        window.stopListeningDirect();
                    }
                };
                
                // Mouse events
                newVoiceInputBtn.addEventListener('mousedown', startListening);
                newVoiceInputBtn.addEventListener('mouseup', stopListening);
                newVoiceInputBtn.addEventListener('mouseleave', stopListening);
                
                // Touch events for mobile
                newVoiceInputBtn.addEventListener('touchstart', startListening);
                newVoiceInputBtn.addEventListener('touchend', stopListening);
                newVoiceInputBtn.addEventListener('touchcancel', stopListening);
                
                console.log('ðŸ”§ Input voice button handler replaced with press-and-hold version');
            }
        };

        // Global stop function - DISABLED/COMMENTED OUT (Stop button removed)
        /*window.stopnova = function() {
            console.log('ðŸ›‘ STOP button pressed - interrupting nova...');
            
            // 1. Cancel all speech synthesis immediately
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
                console.log('ðŸ›‘ Speech synthesis cancelled');
            }
            
            // 2. Stop voice recognition
            if (window.recognition) {
                try {
                    window.recognition.abort();
                    console.log('ðŸ›‘ Voice recognition stopped');
                } catch (e) {
                    console.log('ðŸ›‘ Voice recognition already stopped');
                }
            }
            
            // 3. Clear all voice states
            if (typeof window.isListening !== 'undefined') window.isListening = false;
            if (typeof window.isWakeListening !== 'undefined') window.isWakeListening = false;
            if (typeof window.isSpeaking !== 'undefined') window.isSpeaking = false;
            if (typeof window.isSpeechOutputActive !== 'undefined') window.isSpeechOutputActive = false;
            
            // 4. Stop any wake listening
            if (typeof window.stopWakeListening === 'function') {
                window.stopWakeListening();
            }
            
            // 5. Update UI
            const voiceBtn = document.getElementById('voiceBtn');
            const voiceInputBtn = document.getElementById('voiceInputBtn');
            const voiceCircles = document.querySelectorAll('.voice-circle');
            
            if (voiceBtn) {
                voiceBtn.classList.remove('active', 'recording');
            }
            if (voiceInputBtn) {
                voiceInputBtn.classList.remove('active', 'recording');
            }
            voiceCircles.forEach(circle => {
                circle.style.borderColor = 'rgba(0, 170, 255, 0.3)';
                circle.style.boxShadow = '0 0 10px rgba(0, 170, 255, 0.2)';
            });
            
            // 6. Update status
            const statusText = document.querySelector('.voice-status-text');
            if (statusText) {
                statusText.textContent = 'nova stopped. Ready for new command.';
            }
            
            // 7. Show notification
            if (typeof showVoiceNotification === 'function') {
                showVoiceNotification('nova interrupted and stopped', 2000);
            }
            
            console.log('ðŸ›‘ nova stopped successfully');
        };*/

        console.log('ðŸš€ N.O.V.A v5 loaded successfully');
        console.log('ðŸš€ Available test functions:');
        console.log('');
        console.log('ðŸ”Š VOICE SYNTHESIS (Speaking):');
        console.log('  - testVoiceResponse("hello") - Test voice synthesis');
        console.log('  - testVoiceSelection() - Test different voices');
        console.log('  - testSpeech() - Main speech test (if voice script loaded)');
        console.log('');
        console.log('ðŸŽ¤ VOICE RECOGNITION (Listening):');
        console.log('  - requestMicPermission() - Request microphone access FIRST');
        console.log('  - testVoiceRecognitionSetup() - Check voice recognition system');
        console.log('  - testDirectVoiceRecognition() - Test direct voice recognition');
        console.log('  - startListeningDirect() - Start listening directly');
        console.log('  - stopListeningDirect() - Stop listening directly');
        console.log('  - fixMicrophoneButton() - Fix microphone button if broken');
        console.log('');
        console.log('ðŸ§ª FULL TESTS:');
        console.log('  - testFullVoiceWorkflow() - Complete voice test sequence');
        console.log('  - debugVoice() - Check voice system status');
        console.log('');
        console.log('ðŸŽ­ OTHER FUNCTIONS:');
        console.log('  - testModeClick("genius") - Test mode selection');
        console.log('  - checkModeCards() - Check mode card status');
        console.log('  - testAI("hello", "genius") - Test AI responses');
        console.log('  - testVoiceCommand("tell me about Mars") - Test voice processing');
        console.log('');
        console.log('ðŸš¨ TROUBLESHOOTING STEPS:');
        console.log('1. requestMicPermission() - Allow microphone access');
        console.log('2. testVoiceRecognitionSetup() - Check if system is working');
        console.log('3. testDirectVoiceRecognition() - Test if it can hear you');
        console.log('4. fixMicrophoneButton() - Fix button if needed');
        console.log('');
        console.log('ðŸš€ Main functions loaded:', typeof window.testSpeech !== 'undefined' ? 'âœ…' : 'âŒ');
        console.log('ðŸŽ¤ Note: Mixpanel errors are harmless (analytics blocked by browser)');

