// Voice integration fixes extracted from AI_v5_nova.html

        // Fix voice integration issues
        window.voiceIntegrationFix = function() {
            console.log('ðŸ”§ Fixing voice integration...');
            
            // Check if voice script loaded properly
            if (typeof window.initializeVoice !== 'function') {
                console.error('âŒ Voice script not loaded properly');
                return false;
            }
            
            // Force initialize voice system
            if (typeof window.initializeVoice === 'function') {
                window.initializeVoice();
            }
            
            // Fix speakText function if not available
            if (typeof window.speakText !== 'function') {
                window.speakText = function(text, callback) {
                    console.log('ðŸ”Š Fallback speakText:', text);
                    if (window.speechSynthesis) {
                        const utterance = new SpeechSynthesisUtterance(text);
                        if (window.selectedVoice) {
                            utterance.voice = window.selectedVoice;
                        }
                        utterance.rate = 0.9;
                        utterance.pitch = 0.8;
                        utterance.volume = 0.7;
                        utterance.onend = callback || function() {};
                        window.speechSynthesis.speak(utterance);
                    }
                };
            }
            
            // Setup proper voice system integration
            setTimeout(() => {
                if (typeof loadAvailableVoices === 'function') {
                    loadAvailableVoices();
                }
                console.log('âœ… Voice integration fixed');
            }, 1000);
            
            return true;
        };
        
        // Enhanced voice text function that actually uses selected voice
        window.enhancedSpeakText = function(text, callback) {
            console.log('ðŸ”Š Enhanced speak text:', text);
            console.log('ðŸ”Š Selected voice:', window.selectedVoice ? window.selectedVoice.name : 'default');
            
            if (!window.speechSynthesis) {
                console.error('ðŸ”Š Speech synthesis not available');
                return;
            }
            
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Apply selected voice if available
            if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
                utterance.voice = window.selectedVoice;
                console.log('ðŸ”Š Using voice:', window.selectedVoice.name);
            } else {
                console.log('ðŸ”Š Using default voice');
            }
            
            // Apply voice settings
            utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
            utterance.pitch = 0.8; // nova-like pitch
            utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
            
            utterance.onstart = () => console.log('ðŸ”Š Started speaking');
            utterance.onend = () => {
                console.log('ðŸ”Š Finished speaking');
                if (callback) callback();
            };
            utterance.onerror = (e) => console.error('ðŸ”Š Speech error:', e);
            
            window.speechSynthesis.speak(utterance);
        };
        
        // Fix voice command processing
        window.processVoiceCommand = function(command) {
            console.log('ðŸŽ¤ Processing voice command:', command);
            
            // Use the main interface's processUserMessage function
            if (typeof processUserMessage === 'function') {
                processUserMessage(command);
            } else {
                console.error('ðŸŽ¤ processUserMessage not available');
                // Fallback - add to chat manually
                addMessage(command, 'user');
                setTimeout(() => {
                    const response = `I heard "${command}" but there seems to be a system issue. Please try typing your request instead, sir.`;
                    addMessage(response, 'nova');
                    window.speakText(response);
                }, 1000);
            }
        };

