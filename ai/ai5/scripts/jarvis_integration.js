// N.O.V.A Integration Script - Handles integration between voice and main systems
console.log('🔗 Loading N.O.V.A Integration...');

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
    
    // Ensure speech-friendly function is available (fallback if not loaded yet)
    if (!window.makeSpeechFriendly) {
        window.makeSpeechFriendly = function(text) {
            return text
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
    }

    // Fix speakText function if not available (with voice recognition coordination)
    if (typeof window.speakText !== 'function') {
        window.speakText = function(text, callback) {
            // Make text speech-friendly
            const speechText = window.makeSpeechFriendly(text);
            
            console.log('🔊 Integration fallback speakText with voice coordination (original):', text);
            console.log('🔊 Integration fallback speakText with voice coordination (speech-friendly):', speechText);
            
            if (!window.speechSynthesis) {
                console.error('🔊 Speech synthesis not available');
                return;
            }
            
            // Stop voice recognition during speech to prevent feedback loop
            console.log('🔊 Integration: Stopping voice recognition during speech...');
            let wasListening = false;
            let wasWakeListening = false;
            
            // Cancel any ongoing speech first
            window.speechSynthesis.cancel();
            
            // Mark speech as active to prevent auto-restart
            if (typeof window.isSpeechOutputActive !== 'undefined') {
                window.isSpeechOutputActive = true;
            }
            
            // Store current listening states
            if (window.isListening) {
                wasListening = true;
                window.isListening = false;
            }
            if (window.isWakeListening) {
                wasWakeListening = true;
                window.isWakeListening = false;
            }
            
            // Stop any active recognition with force
            if (window.recognition) {
                try {
                    // Set recognition state first
                    if (typeof window.stopWakeListening === 'function') {
                        window.stopWakeListening();
                    }
                    window.recognition.abort(); // Force stop
                    console.log('🔊 Integration: Voice recognition force stopped');
                } catch (e) {
                    console.log('🔊 Integration: Recognition already stopped');
                }
            }
            
            // Ensure global state is updated
            if (typeof window.isListening !== 'undefined') window.isListening = false;
            if (typeof window.isWakeListening !== 'undefined') window.isWakeListening = false;
            
            const utterance = new SpeechSynthesisUtterance(speechText);
            if (window.selectedVoice) {
                utterance.voice = window.selectedVoice;
            }
            // Optimized Nova voice characteristics
            utterance.rate = 0.85;  // Slightly slower for sophistication and clarity
            utterance.pitch = 0.75; // Lower pitch for authoritative, masculine tone
            utterance.volume = 0.8; // Clear and confident volume
            
            utterance.onend = () => {
                console.log('🔊 Integration: Finished speaking');
                
                // Clear speech active flag
                if (typeof window.isSpeechOutputActive !== 'undefined') {
                    window.isSpeechOutputActive = false;
                }
                
                // Restore wake listening state if it was active before
                if (wasWakeListening) {
                    console.log('🔊 Integration: Enabling wake listening state');
                    if (typeof window.isWakeListening !== 'undefined') {
                        window.isWakeListening = true;
                    }
                }
                
                // The voice system's own restart logic will handle restarting after speech is done
                console.log('🔊 Integration: Speech complete - voice system will auto-restart if needed');
                
                if (callback) callback();
            };
            
            utterance.onerror = (e) => {
                console.error('🔊 Integration: Speech error:', e);
                
                // Clear speech active flag
                if (typeof window.isSpeechOutputActive !== 'undefined') {
                    window.isSpeechOutputActive = false;
                }
                
                // Cancel any remaining speech
                window.speechSynthesis.cancel();
                
                // Restore wake listening state if it was active before
                if (wasWakeListening) {
                    console.log('🔊 Integration: Enabling wake listening state after error');
                    if (typeof window.isWakeListening !== 'undefined') {
                        window.isWakeListening = true;
                    }
                }
                
                // The voice system's own error recovery will handle restarting
                console.log('🔊 Integration: Speech error handled - voice system will recover');
            };
            
            window.speechSynthesis.speak(utterance);
        };
    }
    
    // Setup proper voice system integration
    setTimeout(() => {
        if (typeof populateVoiceSelection === 'function') {
            populateVoiceSelection();
        }
        console.log('✅ Voice integration fixed');
    }, 1000);
    
    return true;
};

// Enhanced voice text function that actually uses selected voice
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
    
    // Stop voice recognition during speech
    let wasListening = window.isListening || false;
    let wasWakeListening = window.isWakeListening || false;
    
    // Mark speech as active to prevent auto-restart
    if (typeof window.isSpeechOutputActive !== 'undefined') {
        window.isSpeechOutputActive = true;
    }
    
    if (window.isListening) window.isListening = false;
    if (window.isWakeListening) window.isWakeListening = false;
    
    if (window.recognition) {
        try {
            if (typeof window.stopWakeListening === 'function') {
                window.stopWakeListening();
            }
            window.recognition.abort();
            console.log('🔊 Enhanced: Voice recognition stopped for speech');
        } catch (e) {
            console.log('🔊 Enhanced: Recognition already stopped');
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
    // Optimized Nova voice characteristics (with user override capability)
    utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 0.85);  // Sophisticated pace
    utterance.pitch = 0.75; // Deep, authoritative Nova pitch
    utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.8); // Clear and confident
    
    utterance.onstart = () => console.log('🔊 Enhanced: Started speaking');
    utterance.onend = () => {
        console.log('🔊 Enhanced: Finished speaking');
        
        // Clear speech active flag
        if (typeof window.isSpeechOutputActive !== 'undefined') {
            window.isSpeechOutputActive = false;
        }
        
        // Restore wake listening state if it was active before
        if (wasWakeListening) {
            console.log('🔊 Enhanced: Enabling wake listening state');
            if (typeof window.isWakeListening !== 'undefined') {
                window.isWakeListening = true;
            }
        }
        
        // The voice system's own restart logic will handle restarting
        console.log('🔊 Enhanced: Speech complete - voice system will auto-restart if needed');
        
        if (callback) callback();
    };
    utterance.onerror = (e) => {
        console.error('🔊 Enhanced: Speech error:', e);
        
        // Clear speech active flag
        if (typeof window.isSpeechOutputActive !== 'undefined') {
            window.isSpeechOutputActive = false;
        }
        
        // Cancel any remaining speech
        window.speechSynthesis.cancel();
        
        // Restore wake listening state if it was active before
        if (wasWakeListening) {
            console.log('🔊 Enhanced: Enabling wake listening state after error');
            if (typeof window.isWakeListening !== 'undefined') {
                window.isWakeListening = true;
            }
        }
        
        // The voice system's own error recovery will handle restarting
        console.log('🔊 Enhanced: Speech error handled - voice system will recover');
    };
    
    window.speechSynthesis.speak(utterance);
};

// Override the main speakText function once everything is loaded
setTimeout(() => {
    window.speakText = window.enhancedSpeakText;
}, 500);

// Fix voice command processing
window.processVoiceCommand = function(command) {
    console.log('🎤 Processing voice command:', command);
    
    // Use the main interface's processUserMessage function
    if (typeof processUserMessage === 'function') {
        processUserMessage(command);
    } else {
        console.error('🎤 processUserMessage not available');
        // Fallback - add to chat manually
        if (typeof addMessage === 'function') {
            addMessage(command, 'user');
            setTimeout(() => {
                const response = `I heard "${command}" but there seems to be a system issue. Please try typing your request instead, sir.`;
                addMessage(response, 'Nova');
                window.speakText(response);
            }, 1000);
        }
    }
};

// Ensure all systems are properly integrated
window.addEventListener('load', function() {
    console.log('🔗 Window loaded, checking integrations...');
    
    setTimeout(() => {
        // Check if all main functions are available
        console.log('🔍 Integration status check:');
        console.log('  - processUserMessage:', typeof processUserMessage);
        console.log('  - addMessage:', typeof addMessage);
        console.log('  - populateVoiceSelection:', typeof populateVoiceSelection);
        console.log('  - initializeNova:', typeof initializeNova);
        console.log('  - window.speakText:', typeof window.speakText);
        console.log('  - window.initializeVoice:', typeof window.initializeVoice);
        
        // Run voice integration fix
        if (typeof window.voiceIntegrationFix === 'function') {
            window.voiceIntegrationFix();
        }
        
        console.log('✅ Integration check complete');
    }, 2000);
});

console.log('🔗 N.O.V.A Integration script loaded');