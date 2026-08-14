// Runtime voice tools module
// Extracted from nova_runtime_features.js.

function findBritishVoices() {
    console.log('🇬🇧 Searching for British Nova voices...');
    
    if (!window.speechSynthesis) {
        console.error('❌ Speech synthesis not supported in this browser');
        return;
    }
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log('⏳ No voices loaded yet. Retrying in 1 second...');
        setTimeout(findBritishVoices, 1000);
        return;
    }
    
    const britishVoices = voices.filter(voice => 
        voice.lang.includes('GB') || voice.lang.includes('UK') ||
        voice.name.toLowerCase().includes('british') ||
        voice.name.toLowerCase().includes('england') ||
        voice.name.toLowerCase().includes('daniel') ||
        voice.name.toLowerCase().includes('oliver') ||
        voice.name.toLowerCase().includes('arthur') ||
        voice.name.toLowerCase().includes('thomas')
    );
    
    const NovaVoices = voices.filter(voice => {
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
            name.includes('george')
        ) && !name.includes('female') && !name.includes('compact');
    });
    
    const bestVoices = NovaVoices.filter(voice => 
        britishVoices.includes(voice) || voice.lang.includes('GB')
    );
    
    console.log('\n🎯 BEST Nova VOICES (British + Masculine):');
    if (bestVoices.length > 0) {
        bestVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
        console.log('\n💡 To test a voice: testVoiceByName("' + bestVoices[0].name + '")');
    } else {
        console.log('❌ No premium British Nova voices found');
    }
    
    console.log('\n🇬🇧 ALL BRITISH VOICES:');
    if (britishVoices.length > 0) {
        britishVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
    } else {
        console.log('❌ No British voices found');
    }
    
    console.log('\n🤖 ALL Nova-SUITABLE VOICES:');
    if (NovaVoices.length > 0) {
        NovaVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
    } else {
        console.log('❌ No Nova-suitable voices found');
    }
}

function showAvailableVoices() {
    console.log('🎵 All Available Voices:');
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log('⏳ No voices loaded yet. Retrying in 1 second...');
        setTimeout(showAvailableVoices, 1000);
        return;
    }
    
    voices.forEach((voice, i) => {
        const indicator = voice.localService ? '🎯' : '☁️';
        const lang = voice.lang;
        const isEnglish = lang.startsWith('en') ? '🇺🇸' : '';
        const isBritish = lang.includes('GB') || lang.includes('UK') ? '🇬🇧' : '';
        
        console.log(`${i + 1}. ${voice.name} (${lang}) ${indicator} ${isEnglish} ${isBritish}`);
    });
    
    console.log('\n🔍 Legend:');
    console.log('🎯 = Local/System voice (faster, more reliable)');
    console.log('☁️ = Online voice (may require internet)');
    console.log('🇺🇸 = English language');
    console.log('🇬🇧 = British English');
}

function testNovaVoice() {
    const testPhrase = "Good evening, sir. All systems are operational. N.O.V.A is online and ready to assist with any requests you may have.";
    
    if (window.selectedVoice) {
        console.log('🎭 Testing current voice:', window.selectedVoice.name);
    } else {
        console.log('🎭 Testing with system default voice');
    }
    
    if (typeof window.speakText === 'function') {
        window.speakText(testPhrase);
    } else {
        console.error('❌ speakText function not available');
    }
}

function testVoiceByName(voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    
    if (!voice) {
        console.error('❌ Voice not found:', voiceName);
        console.log('💡 Use showAvailableVoices() to see all available voices');
        return;
    }
    
    const previousVoice = window.selectedVoice;
    window.selectedVoice = voice;
    
    console.log('🎭 Testing voice:', voice.name, `(${voice.lang})`);
    
    const testPhrase = "Greetings, sir. This is " + voice.name + " speaking. How does this voice sound for your N.O.V.A assistant?";
    
    if (typeof window.speakText === 'function') {
        window.speakText(testPhrase, () => {
            // Restore previous voice after test
            window.selectedVoice = previousVoice;
            console.log('🎭 Voice test complete. Previous voice restored.');
            console.log('💡 If you like this voice, use: setNovaVoice("' + voiceName + '")');
        });
    } else {
        console.error('❌ speakText function not available');
        window.selectedVoice = previousVoice;
    }
}

function setNovaVoice(voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    
    if (!voice) {
        console.error('❌ Voice not found:', voiceName);
        console.log('💡 Use showAvailableVoices() to see all available voices');
        return;
    }
    
    window.selectedVoice = voice;
    console.log('✅ Nova voice set to:', voice.name, `(${voice.lang})`);
    
    // Save the preference
    try {
        const voicePreference = {
            name: voice.name,
            lang: voice.lang
        };
        const serializedPreference = JSON.stringify(voicePreference);
        localStorage.setItem('NovaVoicePreference', serializedPreference);
        localStorage.setItem('novaVoicePreference', serializedPreference);
        console.log('💾 Voice preference saved');
    } catch (e) {
        console.warn('⚠️ Could not save voice preference:', e);
    }
    
    // Update dropdown if it exists
    const voiceSelect = document.getElementById('voiceSelection');
    if (voiceSelect) {
        if (Array.from(voiceSelect.options).some(option => option.value === voice.name)) {
            voiceSelect.value = voice.name;
        } else if (Array.from(voiceSelect.options).some(option => option.value === `tts:${voice.name}`)) {
            voiceSelect.value = `tts:${voice.name}`;
        }
    }
    
    // Test the new voice
    const confirmPhrase = "Voice successfully updated, sir. N.O.V.A is now using " + voice.name + ".";
    if (typeof window.speakText === 'function') {
        window.speakText(confirmPhrase);
    }
}

// ========================================
// FILE UPLOAD FUNCTIONALITY
// ========================================

// Setup file upload event listeners

