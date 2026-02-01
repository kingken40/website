// N.O.V.A Main Interface - Enhanced Debug Version

// ========================================
// API CONFIGURATION - MULTI-PROVIDER SUPPORT
// ========================================
// TODO: Replace with your own API keys
// Get your API keys from:
// - OpenAI: https://platform.openai.com/api-keys
// - Groq: https://console.groq.com/keys
// - Cohere: https://dashboard.cohere.com/api-keys
// - Gemini: https://makersuite.google.com/app/apikey
// - Hugging Face: https://huggingface.co/settings/tokens

const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
const GROQ_API_KEY = 'YOUR_GROQ_API_KEY_HERE';
const COHERE_API_KEY = 'YOUR_COHERE_API_KEY_HERE';
const GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
const HUGGINGFACE_API_KEY = 'YOUR_HUGGINGFACE_API_KEY_HERE';

const API_URL = 'https://api.openai.com/v1/chat/completions';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// AI Provider Configuration
let currentProvider = 'groq'; // Options: 'openai', 'groq', 'gemini' - Using Groq (FREE, fastest)
let currentModel = 'llama-3.3-70b-versatile'; // Default model

const providerConfig = {
    openai: {
        apiKey: OPENAI_API_KEY,
        apiUrl: API_URL,
        model: 'gpt-4o-mini',
        maxTokens: 800
    },
    groq: {
        apiKey: GROQ_API_KEY,
        apiUrl: GROQ_API_URL,
        model: 'llama-3.3-70b-versatile', // Fast and high quality (updated model)
        maxTokens: 2048
    },
    gemini: {
        apiKey: GEMINI_API_KEY,
        apiUrl: GEMINI_API_URL,
        model: 'gemini-pro',
        maxTokens: 1024
    }
};

let currentPersonality = 'Nova';

// Initialize conversation history
let conversationHistory = [];

// Initialize voice system variables
window.isListening = false;
window.isWakeListening = false;
window.hasVoicePermission = false;
window.isVoiceSupported = false;

// Check if voice variables exist, if not create them
if (typeof window.isVoiceEnabled === 'undefined') {
    window.isVoiceEnabled = false;
}

// Personality configurations
const personalities = {
    Nova: {
        name: 'N.O.V.A',
        greeting: null,
        style: 'British AI assistant with dry wit - conversational yet sophisticated, helpful and efficient',
        responsePrefix: 'Certainly, sir. '
    },
    genius: {
        name: 'Genius Mode',
        greeting: 'Genius mode activated. Ready for advanced problem solving.',
        style: 'analytical, technical, solution-focused',
        responsePrefix: 'Analyzing... '
    },
    professor: {
        name: 'Professor',
        greeting: 'Welcome to class. Ready to learn something new today?',
        style: 'educational, patient, explanatory',
        responsePrefix: 'Let me explain... '
    },
    analyst: {
        name: 'Data Analyst',
        greeting: 'Data analysis systems online. Ready to process information.',
        style: 'data-driven, precise, statistical',
        responsePrefix: 'Based on the data... '
    }
};

function getRandomNovaGreeting() {
    const greetings = [
        "At your service, sir.",
        "Good day, sir. Nova at your service.",
        "At your service, sir. How may I assist you today?",
        "Good day, sir. Systems are fully operational. We're online and ready",
        "Greetings, sir. Nova at your service.",
        "At your service, sir. All systems online and ready.",
        "Good day, sir. How may I be of service?",
        "At your service, sir. What can I help you with today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

// Current chat history
let chatHistory = [];

function initializeNova() {
    console.log('🤖 Initializing Nova systems...');
    const provider = providerConfig[currentProvider];
    console.log('🔑 AI Provider:', currentProvider.toUpperCase(), '(FREE, Fastest)');
    console.log('🔑 API Endpoint:', provider.apiUrl);
    console.log('🧠 AI Model:', provider.model);
    console.log('💭 Max tokens:', provider.maxTokens);
    
    // Fix voice integration issues
    if (typeof window.voiceIntegrationFix === 'function') {
        window.voiceIntegrationFix();
    }
    
    // Initialize voice system
    if (typeof window.initializeVoice === 'function') {
        window.initializeVoice();
    }
    
    // Setup voice buttons after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof window.setupVoiceButtons === 'function') {
            console.log('🎤 Setting up voice buttons from main initialization...');
            window.setupVoiceButtons();
        }
    }, 100);
    
    // Set default personality
    selectPersonality('Nova');
    
    // Start system animations
    startSystemAnimations();
    
    // Test voice system after a delay
    setTimeout(() => {
        console.log('🧪 Testing voice system integration...');
        
        // Test if voices are available
        if (window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices();
            console.log('🔊 Available voices:', voices.length);
            if (voices.length > 0) {
                console.log('🔊 First voice:', voices[0].name);
            }
        }
        
        // Test speakText function
        if (typeof window.speakText === 'function') {
            console.log('✅ speakText function available');
        } else {
            console.error('❌ speakText function missing');
        }
        
        // Test voice recognition functions
        console.log('🎤 Voice functions status:');
        console.log('  - startWakeListening:', typeof window.startWakeListening);
        console.log('  - stopWakeListening:', typeof window.stopWakeListening);
        console.log('  - processVoiceCommand:', typeof window.processVoiceCommand);
    }, 2000);
    
    console.log('✅ N.O.V.A systems online');
}

function selectPersonality(personalityType) {
    console.log('🎭 Switching to personality:', personalityType);
    currentPersonality = personalityType;
    
    // Update UI - Update mode cards with active class and data-active attribute
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.classList.remove('active');
        card.removeAttribute('data-active');
        if (card.dataset.personality === personalityType) {
            card.classList.add('active');
            card.setAttribute('data-active', 'true');
            // Force style recalculation
            void card.offsetHeight;
        }
    });
    
    // Update chat title
    const currentModeElement = document.querySelector('.current-mode');
    if (currentModeElement) {
        currentModeElement.textContent = personalities[personalityType].name + ' Mode';
    }
    
    // Greet with new personality
    const greeting = personalityType === 'Nova' ? getRandomNovaGreeting() : personalities[personalityType].greeting;
    addMessage(greeting, 'Nova');
    
    // Speak greeting if voice is enabled (with proper voice coordination)
    if (typeof window.speakText === 'function') {
        console.log('🔊 Mode Switch: Starting voice greeting with coordination...');
        window.speakText(greeting, () => {
            console.log('🔊 Mode Switch: Voice greeting completed');
        });
    }
    
    showNotification(`Switched to ${personalities[personalityType].name}`, 2000);
}

function addMessage(text, sender, timestamp = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Remove thinking indicator
    removeThinkingIndicator();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const currentTime = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let senderName = 'You';
    if (sender === 'Nova') {
        const personality = personalities[currentPersonality] || personalities['Nova'];
        senderName = personality ? personality.name : 'N.O.V.A';
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">${senderName}</span>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">${text}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history
    chatHistory.push({
        text: text,
        sender: sender,
        timestamp: currentTime,
        personality: currentPersonality
    });
    
    console.log('💬 Message added:', { sender, text: text.substring(0, 50) + '...', personality: currentPersonality });
}

function processUserMessage(userMessage) {
    console.log('💭 ==========================================');
    console.log('💭 processUserMessage CALLED');
    console.log('💭 Message:', userMessage);
    console.log('💭 Current personality:', currentPersonality);
    console.log('💭 ==========================================');
    
    try {
        // Add user message to chat
        addMessage(userMessage, 'user');
        
        // Add thinking indicator
        addThinkingIndicator();
        
        // Clear input
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
        }
        
        // Generate AI response
        setTimeout(() => {
            generateAIResponse(userMessage, currentPersonality);
        }, 1000);
    } catch (error) {
        console.error('❌ Error in processUserMessage:', error);
        removeThinkingIndicator();
        addMessage('System error processing your message. Please try again.', 'Nova');
    }
}

// Enhanced AI integration with multi-provider support and improved error handling
async function generateAIResponse(userMessage, personality) {
    console.log('🤖 Generating AI response for personality:', personality);
    
    // Get current provider configuration
    const provider = providerConfig[currentProvider];
    console.log('🚀 Sending request to', currentProvider.toUpperCase(), 'API (', provider.model, ')...');
    
    try {
        // Add network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Prepare messages array with conversation history
        const messages = prepareOpenAIMessages(userMessage, personality);
        
        const requestPayload = {
            model: provider.model,
            messages: messages,
            max_tokens: provider.maxTokens,
            temperature: 0.7,
            stream: false
        };
        
        console.log('🤖', currentProvider.toUpperCase(), 'Request:');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(provider.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${provider.apiKey}`
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Response received - Status:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorText = 'Unknown error';
            let errorDetails = null;
            
            try {
                errorText = await response.text();
                console.error('🔧 DEBUG - Raw error response:', errorText);
                
                // Try to parse as JSON for more details
                try {
                    errorDetails = JSON.parse(errorText);
                    console.error('🔧 DEBUG - Parsed error JSON:', errorDetails);
                    
                    // Extract specific OpenAI error message
                    if (errorDetails.error && errorDetails.error.message) {
                        errorText = errorDetails.error.message;
                    }
                } catch (e) {
                    console.error('🔧 DEBUG - Error response is not valid JSON');
                }
            } catch (e) {
                console.error('🔧 DEBUG - Could not read error response:', e);
            }
            
            // Log request details for debugging
            console.error('🔧 DEBUG - Request details:');
            console.error('  - Provider:', currentProvider.toUpperCase());
            console.error('  - URL:', provider.apiUrl);
            console.error('  - Status:', response.status);
            console.error('  - Status Text:', response.statusText);
            
            throw new Error(`${currentProvider.toUpperCase()} API Error (${response.status}): ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('📦', currentProvider.toUpperCase(), 'Response:', responseData);
        
        // Response format validation
        if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
            throw new Error(`Invalid ${currentProvider.toUpperCase()} response format`);
        }
        
        const reply = responseData.choices[0].message.content;
        console.log('✅', currentProvider.toUpperCase(), 'Response Success - Length:', reply.length, 'characters');
        console.log('🎭 Personality:', personality);
        
        // Remove thinking indicator
        removeThinkingIndicator();
        
        // Add response to chat
        addMessage(reply, 'Nova');
        
        // Save to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: reply,
            personality: personality,
            timestamp: new Date().toISOString()
        });
        
        // Speak response if voice is enabled (with proper voice coordination)
        if (typeof window.speakText === 'function') {
            console.log('🔊 AI Response: Starting voice output with coordination...');
            console.log('🔊 AI Response: isWakeWordSession =', window.isWakeWordSession);
            
            // Only add restoration callback if this is a wake word session
            if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                window.speakText(reply, () => {
                    console.log('🔊 AI Response: Voice output completed');
                    console.log('🔊 AI Response complete - restoring wake listening');
                    window.restoreWakeListeningAfterResponse();
                });
            } else {
                window.speakText(reply, () => {
                    console.log('🔊 AI Response: Voice output completed (push-to-talk mode)');
                });
            }
        }
        
    } catch (error) {
        console.error('🔧 DEBUG - Full error object:', error);
        console.error('🔧 DEBUG - Error message:', error.message);
        console.error('🔧 DEBUG - Error stack:', error.stack);
        
        // Remove thinking indicator - wrapped in try-catch to prevent secondary errors
        try {
            removeThinkingIndicator();
        } catch (e) {
            console.error('Error removing thinking indicator:', e);
        }
        
        let errorMsg;
        
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Request timed out - The AI response is taking too long. Please try again.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMsg = '🔑 Authentication Error - API configuration issue. Please contact the administrator.';
        } else if (error.message.includes('429')) {
            errorMsg = '🚫 Rate limit exceeded - Too many requests. Please wait a moment before trying again.';
        } else if (error.message.includes('insufficient_quota') || error.message.includes('billing')) {
            errorMsg = '💳 API Quota Exceeded - Service quota has been reached. Please contact the administrator.';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorMsg = '🔧 Server error - The service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorMsg = '🌐 Network error - Check your connection and try again.';
        } else if (!navigator.onLine) {
            errorMsg = '🌐 No internet connection - Please check your network and try again.';
        } else {
            errorMsg = `❌ AI Error: ${error.message}`;
            console.error('🔧 Full error for debugging:', error);
        }
        
        // Ensure error message is always added to chat
        try {
            addMessage(errorMsg, 'Nova');
        } catch (e) {
            console.error('Failed to add error message to chat:', e);
        }
        
        // Speak error message if voice is enabled (for voice command flow)
        if (typeof window.speakText === 'function') {
            console.log('🔊 AI Error: Speaking error message with coordination...');
            console.log('🔊 AI Error: isWakeWordSession =', window.isWakeWordSession);
            
            // Only add restoration callback if this is a wake word session
            if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                window.speakText(errorMsg, () => {
                    console.log('🔊 AI Error: Error message voice output completed');
                    console.log('🔊 AI Error complete - restoring wake listening');
                    window.restoreWakeListeningAfterResponse();
                });
            } else {
                window.speakText(errorMsg, () => {
                    console.log('🔊 AI Error: Error message voice output completed (push-to-talk mode)');
                });
            }
        }
    }
}

function prepareOpenAIMessages(userMessage, personality) {
    console.log('📝 Preparing messages for OpenAI with personality:', personality);
    
    // Get personality config
    const config = personalities[personality] || personalities.Nova;
    
    // System message with personality
    const systemMessage = {
        role: "system",
        content: `You are ${config.name}, a ${config.style}.

Keep responses natural and conversational. Be helpful and direct - skip unnecessary formality and preamble.

If you are N.O.V.A:
- Address user as "sir" when appropriate
- Use dry British humor and occasional witty sarcasm
- Be intelligent and efficient
- Think Paul Bettany's Nova: witty, helpful, authoritative but never condescending

If you are Genius Mode:
- Analytical and technical
- Break down problems systematically

If you are Professor:
- Educational and patient
- Explain clearly

If you are Data Analyst:
- Data-driven insights
- Precise and statistical`
    };
    
    // Build messages array starting with system message
    const messages = [systemMessage];
    
    // Add recent conversation history (last 6 messages to avoid token limits)
    const recentHistory = conversationHistory.slice(-6);
    for (const msg of recentHistory) {
        messages.push({
            role: msg.role,
            content: msg.content
        });
    }
    
    // Add current user message
    messages.push({
        role: "user",
        content: userMessage
    });
    
    // Save user message to history
    conversationHistory.push({
        role: 'user',
        content: userMessage,
        personality: personality,
        timestamp: new Date().toISOString()
    });
    
    console.log('📤 Prepared messages array:', messages);
    return messages;
}

// Note: Default responses removed - now using OpenAI exclusively for intelligent responses

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
        const savedPreference = localStorage.getItem('NovaVoicePreference');
        if (savedPreference) {
            const pref = JSON.parse(savedPreference);
            voiceToSelect = voices.find(voice => voice.name === pref.name && voice.lang === pref.lang);
            if (voiceToSelect) {
                window.selectedVoice = voiceToSelect;
                console.log('🔊 Restored saved voice:', voiceToSelect.name);
            }
        }
    } catch (e) {
        console.warn('Could not restore voice preference:', e);
    }
    
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
    if (window.selectedVoice) {
        voiceSelect.value = window.selectedVoice.name;
    } else if (voiceToSelect) {
        voiceSelect.value = voiceToSelect.name;
        window.selectedVoice = voiceToSelect;
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
            const voiceName = this.value;
            console.log('🔊 Voice selection changed to:', voiceName);
            
            if (voiceName) {
                const voices = window.speechSynthesis.getVoices();
                const selectedVoice = voices.find(voice => voice.name === voiceName);
                if (selectedVoice) {
                    window.selectedVoice = selectedVoice;
                    console.log('🔊 Voice object set:', selectedVoice);
                    console.log('🔊 Voice details - Name:', selectedVoice.name, 'Lang:', selectedVoice.lang, 'Local:', selectedVoice.localService);
                    
                    // Store in localStorage for persistence
                    try {
                        localStorage.setItem('NovaVoicePreference', JSON.stringify({
                            name: selectedVoice.name,
                            lang: selectedVoice.lang
                        }));
                    } catch (e) {
                        console.warn('Could not save voice preference:', e);
                    }
                    
                    showNotification(`Voice changed to: ${selectedVoice.name}`, 2000);
                    
                    // Immediate test to confirm voice change
                    setTimeout(() => {
                        window.testVoiceResponse(`Voice changed to ${selectedVoice.name}, sir.`);
                    }, 500);
                }
            } else {
                window.selectedVoice = null;
                console.log('🔊 Using default voice');
                showNotification('Using default system voice', 2000);
                
                // Clear saved preference
                try {
                    localStorage.removeItem('NovaVoicePreference');
                } catch (e) {
                    console.warn('Could not clear voice preference:', e);
                }
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
            const messageInput = document.getElementById('messageInput');
            if (messageInput && messageInput.value.trim()) {
                processUserMessage(messageInput.value.trim());
            }
        });
    }
    
    // Enter key for message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (messageInput.value.trim()) {
                    processUserMessage(messageInput.value.trim());
                }
            }
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
    
    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('active');
        });
    }
    
    if (closeSettings && settingsModal) {
        closeSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
    }
    
    // File upload
    const attachBtn = document.getElementById('attachBtn');
    const fileMenu = document.getElementById('fileMenu');
    
    if (attachBtn && fileMenu) {
        attachBtn.addEventListener('click', () => {
            fileMenu.classList.toggle('active');
        });
    }
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

// Note: Microphone buttons are now handled exclusively by nova_voice.js (jarvis_voice.js)
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
            console.log('🎤 Voice recognition available - you can now say "Hey Nova"');
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
        chatHistory = [];
        conversationHistory = [];  // Also clear conversation history for OpenAI
        console.log('💬 Chat and conversation history cleared');
    }
}

// Initialize when DOM is loaded
function initializeMainSystem() {
    console.log('🚀 Initializing N.O.V.A main system...');
    
    // Initialize core systems
    initializeNova();
    setupEventListeners();
    setupVoiceSettings();
    
    // Wait for voices to load
    setTimeout(() => {
        populateVoiceSelection();
    }, 1000);
    
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
        localStorage.setItem('NovaVoicePreference', JSON.stringify(voicePreference));
        console.log('💾 Voice preference saved');
    } catch (e) {
        console.warn('⚠️ Could not save voice preference:', e);
    }
    
    // Update dropdown if it exists
    const voiceSelect = document.getElementById('voiceSelection');
    if (voiceSelect) {
        voiceSelect.value = voice.name;
    }
    
    // Test the new voice
    const confirmPhrase = "Voice successfully updated, sir. N.O.V.A is now using " + voice.name + ".";
    if (typeof window.speakText === 'function') {
        window.speakText(confirmPhrase);
    }
}

// Export voice functions globally
window.findBritishVoices = findBritishVoices;
window.showAvailableVoices = showAvailableVoices;
window.testNovaVoice = testNovaVoice;
window.testVoiceByName = testVoiceByName;
window.setNovaVoice = setNovaVoice;

console.log('🌐 Global functions exported for voice integration');