// N.O.V.A Main Interface - Enhanced Debug Version

// ========================================
// API CONFIGURATION - MULTI-PROVIDER SUPPORT
// ========================================
// API keys are now stored in localStorage for user convenience
// Users can enter their own keys through Settings -> API Configuration

// Load API keys from localStorage or use defaults
function loadApiKey(keyName, defaultValue = '') {
    try {
        const stored = localStorage.getItem(keyName);
        if (stored && stored.trim() !== '' && !stored.startsWith('YOUR_') && stored.length > 20) {
            return stored.trim();
        }
    } catch(e) {}
    return defaultValue;
}

let OPENROUTER_API_KEY = loadApiKey('openrouter_api_key', '');
let OPENAI_API_KEY = loadApiKey('openai_api_key', '');
let HUGGINGFACE_API_KEY = loadApiKey('huggingface_api_key', '');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// AI Provider Configuration
let currentProvider = 'openrouter'; // Primary: OpenRouter, Fallback: openai
let currentModel = 'openai/gpt-4o-mini'; // Default OpenRouter model

const providerConfig = {
    openrouter: {
        get apiKey() { return OPENROUTER_API_KEY; },
        set apiKey(v) { OPENROUTER_API_KEY = v; },
        apiUrl: OPENROUTER_API_URL,
        model: 'openai/gpt-4o-mini',
        maxTokens: 2048,
        extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'N.O.V.A AI Assistant'
        }
    },
    openai: {
        get apiKey() { return OPENAI_API_KEY; },
        set apiKey(v) { OPENAI_API_KEY = v; },
        apiUrl: OPENAI_API_URL,
        model: 'gpt-4o-mini',
        maxTokens: 2048,
        extraHeaders: {}
    }
};

let currentPersonality = 'Nova';

// Initialize conversation history
let conversationHistory = [];

// File attachment state
let currentFileAttachment = null; // Stores { name, type, content, extension }

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
        greeting: 'Hello Mr. Ken. I, Nova, am at your service. How may I assist you today?',
        style: 'British AI assistant with dry wit - conversational yet sophisticated, helpful and efficient',
        responsePrefix: 'Certainly, sir. '
    },
    genius: {
        name: 'Genius Mode',
        greeting: 'Genius mode activated. Ready to solve complex problems.',
        style: 'analytical, technical, and solution-focused',
        responsePrefix: 'Analyzing... '
    },
    professor: {
        name: 'Professor',
        greeting: 'Welcome to class. Ready to learn something new today?',
        style: 'educational, patient, and explanatory',
        responsePrefix: 'Let me explain... '
    },
    analyst: {
        name: 'Data Analyst',
        greeting: 'Data analysis systems online. Ready to process information.',
        style: 'data-driven, precise, and statistical',
        responsePrefix: 'Based on the data... '
    },
    brainstorm: {
        name: 'Brainstorm Mode',
        greeting: 'Creative thinking mode activated. Let\'s explore some ideas together.',
        style: 'creative, exploratory, non-judgmental, generates multiple perspectives and "what-if" scenarios, encourages wild ideas and unconventional thinking',
        responsePrefix: 'Let\'s explore this... '
    },
    study: {
        name: 'Study Guide',
        greeting: 'Study Guide mode activated. Upload your course material in Settings and I\'ll help you master it.',
        style: 'expert academic assignment helper and study coach',
        responsePrefix: ''
    }
};

// ====== PERSISTENT MATERIAL STORE ======
let persistentMaterial = [];

function loadPersistentMaterial() {
    try {
        const stored = localStorage.getItem('nova_persistent_material');
        if (stored) {
            persistentMaterial = JSON.parse(stored);
        }
    } catch(e) {
        persistentMaterial = [];
    }
}

function savePersistentMaterial() {
    try {
        localStorage.setItem('nova_persistent_material', JSON.stringify(persistentMaterial));
    } catch(e) {
        console.warn('Could not save persistent material to localStorage');
    }
}

function addPersistentMaterialItem(name, content) {
    persistentMaterial.push({ id: Date.now(), name, content });
    savePersistentMaterial();
    renderMaterialList();
}

function removePersistentMaterialItem(id) {
    persistentMaterial = persistentMaterial.filter(m => m.id !== id);
    savePersistentMaterial();
    renderMaterialList();
}

function getPersistentMaterialContext() {
    if (persistentMaterial.length === 0) return '';
    const sections = persistentMaterial.map(m =>
        `--- Material: ${m.name} ---\n${m.content}`
    ).join('\n\n');
    return `\n\n=== UPLOADED COURSE MATERIAL (always reference this when relevant) ===\n${sections}\n=== END OF COURSE MATERIAL ===`;
}

// ====== USER PROFILE / PERSONALIZATION ======
let userProfile = { preferredName: '', customFacts: [] };

function loadUserProfile() {
    try {
        const stored = localStorage.getItem('nova_user_profile');
        if (stored) userProfile = JSON.parse(stored);
    } catch(e) { userProfile = { preferredName: '', customFacts: [] }; }
}

function saveUserProfile() {
    try {
        localStorage.setItem('nova_user_profile', JSON.stringify(userProfile));
    } catch(e) {}
}

// Detect if user is telling Nova their name or a preference, then remember it
function detectAndSavePersonalization(userMessage) {
    const msg = userMessage.trim().toLowerCase();

    // Name correction patterns: "my name is X", "call me X", "I'm X", "it's X not Y"
    const namePatterns = [
        /(?:my name is|call me|i(?:'m| am)|i go by)\s+([a-z][a-z\s'-]{1,30}?)(?:\s*[,.]|$)/i,
        /(?:it'?s|its)\s+([a-z][a-z\s'-]{1,30}?)\s*(?:not|,|$)/i
    ];
    for (const pattern of namePatterns) {
        const match = userMessage.match(pattern);
        if (match) {
            const name = match[1].trim().replace(/\s+/g, ' ');
            // Filter out common false-positives
            const skip = ['a', 'an', 'the', 'not', 'just', 'sir', 'okay', 'fine', 'good', 'here'];
            if (!skip.includes(name.toLowerCase()) && name.length >= 2) {
                userProfile.preferredName = name;
                saveUserProfile();
                console.log('👤 User profile updated - name:', name);
                return;
            }
        }
    }

    // Generic fact: "remember that...", "note that...", "keep in mind..."
    const factMatch = userMessage.match(/(?:remember|note|keep in mind)[:\s]+(.{10,200})/i);
    if (factMatch) {
        const fact = factMatch[1].trim();
        if (!userProfile.customFacts.includes(fact)) {
            userProfile.customFacts.push(fact);
            if (userProfile.customFacts.length > 10) userProfile.customFacts.shift(); // keep last 10
            saveUserProfile();
            console.log('👤 User profile updated - added fact:', fact);
        }
    }
}

function getUserProfileContext() {
    const parts = [];
    if (userProfile.preferredName) {
        parts.push(`The user's name is ${userProfile.preferredName}. Always address them as "${userProfile.preferredName}" (not "sir" or generic terms) unless context makes another address more appropriate.`);
    }
    if (userProfile.customFacts && userProfile.customFacts.length > 0) {
        parts.push(`Remembered user preferences/facts:\n${userProfile.customFacts.map(f => `- ${f}`).join('\n')}`);
    }
    if (parts.length === 0) return '';
    return `\n\n=== USER PROFILE (always honor these) ===\n${parts.join('\n')}\n=== END USER PROFILE ===`;
}
// ====== END USER PROFILE ======

// ====== REAL-TIME CONTEXT (Time & Weather) ======
let realtimeWeather = null;
let weatherLastFetched = 0;
const WEATHER_CACHE_MS = 15 * 60 * 1000; // 15 minutes

function getCurrentTimeString() {
    const now = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} at ${hours12}:${minutes} ${ampm} (${tz})`;
}

const WMO_DESCRIPTIONS = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Foggy',48:'Icy fog',
    51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
    61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
    71:'Slight snow',73:'Moderate snow',75:'Heavy snow',77:'Snow grains',
    80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',
    85:'Slight snow showers',86:'Heavy snow showers',
    95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'
};

async function fetchWeatherData() {
    if (!navigator.geolocation) return;
    if (realtimeWeather && Date.now() - weatherLastFetched < WEATHER_CACHE_MS) return;

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const [weatherRes, geoRes] = await Promise.all([
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`),
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { headers: { 'User-Agent': 'NOVA-AI-Assistant/1.0' } })
                ]);
                const weatherData = await weatherRes.json();
                const geoData = await geoRes.json();

                const addr = geoData.address || {};
                const city = addr.city || addr.town || addr.village || addr.county || 'your area';
                const location = addr.state ? `${city}, ${addr.state}` : city;
                const c = weatherData.current;

                realtimeWeather = {
                    location,
                    temp: Math.round(c.temperature_2m),
                    feelsLike: Math.round(c.apparent_temperature),
                    humidity: c.relative_humidity_2m,
                    windSpeed: Math.round(c.wind_speed_10m),
                    condition: WMO_DESCRIPTIONS[c.weather_code] || 'Unknown conditions'
                };
                weatherLastFetched = Date.now();
                console.log('🌤️ Weather updated:', realtimeWeather);
            } catch (e) {
                console.warn('🌤️ Weather fetch failed:', e.message);
            }
            resolve();
        }, (err) => {
            console.warn('🌤️ Geolocation unavailable:', err.message);
            resolve();
        }, { timeout: 8000, maximumAge: WEATHER_CACHE_MS });
    });
}

function getRealtimeContextString() {
    let ctx = `\n\n=== REAL-TIME CONTEXT ===\nCurrent date/time: ${getCurrentTimeString()}`;
    if (realtimeWeather) {
        ctx += `\nCurrent weather in ${realtimeWeather.location}: ${realtimeWeather.condition}, ${realtimeWeather.temp}°F (feels like ${realtimeWeather.feelsLike}°F), humidity ${realtimeWeather.humidity}%, wind ${realtimeWeather.windSpeed} mph`;
    } else {
        ctx += `\nWeather: Location access not granted — weather unavailable`;
    }
    ctx += `\nIMPORTANT: You have real-time date/time and weather above. Use it naturally. Never claim you lack access to the current time or weather.\n=== END REAL-TIME CONTEXT ===`;
    return ctx;
}
// ====== END REAL-TIME CONTEXT ======

function renderMaterialList() {
    const list = document.getElementById('materialList');
    if (!list) return;
    if (persistentMaterial.length === 0) {
        list.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:0.85rem;padding:0.5rem 0;">No material added yet.</div>';
        return;
    }
    list.innerHTML = persistentMaterial.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.4rem 0.6rem;margin-bottom:0.4rem;background:rgba(0,170,255,0.08);border:1px solid rgba(0,170,255,0.2);border-radius:5px;">
            <span style="color:#00aaff;font-size:0.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;" title="${m.name}">${m.name}</span>
            <button onclick="removePersistentMaterialItem(${m.id})" style="background:none;border:none;color:#ff4444;cursor:pointer;font-size:1rem;padding:0 0.3rem;" title="Remove">✕</button>
        </div>
    `).join('');
}

function handleMaterialFileUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const textTypes = ['txt','md','json','csv','js','py','html','css','java','cpp','c'];
    if (textTypes.includes(ext)) {
        const reader = new FileReader();
        reader.onload = e => {
            addPersistentMaterialItem(file.name, e.target.result);
            showNotification(`Material added: ${file.name}`, 3000);
        };
        reader.readAsText(file);
    } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                addPersistentMaterialItem(file.name, text);
                showNotification(`PDF material added: ${file.name}`, 3000);
            } catch(err) {
                showNotification('PDF parsing failed. Try a text file instead.', 4000);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showNotification('Unsupported file type. Use txt, md, pdf, or code files.', 4000);
    }
}

window.removePersistentMaterialItem = removePersistentMaterialItem;

loadPersistentMaterial();
loadUserProfile();
// ====== END PERSISTENT MATERIAL STORE ======

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
    
    // Add unique ID for message replay/edit functionality
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">${senderName}</span>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">${formatMessageContent(text)}</div>
        ${sender === 'user' ? `<button class="message-edit-btn" onclick="editMessage('${messageId}')" title="Edit and resubmit message"><i class="fas fa-edit"></i></button>` : ''}
        ${sender === 'Nova' ? `<button class="message-replay-btn" onclick="replayMessage('${messageId}')" title="Replay message"><i class="fas fa-microphone"></i></button>` : ''}
    `;
    
    // Store original text and metadata (for replay/edit functionality)
    messageDiv.dataset.messageId = messageId;
    messageDiv.dataset.originalText = text;
    messageDiv.dataset.messageIndex = chatHistory.length; // Position in history for truncation
    
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

// ========================================
// MESSAGE EDITING FUNCTIONS (Conversation Branching)
// ========================================

function editMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const originalText = messageDiv.dataset.originalText;
    const contentDiv = messageDiv.querySelector('.message-content');
    const editBtn = messageDiv.querySelector('.message-edit-btn');
    
    // Replace content with textarea
    contentDiv.innerHTML = `
        <textarea class="message-edit-textarea" style="width: 100%; min-height: 60px; padding: 0.5rem; background: rgba(0, 170, 255, 0.1); border: 1px solid rgba(0, 170, 255, 0.3); border-radius: 5px; color: #00aaff; font-family: inherit; font-size: inherit; resize: vertical;">${originalText}</textarea>
        <div class="edit-controls" style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
            <button class="edit-save-btn" onclick="saveEditedMessage('${messageId}')" style="padding: 0.4rem 0.8rem; background: linear-gradient(135deg, #00aaff, #0077cc); border: none; border-radius: 5px; color: white; cursor: pointer; font-weight: 600;"><i class="fas fa-check"></i> Save & Resubmit</button>
            <button class="edit-cancel-btn" onclick="cancelEdit('${messageId}')" style="padding: 0.4rem 0.8rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 5px; color: white; cursor: pointer;"><i class="fas fa-times"></i> Cancel</button>
        </div>
    `;
    
    // Hide edit button
    if (editBtn) editBtn.style.display = 'none';
    
    // Focus textarea
    const textarea = contentDiv.querySelector('textarea');
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    
    console.log('✏️ Editing message:', messageId);
}

function saveEditedMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const textarea = messageDiv.querySelector('.message-edit-textarea');
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    if (!newText) {
        showNotification('Message cannot be empty', 'error');
        return;
    }
    
    const messageIndex = parseInt(messageDiv.dataset.messageIndex);
    
    console.log('💾 Saving edited message. Index:', messageIndex, 'New text:', newText);
    console.log('📜 Current chat history length:', chatHistory.length);
    console.log('📜 Current conversation history length:', conversationHistory.length);
    
    // Remove all messages after this one in the DOM
    const chatMessages = document.getElementById('chatMessages');
    const allMessages = Array.from(chatMessages.querySelectorAll('.message'));
    allMessages.forEach((msg) => {
        const msgIndex = parseInt(msg.dataset.messageIndex);
        if (msgIndex >= messageIndex) {
            msg.remove();
        }
    });
    
    // Truncate chat history
    chatHistory = chatHistory.slice(0, messageIndex);
    
    // Truncate conversation history (remove all after the user message at this position)
    // Find the corresponding position in conversationHistory
    let conversationIndex = 0;
    let chatCount = 0;
    for (let i = 0; i < conversationHistory.length; i++) {
        if (conversationHistory[i].role === 'user') {
            if (chatCount === messageIndex) {
                conversationIndex = i;
                break;
            }
            chatCount++;
        }
    }
    conversationHistory = conversationHistory.slice(0, conversationIndex);
    
    console.log('✂️ Truncated histories. Chat:', chatHistory.length, 'Conversation:', conversationHistory.length);
    
    // Re-submit the edited message
    processUserMessage(newText);
}

function cancelEdit(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const originalText = messageDiv.dataset.originalText;
    const contentDiv = messageDiv.querySelector('.message-content');
    const editBtn = messageDiv.querySelector('.message-edit-btn');
    
    // Restore original content
    contentDiv.innerHTML = formatMessageContent(originalText);
    
    // Show edit button again
    if (editBtn) editBtn.style.display = '';
    
    console.log('❌ Edit cancelled:', messageId);
}

function processUserMessage(userMessage) {
    console.log('💭 ==========================================');
    console.log('💭 processUserMessage CALLED');
    console.log('💭 Message:', userMessage);
    console.log('💭 Current personality:', currentPersonality);
    console.log('💭 ==========================================');
    
    try {
        // Detect and save any personalization info from the message
        detectAndSavePersonalization(userMessage);
        
        // Add user message to chat
        addMessage(userMessage, 'user');
        
        // Add thinking indicator
        addThinkingIndicator();
        
        // Clear input and reset height
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto'; // Reset to minimum height
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

// Send message with optional file attachment
function sendMessageWithAttachment() {
    const messageInput = document.getElementById('messageInput');
    const userText = messageInput ? messageInput.value.trim() : '';
    
    // Check if there's either text or a file attachment
    if (!userText && !currentFileAttachment) {
        return; // Nothing to send
    }
    
    let finalMessage = userText;
    
    // If there's a file attachment, prepend it to the message
    if (currentFileAttachment) {
        const { name, type, content, extension } = currentFileAttachment;
        
        let fileContent = '';
        switch (type) {
            case 'text':
                fileContent = content.length > 10000 ? content.substring(0, 10000) + '\n\n[Content truncated due to length...]' : content;
                finalMessage = `I've uploaded a text file "${name}". Here is the content:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'pdf':
                fileContent = content.length > 15000 ? content.substring(0, 15000) + '\n\n[Content truncated due to length...]' : content;
                finalMessage = `I've uploaded a PDF document "${name}". Here is the extracted text:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'code':
                fileContent = content.length > 8000 ? content.substring(0, 8000) + '\n\n[Code truncated due to length...]' : content;
                finalMessage = `I've uploaded a code file "${name}" (${extension}). Here is the code:\n\n\`\`\`${extension}\n${fileContent}\n\`\`\`${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'image':
                finalMessage = `I've uploaded an image "${name}".${userText ? ' ' + userText : ' Please acknowledge the image upload.'}`;
                break;
                
            case 'audio':
                finalMessage = `I've uploaded an audio file "${name}".${userText ? ' ' + userText : ' Please acknowledge the audio upload.'}`;
                break;
        }
        
        // Clear the file attachment after using it
        clearFileAttachment();
    }
    
    // Send the message
    if (finalMessage) {
        processUserMessage(finalMessage);
    }
}

// Display file chip in the input area
function displayFileChip(fileName, fileType) {
    // Remove any existing chip
    clearFileChip();
    
    // Create file chip container
    const inputWrapper = document.querySelector('.input-wrapper');
    if (!inputWrapper) return;
    
    const fileChip = document.createElement('div');
    fileChip.className = 'file-chip';
    fileChip.id = 'fileChip';
    
    // Choose icon based on file type
    let icon = 'fa-file';
    switch (fileType) {
        case 'text': icon = 'fa-file-text'; break;
        case 'image': icon = 'fa-image'; break;
        case 'pdf': icon = 'fa-file-pdf'; break;
        case 'code': icon = 'fa-code'; break;
        case 'audio': icon = 'fa-file-audio'; break;
    }
    
    fileChip.innerHTML = `
        <i class="fas ${icon}"></i>
        <span class="file-chip-name">${fileName}</span>
        <button class="file-chip-remove" onclick="clearFileAttachment()" title="Remove file" type="button">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert before the textarea
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        inputWrapper.insertBefore(fileChip, messageInput);
    }
}

// Clear file chip from UI
function clearFileChip() {
    const existingChip = document.getElementById('fileChip');
    if (existingChip) {
        existingChip.remove();
    }
}

// Clear file attachment (called by remove button or after sending)
function clearFileAttachment() {
    currentFileAttachment = null;
    clearFileChip();
    console.log('📎 File attachment cleared');
}

// Make clearFileAttachment globally available for onclick handler
window.clearFileAttachment = clearFileAttachment;

// Try the server-side /api/chat proxy (uses OPENROUTER_API_KEY or OPENAI_API_KEY env variable on Vercel)
async function generateViaServerProxy(userMessage, personality) {
    const messages = prepareOpenAIMessages(userMessage, personality);
    const requestPayload = {
        messages: messages,
        max_tokens: 2048,
        temperature: personality === 'brainstorm' ? 0.95 : 0.7,
        stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Server proxy error (${response.status}): ${errText}`);
    }

    const responseData = await response.json();
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
        throw new Error('Invalid server proxy response format');
    }
    return responseData.choices[0].message.content;
}

// Enhanced AI integration with multi-provider support and improved error handling
async function generateAIResponse(userMessage, personality) {
    console.log('🤖 Generating AI response for personality:', personality);
    
    // Check if user has configured a provider API key
    const hasUserKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') ||
                       (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '');

    // Try server-side proxy first when no user key is configured
    if (!hasUserKey) {
        console.log('🌐 No user API key configured — trying server proxy (/api/chat)...');
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const reply = await generateViaServerProxy(userMessage, personality);
            removeThinkingIndicator();
            addMessage(reply, 'Nova');
            conversationHistory.push({ role: 'assistant', content: reply, personality, timestamp: new Date().toISOString() });
            if (typeof window.speakText === 'function') {
                if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                    window.speakText(reply, () => { window.restoreWakeListeningAfterResponse(); });
                } else {
                    window.speakText(reply, () => {});
                }
            }
            return;
        } catch (proxyErr) {
            console.warn('🌐 Server proxy unavailable:', proxyErr.message);
            // Server proxy failed (likely no env key set) — fall through to show config message
            removeThinkingIndicator();
            addMessage(
                '⚙️ N.O.V.A requires an AI API key to respond. Please click the ⚙️ Settings button and enter your OpenRouter API key (get one free at <a href="https://openrouter.ai/keys" target="_blank" style="color:#FFD700">openrouter.ai/keys</a>).',
                'Nova'
            );
            return;
        }
    }

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
            temperature: personality === 'brainstorm' ? 0.95 : 0.7,
            stream: false
        };
        
        console.log('🤖', currentProvider.toUpperCase(), 'Request:');
        console.log('🔑 Using API Key:', provider.apiKey ? (provider.apiKey.substring(0, 10) + '...' + provider.apiKey.slice(-4)) : 'NONE');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(provider.apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${provider.apiKey}`,
                ...(provider.extraHeaders || {})
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
        
        // AUTO-FALLBACK: If OpenRouter fails and user has an OpenAI key, retry with OpenAI
        const isOpenRouterProvider = currentProvider === 'openrouter';
        const hasOpenAIKey = OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '';
        const isAuthOrQuotaError = error.message.includes('401') || error.message.includes('429') ||
                                   error.message.includes('insufficient_quota') || error.message.includes('billing') ||
                                   error.message.includes('403');

        if (isOpenRouterProvider && hasOpenAIKey && isAuthOrQuotaError && !error.isRetry) {
            console.log('🔄 OpenRouter failed — auto-switching to OpenAI fallback...');
            showNotification('⚠️ OpenRouter unavailable. Switching to OpenAI...', 3000);
            addMessage('🔄 OpenRouter unavailable. Retrying with OpenAI...', 'Nova');
            addThinkingIndicator();
            try {
                const savedProvider = currentProvider;
                currentProvider = 'openai';
                await generateAIResponse(userMessage, personality);
                currentProvider = savedProvider;
                return;
            } catch (openaiErr) {
                console.error('🔧 OpenAI fallback also failed:', openaiErr);
                removeThinkingIndicator();
                addMessage('❌ Both OpenRouter and OpenAI are unavailable. Please check your API keys in Settings.', 'Nova');
                return;
            }
        }
        
        // Remove thinking indicator - wrapped in try-catch to prevent secondary errors
        try {
            removeThinkingIndicator();
        } catch (e) {
            console.error('Error removing thinking indicator:', e);
        }
        
        let errorMsg;
        
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Request timed out - The AI response is taking too long. Please try again.';
        } else if (error.message.includes('insufficient_quota') || error.message.includes('billing')) {
            errorMsg = '💳 API quota exhausted. Please check your OpenRouter or OpenAI account billing.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMsg = '🔑 Invalid API key. Please open Settings and update your OpenRouter or OpenAI key.';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorMsg = '🔧 Server error - The service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            console.error('🔧 Network/Fetch Error Details:', error);
            errorMsg = '🌐 Network error - Check your connection and try again. (Check console for details)';
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

        // Ensure voice listening restarts after AI errors
        // (Quota/network errors can otherwise leave mic/recognition in a non-listening state)
        function restartListeningAfterError() {
            try {
                if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                    console.log('🔊 AI Error: Restoring wake listening after error...');
                    window.restoreWakeListeningAfterResponse();
                    return;
                }

                if (typeof window.startWakeListening === 'function') {
                    console.log('🔊 AI Error: Calling startWakeListening() after error...');
                    window.isWakeListening = true;
                    window.startWakeListening();
                    return;
                }

                if (typeof window.startListeningDirect === 'function') {
                    console.log('🔊 AI Error: Calling startListeningDirect() after error...');
                    window.startListeningDirect();
                    return;
                }

                console.warn('🔊 AI Error: No listening restart method available');
            } catch (e) {
                console.error('🔧 AI Error: Failed to restart listening after error:', e);
            }
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
                    restartListeningAfterError();
                });
            } else {
                window.speakText(errorMsg, () => {
                    console.log('🔊 AI Error: Error message voice output completed (push-to-talk mode)');
                    restartListeningAfterError();
                });
            }

            // Safety fallback in case speech callback doesn't fire
            setTimeout(() => {
                restartListeningAfterError();
            }, 1500);
        } else {
            // No speech synthesis available; still attempt to restore listening
            setTimeout(() => restartListeningAfterError(), 1000);
        }
    }
}


function prepareOpenAIMessages(userMessage, personality) {
    console.log('📝 Preparing messages for OpenAI with personality:', personality);
    
    // Get personality config
    const config = personalities[personality] || personalities.Nova;
    
    // Build personality-specific instructions
    let personalityInstructions = '';
    if (personality === 'study') {
        personalityInstructions = `You are an expert academic assistant specializing in assignment help, homework completion, and study guidance.

Your role:
- Help students understand assignments and break down complex problems
- Provide step-by-step solutions with clear explanations (not just answers)
- For essays/writing: help with outlines, thesis development, argument structure, citations (APA, MLA, Chicago)
- For math/science: show complete working with explanations of each step
- For research: help find relevant angles and organize information
- Create study guides, practice questions, flashcard-style reviews on demand
- When course material is uploaded, reference it directly and prioritize it over general knowledge
- Encourage understanding, not just completion`;
    } else {
        personalityInstructions = `Keep responses natural and conversational. Be helpful and direct - skip unnecessary formality and preamble.

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
- Precise and statistical`;
    }

    // Inject persistent course material, user profile, and real-time data into context
    const materialContext = getPersistentMaterialContext();
    const profileContext = getUserProfileContext();
    const realtimeContext = getRealtimeContextString();

    // System message with personality
    const systemMessage = {
        role: "system",
        content: `You are ${config.name}, a ${config.style}.

${personalityInstructions}${materialContext}${profileContext}${realtimeContext}

SOURCE CITATION RULE:
When your response includes specific facts, statistics, scientific concepts, historical events, or technical claims, add a "Sources & References" section at the very bottom of your response formatted as:

---
**Sources & References**
- [Source name or type, e.g. "General relativity — Einstein, 1915"]
- [Textbook / field, e.g. "Quantum Mechanics — Standard physics curriculum"]

Only include this section when citing factual claims is genuinely useful. For casual conversation or simple questions, omit it. Never fabricate specific URLs or DOIs.`
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

// Auto-resize textarea to fit content
function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight, but respect min and max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 150);
    textarea.style.height = newHeight + 'px';
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
            sendMessageWithAttachment();
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
            settingsModal.classList.add('active');
            renderMaterialList();
        });
    }
    
    if (closeSettings && settingsModal) {
        closeSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
    }

    // Close settings when clicking outside the modal box
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
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
            const name = (materialTextName && materialTextName.value.trim()) || 'Pasted Material';
            if (!content) {
                showNotification('Paste some text first.', 2000);
                return;
            }
            addPersistentMaterialItem(name, content);
            materialTextInput.value = '';
            if (materialTextName) materialTextName.value = '';
            showNotification('Material added!', 2000);
        });
    }

    // Clear all material
    const clearAllMaterialBtn = document.getElementById('clearAllMaterialBtn');
    if (clearAllMaterialBtn) {
        clearAllMaterialBtn.addEventListener('click', () => {
            if (persistentMaterial.length === 0) return;
            if (confirm('Remove all uploaded material?')) {
                persistentMaterial = [];
                savePersistentMaterial();
                renderMaterialList();
                showNotification('All material cleared.', 2000);
            }
        });
    }
    
    // File upload
    const attachBtn = document.getElementById('attachBtn');
    const fileMenu = document.getElementById('fileMenu');
    
    if (attachBtn && fileMenu) {
        console.log('📎 [jarvis_main.js] Attaching event listener to attachBtn');
        
        // Ensure menu starts closed
        fileMenu.classList.remove('active');
        console.log('📎 [jarvis_main.js] Menu initialized as closed');
        
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
                    console.log('📎 [jarvis_main.js] Closing menu (clicked outside)');
                    fileMenu.classList.remove('active');
                }
            }
        });
    } else {
        console.error('📎 [jarvis_main.js] Could not find attachBtn or fileMenu!', {attachBtn, fileMenu});
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
    
    // Initialize core systems
    initializeNova();
    setupEventListeners();
    setupVoiceSettings();
    setupApiKeyManagement();
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

// ========================================
// FILE UPLOAD FUNCTIONALITY
// ========================================

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
    text: 5 * 1024 * 1024,    // 5MB for text files
    image: 10 * 1024 * 1024,  // 10MB for images
    pdf: 20 * 1024 * 1024,    // 20MB for PDFs
    code: 5 * 1024 * 1024,    // 5MB for code files
    audio: 25 * 1024 * 1024   // 25MB for audio files (Whisper API limit)
};

// Setup file upload event listeners
function setupFileUploadListeners() {
    console.log('📎 Setting up file upload listeners...');
    
    // File option buttons
    const fileOptions = document.querySelectorAll('.file-option');
    fileOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const type = option.dataset.type;
            console.log('📎 File option clicked:', type);
            
            const fileInput = document.getElementById(`${type}FileInput`);
            if (fileInput) {
                fileInput.click();
                
                // Close the file menu
                const fileMenu = document.getElementById('fileMenu');
                if (fileMenu) {
                    fileMenu.classList.remove('active');
                }
            } else {
                console.error('📎 File input not found:', `${type}FileInput`);
            }
        });
    });
    
    // File input change listeners
    document.getElementById('textFileInput')?.addEventListener('change', (e) => handleFileUpload(e, 'text'));
    document.getElementById('imageFileInput')?.addEventListener('change', (e) => handleFileUpload(e, 'image'));
    document.getElementById('pdfFileInput')?.addEventListener('change', (e) => handleFileUpload(e, 'pdf'));
    document.getElementById('codeFileInput')?.addEventListener('change', (e) => handleFileUpload(e, 'code'));
    document.getElementById('audioFileInput')?.addEventListener('change', (e) => handleFileUpload(e, 'audio'));
    
    console.log('✅ File upload listeners setup complete');
}

// Handle file upload
async function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📎 File selected:', file.name, '| Type:', type, '| Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Validate file size
    if (file.size > FILE_SIZE_LIMITS[type]) {
        const limitMB = (FILE_SIZE_LIMITS[type] / 1024 / 1024).toFixed(0);
        showNotification(`File too large! Maximum size: ${limitMB}MB`, 5000);
        event.target.value = ''; // Reset input
        return;
    }
    
    // Show loading indicator
    showLoading('Processing file...');
    
    try {
        switch (type) {
            case 'text':
                await handleTextFile(file);
                break;
            case 'image':
                await handleImageFile(file);
                break;
            case 'pdf':
                await handlePDFFile(file);
                break;
            case 'code':
                await handleCodeFile(file);
                break;
            case 'audio':
                await handleAudioFile(file);
                break;
        }
    } catch (error) {
        console.error('📎 Error processing file:', error);
        showNotification('Error processing file: ' + error.message, 5000);
    } finally {
        hideLoading();
        event.target.value = ''; // Reset input for next upload
    }
}

// Handle text file upload
async function handleTextFile(file) {
    const text = await file.text();
    console.log('📄 Text file loaded:', file.name, '| Length:', text.length);
    
    // Store file attachment
    currentFileAttachment = {
        name: file.name,
        type: 'text',
        content: text,
        extension: file.name.split('.').pop()
    };
    
    // Display file chip in input area
    displayFileChip(file.name, 'text');
    
    // Show notification
    showNotification(`Text file "${file.name}" attached. Add a message or send.`, 3000);
}

// Handle image file upload
async function handleImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const imageData = e.target.result;
            console.log('🖼️ Image loaded:', file.name);
            
            // Store file attachment
            currentFileAttachment = {
                name: file.name,
                type: 'image',
                content: imageData,
                extension: file.name.split('.').pop()
            };
            
            // Display file chip in input area
            displayFileChip(file.name, 'image');
            
            // Note: Image analysis would require vision API (GPT-4V, Claude Vision, etc.)
            showNotification(`Image "${file.name}" attached. Add a message or send.`, 3000);
            resolve();
        };
        
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle PDF file upload
async function handlePDFFile(file) {
    console.log('📕 PDF uploaded:', file.name);
    
    try {
        // Check if PDF.js is available
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded. Cannot extract PDF text.');
        }
        
        // Set worker path for PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('📕 PDF loaded. Pages:', pdf.numPages);
        
        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }
        
        console.log('📕 PDF text extracted. Length:', fullText.length, 'characters');
        
        // Store file attachment
        currentFileAttachment = {
            name: file.name,
            type: 'pdf',
            content: fullText,
            extension: 'pdf'
        };
        
        // Display file chip in input area
        displayFileChip(file.name, 'pdf');
        
        showNotification(`PDF "${file.name}" attached (${fullText.length} chars from ${pdf.numPages} pages). Add a message or send.`, 5000);
        
    } catch (error) {
        console.error('📕 PDF processing error:', error);
        
        // Fallback: Add PDF without text extraction
        addFileMessage(file.name, 'pdf', null);
        showNotification('PDF uploaded but text extraction failed: ' + error.message, 5000);
    }
}

// Handle code file upload
async function handleCodeFile(file) {
    const code = await file.text();
    const extension = file.name.split('.').pop();
    console.log('💻 Code file loaded:', file.name, '| Extension:', extension, '| Length:', code.length);
    
    // Store file attachment
    currentFileAttachment = {
        name: file.name,
        type: 'code',
        content: code,
        extension: extension
    };
    
    // Display file chip in input area
    displayFileChip(file.name, 'code');
    
    // Show notification
    showNotification(`Code file "${file.name}" attached. Add a message or send.`, 3000);
}

// Handle audio file upload with transcription
async function handleAudioFile(file) {
    console.log('🎵 Audio file uploaded:', file.name, '| Type:', file.type);
    
    const audioURL = URL.createObjectURL(file);
    
    // Transcribe audio using OpenAI Whisper API
    try {
        showNotification('Transcribing audio... This may take a moment.', 10000);
        const transcription = await transcribeAudio(file);
        
        console.log('🎵 Transcription complete:', transcription.substring(0, 100) + '...');
        
        // Store file attachment with transcription
        currentFileAttachment = {
            name: file.name,
            type: 'audio',
            content: `Audio transcription:\n\n${transcription}`,
            extension: file.name.split('.').pop()
        };
        
        // Display file chip in input area
        displayFileChip(file.name, 'audio');
        
        showNotification(`Audio "${file.name}" transcribed and attached. Add a message or send.`, 5000);
        
    } catch (error) {
        console.error('🎵 Transcription error:', error);
        showNotification('Audio transcription failed: ' + error.message, 5000);
    }
}

// Transcribe audio using OpenAI Whisper API
async function transcribeAudio(audioFile) {
    console.log('🎤 Starting audio transcription...');
    
    // Check if OpenAI API key is available
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        throw new Error('OpenAI API key required for audio transcription. Please add it in Settings.');
    }
    
    // Check file size (Whisper API has 25MB limit)
    const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > MAX_WHISPER_SIZE) {
        const sizeMB = (audioFile.size / 1024 / 1024).toFixed(2);
        throw new Error(
            `Audio file too large (${sizeMB}MB). Whisper API limit is 25MB. ` +
            `Please compress your audio file using a tool like Audacity or online converter, ` +
            `or split it into smaller segments.`
        );
    }
    
    // Create FormData for audio upload
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // English
    formData.append('response_format', 'text');
    
    console.log('🎤 Sending audio to Whisper API...');
    console.log('🎤 File:', audioFile.name, '| Size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 Whisper API error:', response.status, errorText);
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }
    
    const transcription = await response.text();
    console.log('✅ Transcription successful');
    
    return transcription;
}

// Add file message to chat
function addFileMessage(fileName, fileType, fileData, fileExtension = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message file-message';
    
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let filePreview = '';
    
    switch (fileType) {
        case 'text':
            const preview = fileData.length > 500 ? fileData.substring(0, 500) + '...' : fileData;
            filePreview = `
                <div class="file-preview text-preview">
                    <pre>${escapeHtml(preview)}</pre>
                </div>
            `;
            break;
            
        case 'image':
            filePreview = `
                <div class="file-preview image-preview">
                    <img src="${fileData}" alt="${fileName}" style="max-width: 100%; border-radius: 8px;">
                </div>
            `;
            break;
            
        case 'pdf':
            if (fileData && fileData.trim()) {
                const pdfPreview = fileData.length > 1000 ? fileData.substring(0, 1000) + '\n...' : fileData;
                filePreview = `
                    <div class="file-preview pdf-preview">
                        <div class="pdf-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <i class="fas fa-file-pdf" style="font-size: 32px; color: #ff4444;"></i>
                            <span style="color: #ff4444; font-weight: 600;">PDF Document - Text Extracted</span>
                        </div>
                        <div class="pdf-text-preview" style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1rem; max-height: 300px; overflow-y: auto;">
                            <pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; color: rgba(255, 255, 255, 0.9);">${escapeHtml(pdfPreview)}</pre>
                        </div>
                    </div>
                `;
            } else {
                filePreview = `
                    <div class="file-preview pdf-preview">
                        <i class="fas fa-file-pdf" style="font-size: 48px; color: #ff4444;"></i>
                        <p>PDF Document (Text extraction unavailable)</p>
                    </div>
                `;
            }
            break;
            
        case 'code':
            const codePreview = fileData.length > 1000 ? fileData.substring(0, 1000) + '\n...' : fileData;
            filePreview = `
                <div class="file-preview code-preview">
                    <div class="code-header">${fileExtension || 'code'}</div>
                    <pre><code>${escapeHtml(codePreview)}</code></pre>
                </div>
            `;
            break;
            
        case 'audio':
            filePreview = `
                <div class="file-preview audio-preview">
                    <i class="fas fa-file-audio" style="font-size: 32px; color: #00aaff; margin-bottom: 10px;"></i>
                    <audio controls style="width: 100%; max-width: 400px;">
                        <source src="${fileData}" type="audio/mpeg">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            `;
            break;
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">You</span>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">
            <div class="file-attachment">
                <i class="fas fa-paperclip"></i> <strong>${fileName}</strong>
            </div>
            ${filePreview}
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('📎 File message added to chat:', fileName);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format message content with proper line breaks and markdown-style formatting
function formatMessageContent(text) {
    if (!text) return '';
    
    let formatted = text;
    
    // Convert numbered lists with bold formatting (before general bold processing)
    // Match patterns like "**1:" or "**1." followed by content
    formatted = formatted.replace(/\*\*(\d+)[:.]\s*/g, '\n<strong>$1.</strong> ');
    
    // Convert markdown-style bold (**text**) to HTML (non-greedy)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown-style italic (*text* but not **) to HTML
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    
    // Convert markdown-style code (`code`) to HTML
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // Convert bullet points (- item) to proper list format
    formatted = formatted.replace(/^- (.+)$/gm, '• $1');
    
    // Convert double newlines to paragraph breaks
    formatted = formatted.replace(/\n\n/g, '<br><br>');
    
    // Convert single newlines to line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Clean up multiple consecutive <br> tags (more than 2)
    formatted = formatted.replace(/(<br>){3,}/g, '<br><br>');
    
    // Clean up any leading <br> tags
    formatted = formatted.replace(/^(<br>)+/, '');
    
    // Clean up trailing <br> tags
    formatted = formatted.replace(/(<br>)+$/, '');
    
    // Escape any remaining HTML that wasn't converted (for security)
    // We'll use a more targeted approach: escape < and > that aren't part of our allowed tags
    const allowedTags = ['strong', 'em', 'code', 'br'];
    const tagPattern = new RegExp(`<(\\/?)(${ allowedTags.join('|')})>`, 'gi');
    
    // Temporarily replace allowed tags with placeholders
    const placeholders = [];
    formatted = formatted.replace(tagPattern, (match) => {
        placeholders.push(match);
        return `###PLACEHOLDER${placeholders.length - 1}###`;
    });
    
    // Escape remaining HTML
    formatted = formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Restore allowed tags
    formatted = formatted.replace(/###PLACEHOLDER(\d+)###/g, (match, index) => {
        return placeholders[parseInt(index)];
    });
    
    return formatted;
}

// Generate continuation prompt for new chat
function generateContinuationPrompt() {
    if (!chatHistory || chatHistory.length === 0) {
        return 'No conversation history available.';
    }
    
    // Get current chat name
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const currentChat = allChats.find(chat => chat.id === currentChatId);
    const chatName = currentChat?.name || 'Nova Chat';
    
    // Build conversation summary
    let prompt = `Continue this conversation with N.O.V.A:\n\n`;
    prompt += `Chat: ${chatName}\n`;
    prompt += `Personality Mode: ${personalities[currentPersonality]?.name || 'N.O.V.A'}\n`;
    prompt += `Messages: ${chatHistory.length}\n`;
    prompt += `Date: ${new Date().toLocaleString()}\n\n`;
    prompt += `--- CONVERSATION HISTORY ---\n\n`;
    
    // Add last 10 messages (or all if fewer)
    const recentMessages = chatHistory.slice(-10);
    recentMessages.forEach((msg, index) => {
        const sender = msg.sender === 'user' ? 'User' : personalities[msg.personality]?.name || 'N.O.V.A';
        prompt += `[${msg.timestamp}] ${sender}:\n${msg.text}\n\n`;
    });
    
    prompt += `--- END OF HISTORY ---\n\n`;
    prompt += `Please continue this conversation, maintaining the same personality and context.`;
    
    return prompt;
}

// Export chat as downloadable text file
function downloadFullChat() {
    if (!chatHistory || chatHistory.length === 0) {
        showNotification('No chat to export', 2000);
        return;
    }
    
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const currentChat = allChats.find(chat => chat.id === currentChatId);
    const chatName = currentChat?.name || 'Nova Chat';
    
    let content = `N.O.V.A Chat Export\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Chat Name: ${chatName}\n`;
    content += `Personality: ${personalities[currentPersonality]?.name || 'N.O.V.A'}\n`;
    content += `Messages: ${chatHistory.length}\n`;
    content += `Export Date: ${new Date().toLocaleString()}\n\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    chatHistory.forEach(msg => {
        const sender = msg.sender === 'user' ? 'You' : personalities[msg.personality]?.name || 'N.O.V.A';
        content += `[${msg.timestamp}] ${sender}:\n`;
        content += `${msg.text}\n\n`;
        content += `${'-'.repeat(40)}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `nova-chat-${chatName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Chat exported successfully', 2000);
    console.log('📥 Chat exported:', filename);
}

// Copy continuation prompt to clipboard
function copyContinuationPrompt() {
    const promptText = document.getElementById('continuationPrompt');
    if (!promptText) return;
    
    promptText.select();
    promptText.setSelectionRange(0, 99999); // For mobile
    
    navigator.clipboard.writeText(promptText.value).then(() => {
        showNotification('Copied to clipboard!', 2000);
        console.log('📋 Continuation prompt copied');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy. Please copy manually.', 3000);
    });
}

// Open export modal
function openExportModal() {
    if (!chatHistory || chatHistory.length === 0) {
        showNotification('No chat to export', 2000);
        return;
    }
    
    const modal = document.getElementById('exportModal');
    const promptTextarea = document.getElementById('continuationPrompt');
    
    if (modal && promptTextarea) {
        // Generate and populate continuation prompt
        promptTextarea.value = generateContinuationPrompt();
        modal.style.display = 'flex';
    }
}

// Close export modal
function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Replay message (read aloud again)
function replayMessage(messageId) {
    console.log('🔊 Replaying message:', messageId);
    
    // Find message by ID
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) {
        console.error('❌ Message not found:', messageId);
        return;
    }
    
    const originalText = messageDiv.dataset.originalText;
    if (!originalText) {
        console.error('❌ Original text not found for message:', messageId);
        return;
    }
    
    // Use the speakText function if available
    if (typeof window.speakText === 'function') {
        console.log('🔊 Replaying:', originalText.substring(0, 50) + '...');
        window.speakText(originalText);
    } else {
        showNotification('Voice system not available', 2000);
        console.error('❌ speakText function not available');
    }
}

// Show loading overlay
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const loadingText = overlay.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = message;
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========================================
// CHAT HISTORY MANAGEMENT
// ========================================

let currentChatId = null;

// Generate unique chat ID
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save current chat to localStorage
function saveCurrentChat() {
    if (!chatHistory || chatHistory.length === 0) {
        console.log('💾 No chat to save');
        return;
    }
    
    // Create or update current chat session
    if (!currentChatId) {
        currentChatId = generateChatId();
    }
    
    // Get existing chat to preserve custom name if it exists
    const allChatsTemp = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const existingChat = allChatsTemp.find(chat => chat.id === currentChatId);
    
    const chatData = {
        id: currentChatId,
        name: existingChat?.name || `${personalities[currentPersonality]?.name || 'Nova'} Chat`,
        timestamp: Date.now(),
        personality: currentPersonality,
        messages: chatHistory,
        messageCount: chatHistory.length
    };
    
    // Get existing chat history from localStorage
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    
    // Update or add current chat
    const existingIndex = allChats.findIndex(chat => chat.id === currentChatId);
    if (existingIndex >= 0) {
        allChats[existingIndex] = chatData;
    } else {
        allChats.unshift(chatData); // Add to beginning
    }
    
    // Keep only last 50 chats
    if (allChats.length > 50) {
        allChats = allChats.slice(0, 50);
    }
    
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    console.log('💾 Chat saved:', currentChatId, '| Messages:', chatHistory.length);
}

// Auto-save chat periodically
function startAutoSave() {
    setInterval(() => {
        if (chatHistory && chatHistory.length > 0) {
            saveCurrentChat();
        }
    }, 30000); // Save every 30 seconds
}

// Start new chat
function startNewChat() {
    console.log('📝 Starting new chat...');
    
    // Save current chat if it has messages
    if (chatHistory && chatHistory.length > 0) {
        saveCurrentChat();
    }
    
    // Clear current chat
    chatHistory = [];
    conversationHistory = [];
    currentChatId = generateChatId();
    
    // Clear chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Show greeting
    const greeting = currentPersonality === 'Nova' ? getRandomNovaGreeting() : personalities[currentPersonality].greeting;
    addMessage(greeting, 'Nova');
    
    showNotification('New chat started', 2000);
    console.log('✅ New chat created:', currentChatId);
}

// Load chat from history
function loadChat(chatId) {
    console.log('📂 Loading chat:', chatId);
    
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const chat = allChats.find(c => c.id === chatId);
    
    if (!chat) {
        console.error('❌ Chat not found:', chatId);
        return;
    }
    
    // Save current chat before loading new one
    if (chatHistory && chatHistory.length > 0 && currentChatId !== chatId) {
        saveCurrentChat();
    }
    
    // Load chat data
    currentChatId = chat.id;
    chatHistory = chat.messages || [];
    currentPersonality = chat.personality || 'Nova';
    
    // Reconstruct conversation history for AI
    conversationHistory = chatHistory.filter(msg => msg.sender !== 'Nova').map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    
    // Clear and reload chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Reload all messages
    chatHistory.forEach(msg => {
        addMessage(msg.text, msg.sender, msg.timestamp);
    });
    
    // Update personality mode
    selectPersonality(chat.personality || 'Nova');
    
    // Close modal
    closeChatHistoryModal();
    
    showNotification('Chat loaded', 2000);
    console.log('✅ Chat loaded:', chatId, '| Messages:', chatHistory.length);
}

// Rename chat
function renameChat(chatId, event) {
    if (event) {
        event.stopPropagation(); // Prevent loading chat when renaming
    }
    
    console.log('✏️ Renaming chat:', chatId);
    
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const chat = allChats.find(c => c.id === chatId);
    
    if (!chat) {
        console.error('❌ Chat not found:', chatId);
        return;
    }
    
    const currentName = chat.name || 'Nova Chat';
    const newName = prompt('Enter new chat name:', currentName);
    
    if (!newName || newName.trim() === '' || newName === currentName) {
        return; // User cancelled or didn't change name
    }
    
    // Update chat name
    chat.name = newName.trim();
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    
    // Refresh history display
    displayChatHistory();
    
    showNotification('Chat renamed', 2000);
    console.log('✅ Chat renamed to:', newName);
}

// Delete chat from history
function deleteChat(chatId, event) {
    if (event) {
        event.stopPropagation(); // Prevent loading chat when deleting
    }
    
    if (!confirm('Delete this chat permanently?')) {
        return;
    }
    
    console.log('🗑️ Deleting chat:', chatId);
    
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    allChats = allChats.filter(chat => chat.id !== chatId);
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    
    // If deleted chat was current, start new chat
    if (currentChatId === chatId) {
        startNewChat();
    }
    
    // Refresh history display
    displayChatHistory();
    
    showNotification('Chat deleted', 2000);
    console.log('✅ Chat deleted');
}

// Display chat history in modal
function displayChatHistory() {
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const historyList = document.getElementById('chatHistoryList');
    const emptyState = document.getElementById('chatHistoryEmpty');
    
    if (!historyList) return;
    
    if (allChats.length === 0) {
        historyList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    historyList.innerHTML = allChats.map(chat => {
        const date = new Date(chat.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Get first user message as preview
        const firstUserMsg = chat.messages.find(msg => msg.sender === 'user');
        const preview = firstUserMsg ? firstUserMsg.text.substring(0, 100) : 'No messages';
        
        const isCurrent = chat.id === currentChatId;
        
        const chatName = chat.name || `${personalities[chat.personality]?.name || 'N.O.V.A'} Chat`;
        
        return `
            <div class="chat-history-item ${isCurrent ? 'current' : ''}" onclick="loadChat('${chat.id}')" data-chat-id="${chat.id}">
                <div class="chat-history-header">
                    <div class="chat-history-title">
                        ${isCurrent ? '📍 ' : ''}${escapeHtml(chatName)}
                    </div>
                    <div class="chat-history-date">${dateStr}</div>
                </div>
                <div class="chat-history-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</div>
                <div class="chat-history-meta">
                    <span><i class="fas fa-comments"></i> ${chat.messageCount || 0} messages</span>
                    <span><i class="fas fa-robot"></i> ${personalities[chat.personality]?.name || 'N.O.V.A'}</span>
                </div>
                <div class="chat-history-actions">
                    <button class="chat-history-btn rename" onclick="renameChat('${chat.id}', event)" title="Rename Chat">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="chat-history-btn delete" onclick="deleteChat('${chat.id}', event)" title="Delete Chat">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('📚 Displayed', allChats.length, 'chats');
}

// Open chat history modal
function openChatHistoryModal() {
    const modal = document.getElementById('chatHistoryModal');
    if (modal) {
        displayChatHistory();
        modal.style.display = 'flex';
    }
}

// Close chat history modal
function closeChatHistoryModal() {
    const modal = document.getElementById('chatHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Setup chat history event listeners
function setupChatHistoryListeners() {
    console.log('📚 Setting up chat history listeners...');
    
    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }
    
    // Chat history button
    const chatHistoryBtn = document.getElementById('chatHistoryBtn');
    if (chatHistoryBtn) {
        chatHistoryBtn.addEventListener('click', openChatHistoryModal);
    }
    
    // Close chat history modal
    const closeChatHistory = document.getElementById('closeChatHistory');
    if (closeChatHistory) {
        closeChatHistory.addEventListener('click', closeChatHistoryModal);
    }
    
    // Close modal when clicking outside
    const chatHistoryModal = document.getElementById('chatHistoryModal');
    if (chatHistoryModal) {
        chatHistoryModal.addEventListener('click', (e) => {
            if (e.target === chatHistoryModal) {
                closeChatHistoryModal();
            }
        });
    }
    
    // Start auto-save
    startAutoSave();
    
    // Initialize current chat ID
    if (!currentChatId) {
        currentChatId = generateChatId();
    }
    
    console.log('✅ Chat history system initialized');
}

// Export functions globally
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.renameChat = renameChat;
window.replayMessage = replayMessage;
window.editMessage = editMessage;
window.saveEditedMessage = saveEditedMessage;
window.cancelEdit = cancelEdit;
window.copyContinuationPrompt = copyContinuationPrompt;
window.downloadFullChat = downloadFullChat;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;

// Export voice functions globally
window.findBritishVoices = findBritishVoices;
window.showAvailableVoices = showAvailableVoices;
window.testNovaVoice = testNovaVoice;
window.testVoiceByName = testVoiceByName;
window.setNovaVoice = setNovaVoice;

console.log('🌐 Global functions exported for voice integration');