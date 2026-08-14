// Runtime voice UI module
// Extracted from nova_runtime_features.js.

function startSystemAnimations() {
    // Start arc reactor animation
    const arcReactor = document.querySelector('.arc-reactor');
    if (arcReactor) {
        arcReactor.classList.add('active');
    }
    
    // Start background circuit animations
    const circuitLines = document.querySelector('.circuit-lines');
    if (circuitLines) {
        circuitLines.classList.add('active');
    }
    
    // Pulse system status
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.classList.add('pulse');
    }
}

function updateVoiceStatus(status) {
    const voiceStatusText = document.querySelector('.voice-status-text');
    if (voiceStatusText) {
        voiceStatusText.textContent = status;
    }
    console.log('🔊 Voice status updated:', status);
}

function updateVoiceVisualizer(active) {
    const voiceCircles = document.querySelectorAll('.voice-circle');
    if (active) {
        voiceCircles.forEach(circle => circle.classList.add('active'));
    } else {
        voiceCircles.forEach(circle => circle.classList.remove('active'));
    }
}

function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
}

// Auto-resize textarea to fit content
function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight, but respect min and max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 150);
    textarea.style.height = newHeight + 'px';
}

function getnovaAudioPackOptions() {
    if (Array.isArray(window.nova_AUDIO_PACKS) && window.nova_AUDIO_PACKS.length > 0) {
        return window.nova_AUDIO_PACKS;
    }

    return [
        { id: 'nova-pack-cfx', name: 'nova Pack - CFX' },
        { id: 'nova-pack-ghv4', name: 'nova Pack - GHV4' },
        { id: 'nova-pack-proffie', name: 'nova Pack - ProffieOS V2' },
        { id: 'nova-pack-sn4', name: 'nova Pack - SN4' },
        { id: 'nova-pack-xeno2', name: 'nova Pack - Xeno2' },
        { id: 'nova-pack-xeno3', name: 'nova Pack - Xeno3' }
    ];
}

function populateVoiceSelection() {
    const voiceSelect = document.getElementById('voiceSelection');
    if (!voiceSelect) {
        console.log('🔊 Voice selection dropdown not found');
        return;
    }
    
    console.log('🔊 Populating voice selection...');
    
    if (!window.speechSynthesis) {
        console.error('🔊 Speech synthesis not supported');
        return;
    }
    
    const voices = window.speechSynthesis.getVoices();
    console.log('🔊 Found voices:', voices.length);
    
    if (voices.length === 0) {
        console.log('🔊 No voices available yet, will retry...');
        setTimeout(populateVoiceSelection, 1000);
        return;
    }
    
    // Clear existing options
    voiceSelect.innerHTML = '<option value="">Default System Voice</option>';
    
    // Filter for English voices and prioritize British
    const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
    
    // Prioritize British English voices (en-GB) for authentic Nova experience
    const britishVoices = englishVoices.filter(voice => 
        voice.lang.includes('GB') || voice.lang.includes('UK') ||
        voice.name.toLowerCase().includes('british') ||
        voice.name.toLowerCase().includes('england') ||
        voice.name.toLowerCase().includes('daniel') ||  // Often British
        voice.name.toLowerCase().includes('oliver') ||  // Often British
        voice.name.toLowerCase().includes('arthur') ||  // Often British
        voice.name.toLowerCase().includes('thomas')     // Often British
    );
    
    // Nova-like characteristics: Deep, articulate, sophisticated
    const NovaVoices = englishVoices.filter(voice => {
        const name = voice.name.toLowerCase();
        return (
            name.includes('male') || 
            name.includes('david') ||
            name.includes('daniel') ||
            name.includes('alex') ||
            name.includes('thomas') ||
            name.includes('oliver') ||
            name.includes('arthur') ||
            name.includes('james') ||
            name.includes('william') ||
            name.includes('george') ||
            voice.localService
        ) && !name.includes('female') && !name.includes('compact');
    });
    
    // Best Nova voices: British + Male characteristics
    const bestNovaVoices = NovaVoices.filter(voice => 
        britishVoices.includes(voice) || voice.lang.includes('GB')
    );
    
    console.log('🇬🇧 British voices found:', britishVoices.length);
    console.log('🤖 Nova-suitable voices:', NovaVoices.length);
    console.log('⭐ Best Nova voices:', bestNovaVoices.length);
    
    const novaPacks = getnovaAudioPackOptions();
    if (novaPacks.length > 0) {
        const packGroup = document.createElement('optgroup');
        packGroup.label = 'nova Audio Packs (.wav)';
        novaPacks.forEach(pack => {
            const option = document.createElement('option');
            option.value = `pack:${pack.id}`;
            option.textContent = `${pack.name} 🎵`;
            packGroup.appendChild(option);
        });
        voiceSelect.appendChild(packGroup);
    }

    // Add best Nova voices first (British + suitable characteristics)
    if (bestNovaVoices.length > 0) {
        const bestGroup = document.createElement('optgroup');
        bestGroup.label = '⭐ Premium Nova Voices (British)';
        bestNovaVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            bestGroup.appendChild(option);
        });
        voiceSelect.appendChild(bestGroup);
    }
    
    // Add other British voices
    const otherBritishVoices = britishVoices.filter(voice => !bestNovaVoices.includes(voice));
    if (otherBritishVoices.length > 0) {
        const britishGroup = document.createElement('optgroup');
        britishGroup.label = '🇬🇧 Other British Voices';
        otherBritishVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            britishGroup.appendChild(option);
        });
        voiceSelect.appendChild(britishGroup);
    }
    
    // Add other Nova-suitable voices (non-British)
    const otherNovaVoices = NovaVoices.filter(voice => 
        !bestNovaVoices.includes(voice) && !otherBritishVoices.includes(voice)
    );
    if (otherNovaVoices.length > 0) {
        const NovaGroup = document.createElement('optgroup');
        NovaGroup.label = '🤖 Recommended Nova Voices';
        otherNovaVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            NovaGroup.appendChild(option);
        });
        voiceSelect.appendChild(NovaGroup);
    }
    
    // Add all remaining English voices
    const remainingVoices = englishVoices.filter(voice => 
        !bestNovaVoices.includes(voice) && 
        !otherBritishVoices.includes(voice) && 
        !otherNovaVoices.includes(voice)
    );
    if (remainingVoices.length > 0) {
        const otherGroup = document.createElement('optgroup');
        otherGroup.label = 'Other English Voices';
        remainingVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            otherGroup.appendChild(option);
        });
        voiceSelect.appendChild(otherGroup);
    }

    // Try to restore saved voice preference
    let voiceToSelect = null;
    try {
        const savedPreferenceKeys = ['NovaVoicePreference', 'novaVoicePreference'];
        for (const preferenceKey of savedPreferenceKeys) {
            const savedPreference = localStorage.getItem(preferenceKey);
            if (!savedPreference) {
                continue;
            }

            const pref = JSON.parse(savedPreference);
            voiceToSelect = voices.find(voice => voice.name === pref.name && voice.lang === pref.lang);
            if (voiceToSelect) {
                window.selectedVoice = voiceToSelect;
                console.log('🔊 Restored saved voice:', voiceToSelect.name);
                break;
            }
        }
    } catch (e) {
        console.warn('Could not restore voice preference:', e);
    }

    const savedMode = localStorage.getItem('Nova_voice_mode');
    const savedPack = localStorage.getItem('Nova_selected_nova_pack');
    const savedPackValue = savedPack ? `pack:${savedPack}` : null;
    
    // Auto-select best Nova voice if no preference is saved
    if (!voiceToSelect && !window.selectedVoice) {
        // Priority order for auto-selection
        let autoSelectedVoice = null;
        
        if (bestNovaVoices.length > 0) {
            autoSelectedVoice = bestNovaVoices[0];
            console.log('🎯 Auto-selected premium British Nova voice:', autoSelectedVoice.name);
        } else if (otherBritishVoices.length > 0) {
            autoSelectedVoice = otherBritishVoices[0];
            console.log('🇬🇧 Auto-selected British voice:', autoSelectedVoice.name);
        } else if (otherNovaVoices.length > 0) {
            autoSelectedVoice = otherNovaVoices[0];
            console.log('🤖 Auto-selected Nova-suitable voice:', autoSelectedVoice.name);
        }
        
        if (autoSelectedVoice) {
            window.selectedVoice = autoSelectedVoice;
            voiceToSelect = autoSelectedVoice;
        }
    }
    
    // Set current voice in dropdown
    if (savedMode === 'nova-pack' && savedPackValue && Array.from(voiceSelect.options).some(option => option.value === savedPackValue)) {
        voiceSelect.value = savedPackValue;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('nova-pack', savedPack);
        }
    } else if (window.selectedVoice) {
        voiceSelect.value = window.selectedVoice.name;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('tts', null);
        }
    } else if (voiceToSelect) {
        voiceSelect.value = voiceToSelect.name;
        window.selectedVoice = voiceToSelect;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('tts', null);
        }
    }
}

function setupVoiceSettings() {
    console.log('🔧 Setting up voice settings...');
    
    // Load voices
    populateVoiceSelection();
    
    // Voice selection handler
    const voiceSelect = document.getElementById('voiceSelection');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log('🔊 Voice selection changed to:', selectedValue);

            if (selectedValue === 'nova-single-voice') {
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'true');
                showNotification('nova voice mode enabled', 2000);
                return;
            }
            
            if (!selectedValue) {
                window.selectedVoice = null;
                console.log('🔊 Using default voice');
                showNotification('Using default system voice', 2000);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                
                // Clear saved preference
                try {
                    localStorage.removeItem('NovaVoicePreference');
                    localStorage.removeItem('novaVoicePreference');
                } catch (e) {
                    console.warn('Could not clear voice preference:', e);
                }
                return;
            }

            if (selectedValue.startsWith('pack:')) {
                const packId = selectedValue.replace('pack:', '');
                const selectedPack = getnovaAudioPackOptions().find(pack => pack.id === packId);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('nova-pack', packId);
                }

                showNotification(`Voice changed to: ${selectedPack ? selectedPack.name : 'nova audio pack'}`, 2000);
                setTimeout(() => {
                    if (typeof window.speakText === 'function') {
                        window.speakText('Voice pack selected, sir.');
                    }
                }, 300);
                return;
            }

            const voiceName = selectedValue.startsWith('tts:') ? selectedValue.replace('tts:', '') : selectedValue;
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(voice => voice.name === voiceName);
            if (selectedVoice) {
                window.selectedVoice = selectedVoice;
                console.log('🔊 Voice object set:', selectedVoice);
                console.log('🔊 Voice details - Name:', selectedVoice.name, 'Lang:', selectedVoice.lang, 'Local:', selectedVoice.localService);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                
                // Store in localStorage for persistence
                try {
                    const voicePreference = JSON.stringify({
                        name: selectedVoice.name,
                        lang: selectedVoice.lang
                    });
                    localStorage.setItem('NovaVoicePreference', voicePreference);
                    localStorage.setItem('novaVoicePreference', voicePreference);
                } catch (e) {
                    console.warn('Could not save voice preference:', e);
                }
                
                showNotification(`Voice changed to: ${selectedVoice.name}`, 2000);
                
                // Immediate test to confirm voice change
                setTimeout(() => {
                    window.testVoiceResponse(`Voice changed to ${selectedVoice.name}, sir.`);
                }, 500);
            }
        });
    }
    
    // Preview voice button
    const previewBtn = document.getElementById('previewVoiceBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            const testText = "Good day, sir. This is N.O.V.A. How do you find this voice?";
            console.log('🎧 Preview button clicked');
            console.log('🎧 Current selected voice:', window.selectedVoice ? window.selectedVoice.name : 'none');
            
            // Cancel any ongoing speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            
            // Use enhanced speak function
            if (typeof window.enhancedSpeakText === 'function') {
                window.enhancedSpeakText(testText);
            } else if (typeof window.speakText === 'function') {
                window.speakText(testText);
            } else {
                // Direct fallback preview (with speech-friendly text)
                const speechFriendlyTestText = window.makeSpeechFriendly(testText);
                console.log('🔊 Preview text (original):', testText);
                console.log('🔊 Preview text (speech-friendly):', speechFriendlyTestText);
                const utterance = new SpeechSynthesisUtterance(speechFriendlyTestText);
                
                // Use currently selected voice
                if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
                    utterance.voice = window.selectedVoice;
                    console.log('🎧 Using voice for preview:', window.selectedVoice.name);
                } else {
                    console.log('🎧 Using default voice for preview');
                }
                
                utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
                utterance.pitch = 0.8;
                utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
                
                utterance.onstart = () => console.log('🎧 Preview started');
                utterance.onend = () => console.log('🎧 Preview ended');
                utterance.onerror = (e) => console.error('🎧 Preview error:', e);
                
                window.speechSynthesis.speak(utterance);
            }
        });
    }
}


