/* ========================================
   ENHANCED AI CHATBOT JAVASCRIPT v3
   - Fixed unique session management
   - Every conversation gets separate history
======================================== */

// Message history storage - Enhanced for unique sessions
let chatHistory = JSON.parse(localStorage.getItem('chatHistory') || '[]');
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let currentSessionId = null;
let messageCount = 0;
let conversationStarted = false; // Track if current conversation has started

// DOM elements
const input = document.querySelector(".chat-input");
const sendBtn = document.querySelector(".send-btn");
const inputContainer = document.querySelector(".input-container");
const fileUploadMenu = document.getElementById('fileUploadMenu');
const fileInput = document.getElementById('fileInput');

// ========================================
// API CONFIGURATION
// ========================================
// IMPORTANT:
// If this page is hosted as static HTML (e.g. Vercel static), '/api/chat' will NOT exist unless you also deploy an API route.
// Set AI3_BACKEND_URL to the real backend URL to avoid 'Network error'.
// - Local: http://127.0.0.1:5001/api/chat
// - Example production backend: https://your-backend-domain.com/api/chat
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '127.0.0.2' || window.location.hostname === '127.0.0.0'
    ? 'http://127.0.0.1:5001/api/chat'
    : (window.AI3_BACKEND_URL || '/api/chat');

// Expose for debugging
window.__AI3_API_URL__ = API_URL;

// ========================================
// AI PERSONALITY SYSTEM
// ========================================

let currentPersonality = 'assistant'; // Default personality

// Define personalities globally to ensure it's accessible everywhere
window.personalities = {
    assistant: {
        name: "🤖 Assistant",
        system: "You are a helpful, friendly AI assistant. Provide clear, accurate, and concise answers. Be conversational but efficient."
    },
    creative: {
        name: "💡 Creative",
        system: "You are a creative, imaginative AI. Use vivid language, metaphors, and think outside the box. Be inspiring and expressive."
    },
    coder: {
        name: "🧑‍💻 Coder",
        system: "You are an expert programming assistant. Provide clear code examples, explain concepts step-by-step, and suggest best practices."
    },
    teacher: {
        name: "🎓 Teacher", 
        system: "You are a patient, encouraging teacher. Break down complex topics into digestible steps, use analogies, and adapt to the student's level."
    },
    funny: {
        name: "🎪 Funny",
        system: "You are a witty, entertaining AI with excellent humor. Use appropriate jokes, clever analogies, and light-hearted responses."
    },
    scholar: {
        name: "📚 Scholar",
        system: "You are a distinguished academic researcher. Provide detailed, well-researched answers with academic depth. Reference relevant theories and studies."
    }
};

// ========================================
// CONVERSATION CONTEXT HELPER FOR OPENAI
// ========================================
const prepareOpenAIMessages = (currentMessage) => {
    // Get recent conversation history (last 10 messages for better context)
    const recentHistory = chatHistory.slice(-10);
    
    // Convert chat history to OpenAI message format
    const messages = recentHistory.map(msg => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.text.replace(/<[^>]*>/g, '').trim() // Clean HTML tags
    }));
    
    // Check if there's uploaded file content to include
    let finalMessage = currentMessage;
    let hasImage = false;
    
    if (window.uploadedFileContent && currentMessage.includes(window.uploadedFileContent.fileName)) {
        // Check if this is an image
        if (window.uploadedFileContent.content === '[IMAGE_MARKER]' && window.uploadedImageData) {
            hasImage = true;
            // For images, we'll format the message differently below
            finalMessage = currentMessage.replace(
                `**📎 ${window.uploadedFileContent.fileName}**`,
                ''
            ).trim();
        } else {
            // For non-image files, include content as text
            finalMessage = currentMessage.replace(
                `**📎 ${window.uploadedFileContent.fileName}**`,
                `**📎 ${window.uploadedFileContent.fileName}** (File Content):\n\n${window.uploadedFileContent.content}`
            );
        }
        
        // Clear the uploaded file content after using it
        window.uploadedFileContent = null;
    }
    
    // Add current user message
    if (hasImage && window.uploadedImageData) {
        // Vision API format with image
        messages.push({
            role: "user",
            content: [
                {
                    type: "text",
                    text: finalMessage || "What's in this image?"
                },
                {
                    type: "image_url",
                    image_url: {
                        url: window.uploadedImageData.base64
                    }
                }
            ]
        });
        
        // Clear image data after using
        window.uploadedImageData = null;
    } else {
        // Regular text message
        messages.push({
            role: "user",
            content: finalMessage
        });
    }
    
    // ALWAYS add system message with current personality (at the beginning)
    messages.unshift({
        role: "system",
        content: window.personalities[currentPersonality].system
    });
    
    return messages;
};

// ========================================
// MAIN MESSAGE HANDLER
// ========================================
const handleMessage = async () => {
    const message = input.value.trim();
    
    if (!message) {
        // Add shake animation to input if empty
        input.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => input.style.animation = '', 500);
        return;
    }
    
    // Initialize session on first message of conversation
    if (!conversationStarted) {
        initializeNewSession();
        conversationStarted = true;
    }
    
    // Add user message
    addMessage(message, true);
    saveToHistory(message, true);
    input.value = "";
    
    // Add typing indicator
    const typingIndicator = createTypingIndicator();
    inputContainer.insertAdjacentElement("beforebegin", typingIndicator);
    
    // Disable input while processing
    setInputState(false);
    
    try {
        // Simulate network delay for better UX (remove in production if API is fast)
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('🚀 Sending request to API...');
        
        // Clean message
        const cleanedMessage = message.trim();
        
        // Prepare OpenAI messages array with conversation history
        let messages;
        try {
            messages = prepareOpenAIMessages(cleanedMessage);
        } catch (error) {
            console.error('🔧 Error preparing messages:', error);
            typingIndicator.remove();
            await addMessage(`⚠️ Error preparing messages: ${error.message} - Please try again.`, false, false, 'error');
            setInputState(true);
            return;
        }
        
        // Check if any message contains an image (vision content)
        const hasVisionContent = messages.some(msg => 
            Array.isArray(msg.content) && 
            msg.content.some(item => item.type === 'image_url')
        );
        
        const requestPayload = {
            model: hasVisionContent ? "gpt-4o" : "gpt-3.5-turbo",
            messages: messages,
            max_tokens: hasVisionContent ? 1000 : 500,
            temperature: 0.7
        };
        
        console.log('🤖 OpenAI Request:');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Response received - Status:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
                console.error('🔧 DEBUG - Raw error response:', errorText);
                
                // Try to parse as JSON for more details
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('🔧 DEBUG - Parsed error JSON:', errorJson);
                } catch (e) {
                    console.error('🔧 DEBUG - Error response is not JSON');
                }
            } catch (e) {
                errorText = 'Unable to read error response';
                console.error('🔧 DEBUG - Could not read error response:', e);
            }
            
            throw new Error(`HTTP ${response.status}: ${response.statusText} | ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('📦 OpenAI Response:', responseData);
        
        // OpenAI response format validation
        if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
            throw new Error('Invalid OpenAI response format');
        }
        
        const reply = responseData.choices[0].message.content;
        
        // Remove typing indicator
        typingIndicator.remove();
        
        // Format and display response
        const formattedText = formatBotResponse(reply);
        
        await addMessage(formattedText, false, true);
        saveToHistory(reply, false);
        
    } catch (error) {
        console.error('🔧 DEBUG - Full error object:', error);
        console.error('🔧 DEBUG - Error message:', error.message);
        console.error('🔧 DEBUG - Error stack:', error.stack);
        
        let errorMsg;
        let shouldRetry = false;
        
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Request timed out - The AI is taking too long to respond. Please try again.';
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorMsg = '🌐 Network error - Check your connection and try again.';
        } else if (error.message.includes('HTTP 429')) {
            errorMsg = '⏱️ Too many requests - Please wait a moment and try again.';
        } else if (error.message.includes('HTTP 500')) {
            errorMsg = '🔧 Server error - The AI service is temporarily unavailable.';
        } else if (error.message.includes('HTTP 400')) {
            console.log('🔄 400 Error detected - attempting retry with simplified message');
            console.log('🔍 Full error message:', error.message);
            shouldRetry = true;
        } else {
            errorMsg = `⚠️ Error: ${error.message} - Please try again.`;
        }
        
        if (shouldRetry) {
            console.log('🔄 Attempting retry with simplified message...');
            
            // Create a much simpler version of the message
            let simplifiedMessage = message;
            
            // Apply specific transformations
            if (message.toLowerCase().includes('python') && (message.toLowerCase().includes('vs') || message.toLowerCase().includes('java'))) {
                simplifiedMessage = 'Tell me about Python and Java programming languages';
            } else if (message.toLowerCase().includes('vs')) {
                simplifiedMessage = message.replace(/\s+vs\s+/gi, ' and ').replace(/compare|comparison|versus/gi, 'tell me about');
            } else {
                simplifiedMessage = message
                    .replace(/compare|comparison|versus|vs|difference|better/gi, 'tell me about')
                    .replace(/[^\w\s]/g, '') // Remove all special characters
                    .replace(/\s+/g, ' ')
                    .trim();
            }
            
            console.log('🔄 Original message:', message);
            console.log('🔄 Simplified message:', simplifiedMessage);
            
            // Try with simplified message
            try {
                const retryController = new AbortController();
                const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
                
                const retryResponse = await fetch("https://backend.fesinstitute.com/api/public/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        message: simplifiedMessage, 
                        uid: "ULeh2kO9bHWVDunMs0hUw1Zl1rR2" 
                    }),
                    signal: retryController.signal
                });
                
                clearTimeout(retryTimeoutId);
                console.log('🔄 Retry response status:', retryResponse.status);
                
                if (retryResponse.ok) {
                    console.log('✅ Retry successful!');
                    const retryData = await retryResponse.json();
                    console.log('🔄 Retry data:', retryData);
                    
                    typingIndicator.remove();
                    
                    if (retryData.reply) {
                        const formattedText = formatBotResponse(retryData.reply);
                        const fullResponse = formattedText + (retryData.imageUrl ? `<img src="${retryData.imageUrl}" alt="Generated image">` : '');
                        
                        await addMessage(fullResponse, false, true);
                        saveToHistory(retryData.reply, false);
                        
                        // Show success notification
                        showNotification('🔄 Rephrased and answered successfully!');
                        
                        // Re-enable input and return (success!)
                        setInputState(true);
                        return;
                    } else {
                        throw new Error('Invalid retry response format');
                    }
                } else {
                    const retryErrorText = await retryResponse.text();
                    console.log('🔄 Retry failed with:', retryResponse.status, retryErrorText);
                    throw new Error(`Retry failed: HTTP ${retryResponse.status} - ${retryErrorText}`);
                }
            } catch (retryError) {
                console.error('🔄 Retry also failed:', retryError);
                typingIndicator.remove();
                
                // Provide specific suggestions based on the original message
                let suggestions = '';
                if (message.toLowerCase().includes('vs') || message.toLowerCase().includes('versus')) {
                    suggestions = '\n\n💡 Try instead:\n• "Tell me about Python programming"\n• "Explain Java programming"\n• "What are Python\'s features?"';
                } else if (message.toLowerCase().includes('compare')) {
                    suggestions = '\n\n💡 Try instead:\n• "What are the benefits of [technology]?"\n• "How does [technology] work?"\n• "Tell me about [topic]"';
                } else {
                    suggestions = '\n\n💡 Try simpler phrasing like:\n• "Tell me about [topic]"\n• "How does [technology] work?"\n• "What is [concept]?"';
                }
                
                errorMsg = '📝 This question format isn\'t supported.' + suggestions;
                await addMessage(errorMsg, false, false, 'error');
            }
        } else {
            typingIndicator.remove();
            await addMessage(errorMsg, false, false, 'error');
        }
    }
    
    // Re-enable input
    setInputState(true);
    scrollToBottom();
};

// ========================================
// MESSAGE DISPLAY FUNCTIONS
// ========================================
const addMessage = async (content, isUser, isHTML = false, type = 'normal') => {
    // Create container div
    const containerDiv = document.createElement('div');
    containerDiv.className = 'message-container';
    
    // Create message div
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : type === 'error' ? 'error-message' : 'bot-message'}`;
    
    if (isHTML) {
        messageDiv.innerHTML = content;
    } else {
        messageDiv.textContent = content;
    }
    
    // Add message to container
    containerDiv.appendChild(messageDiv);
    
    // Insert container before input
    inputContainer.insertAdjacentElement("beforebegin", containerDiv);
    
    // Add entrance animation
    containerDiv.style.opacity = '0';
    containerDiv.style.transform = 'translateY(20px) scale(0.95)';
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    containerDiv.style.transition = 'all 0.4s ease-out';
    containerDiv.style.opacity = '1';
    containerDiv.style.transform = 'translateY(0) scale(1)';
    
    messageCount++;
    return messageDiv;
};

const createTypingIndicator = () => {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
        <div class="typing-dots">
            <span></span><span></span><span></span>
        </div>
    `;
    return indicator;
};

const formatBotResponse = (text) => {
    return text
        .replace(/###\s+(.*)/g, "<h3>$1</h3>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/^\s*-\s+(.+)/gm, "<li>$1</li>")
        .replace(/^\s*\d+\.\s+(.+)/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
        .replace(/<\/ul>\s*<ul>/g, ""); // Merge consecutive lists
};

// ========================================
// UTILITY FUNCTIONS
// ========================================
const setInputState = (enabled) => {
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
    if (enabled) {
        input.focus();
    }
};

const scrollToBottom = () => {
    setTimeout(() => {
        window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth'
        });
    }, 100);
};

const saveToHistory = (message, isUser) => {
    // Use the enhanced save function
    saveToHistoryEnhanced(message, isUser);
};

// ========================================
// UNIQUE SESSION MANAGEMENT (FIXED!)
// ========================================

// Initialize new unique session - NO DATE MERGING!
const initializeNewSession = () => {
    currentSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('🆕 New unique chat session created:', currentSessionId);
    
    // Show session separator if there are existing messages
    if (document.querySelectorAll('.message-container, .message').length > 0) {
        addSessionSeparator();
    }
};

const addSessionSeparator = () => {
    const separator = document.createElement('div');
    separator.className = 'session-separator';
    separator.innerHTML = '<span>✨ New Conversation</span>';
    inputContainer.insertAdjacentElement("beforebegin", separator);
};

// Save current session - ALWAYS CREATE NEW, NEVER MERGE!
const saveCurrentSession = () => {
    if (chatHistory.length === 0 || !currentSessionId) return;
    
    const now = new Date();
    const sessionDate = now.toLocaleDateString();
    const sessionTime = now.toLocaleTimeString();
    
    // Find if this exact session ID already exists (for updates)
    let existingSessionIndex = chatSessions.findIndex(session => 
        session.id === currentSessionId // Only match by session ID, not date!
    );
    
    const sessionData = {
        id: currentSessionId,
        date: sessionDate,
        time: sessionTime,
        messages: [...chatHistory],
        messageCount: chatHistory.length,
        lastUpdated: Date.now()
    };
    
    if (existingSessionIndex >= 0) {
        // Update existing session (same conversation continuing)
        chatSessions[existingSessionIndex] = sessionData;
        console.log('📝 Updated session:', currentSessionId);
    } else {
        // Create new session entry
        chatSessions.unshift(sessionData);
        console.log('💾 New session saved:', currentSessionId);
    }
    
    // Limit to 100 sessions max
    if (chatSessions.length > 100) {
        chatSessions = chatSessions.slice(0, 100);
    }
    
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    console.log('💾 Session saved:', sessionDate, sessionTime, '(', chatHistory.length, 'messages)');
};

const saveToHistoryEnhanced = (message, isUser) => {
    // Ensure we have a session
    if (!currentSessionId) {
        initializeNewSession();
    }
    
    chatHistory.push({
        text: message,
        timestamp: Date.now(),
        isUser: isUser,
        id: messageCount,
        sessionId: currentSessionId
    });
    
    // Limit current session to 100 messages
    if (chatHistory.length > 100) {
        chatHistory = chatHistory.slice(-100);
    }
    
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // Auto-save session after each message
    saveCurrentSession();
};

// ========================================
// NEW CHAT FUNCTIONALITY
// ========================================

const startNewChat = () => {
    // Save current session before starting new one
    if (chatHistory.length > 0) {
        saveCurrentSession();
    }

    // Clear localStorage for current session
    localStorage.removeItem('chatHistory');

    // Reload page to fully reset state/UI
    location.reload();
};

const clearCurrentChat = () => {
    if (chatHistory.length === 0) {
        showNotification('ℹ️ No messages to clear!');
        return;
    }
    
    if (confirm('🗑️ Clear current conversation? (This will not affect your saved history)')) {
        // Clear current conversation only
        chatHistory = [];
        messageCount = 0;
        conversationStarted = false;
        
        // Clear visual messages
        const messages = document.querySelectorAll('.message-container, .message, .session-separator');
        messages.forEach(msg => msg.remove());
        
        // Clear localStorage
        localStorage.removeItem('chatHistory');
        
        showNotification('🗑️ Current conversation cleared!');
        console.log('🗑️ Current chat cleared');
        
        input.focus();
    }
};

// ========================================
// CHAT MANAGEMENT FUNCTIONS
// ========================================
const exportChat = () => {
    if (chatHistory.length === 0) {
        showNotification('ℹ️ No messages to export!');
        return;
    }
    
    const timestamp = new Date().toLocaleString();
    const chatText = `AI Chat Export v3 - ${timestamp}\n` + '='.repeat(50) + '\n\n' +
        chatHistory.map(msg => {
            const time = new Date(msg.timestamp).toLocaleTimeString();
            const sender = msg.isUser ? 'You' : 'AI Bot';
            return `[${time}] ${sender}: ${msg.text.replace(/<[^>]*>/g, '')}`;
        }).join('\n\n') +
        `\n\n${'='.repeat(50)}\nExported: ${timestamp}\nTotal Messages: ${chatHistory.length}\nSession ID: ${currentSessionId}`;
    
    const blob = new Blob([chatText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-chat-v3-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Success feedback
    showNotification('💾 Chat exported successfully!');
};

// Toggle history modal
const toggleHistory = () => {
    const modal = document.getElementById('historyModal');
    const isVisible = modal.classList.contains('show');
    
    if (isVisible) {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    } else {
        loadHistoryList();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    }
};

// Load and display history list
const loadHistoryList = () => {
    const historyList = document.getElementById('historyList');
    
    if (chatSessions.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <div class="empty-history-icon">📋</div>
                <div>No chat history yet</div>
                <div style="font-size: 14px; color: #999; margin-top: 8px;">
                    Start conversations and each will be saved as a unique entry
                </div>
            </div>
        `;
        return;
    }
    
    // Sort by most recent update (fallback to timestamp derived from id if missing)
    const sorted = [...chatSessions].sort((a, b) => {
        const aTime = a.lastUpdated || (a.id?.split('_')[1] ? Number(a.id.split('_')[1]) : 0);
        const bTime = b.lastUpdated || (b.id?.split('_')[1] ? Number(b.id.split('_')[1]) : 0);
        return bTime - aTime;
    });

    historyList.innerHTML = sorted.map((session) => {
        const firstUserMessage = session.messages.find(msg => msg.isUser);
        const rawTitle = firstUserMessage
            ? firstUserMessage.text.replace(/<[^>]*>/g, '').trim()
            : '';
        const title = rawTitle
            ? (rawTitle.length > 60 ? rawTitle.slice(0, 60) + '…' : rawTitle)
            : 'New chat';
        const preview = firstUserMessage
            ? firstUserMessage.text.substring(0, 80) + (firstUserMessage.text.length > 80 ? '...' : '')
            : 'Chat session';
        const headerText = `${title} — ${session.date} ${session.time}`;
        
        return `
            <div class="history-session" onclick="loadChatSession('${session.id}')">
                <div class="session-header">
                    <div class="session-title">${headerText}</div>
                    <div style="display: flex; align-items: center;">
                        <div class="session-count">${session.messageCount} messages</div>
                        <button class="delete-session-btn" onclick="deleteChatSession('${session.id}', event)" title="Delete this chat">
                            ×
                        </button>
                    </div>
                </div>
                <div class="session-preview">${preview}</div>
            </div>
        `;
    }).join('');
};

// Load a specific chat session
const loadChatSession = (sessionId) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) {
        showNotification('❌ Session not found!');
        return;
    }
    
    // Save current session before loading another
    if (chatHistory.length > 0 && currentSessionId !== sessionId) {
        saveCurrentSession();
    }
    
    // Clear current messages
    const messages = document.querySelectorAll('.message-container, .message, .session-separator');
    messages.forEach(msg => msg.remove());
    
    // Load session data
    chatHistory = [...session.messages];
    currentSessionId = sessionId;
    conversationStarted = true;
    messageCount = chatHistory.length;
    
    // Display messages
    session.messages.forEach(async (msg, index) => {
        await new Promise(resolve => setTimeout(resolve, index * 100)); // Stagger display
        addMessage(msg.text, msg.isUser, false);
    });
    
    // Save to current storage
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
    
    // Close history modal
    toggleHistory();
    
    showNotification(`📂 Loaded session from ${session.date} ${session.time}`);
    console.log('📂 Loaded session:', sessionId);
};

// Delete a specific chat session
const deleteChatSession = (sessionId, event) => {
    // Prevent triggering the session load click
    event.stopPropagation();
    
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) {
        showNotification('❌ Session not found!');
        return;
    }
    
    // Confirm deletion
    const confirmMessage = `Delete chat from ${session.date} ${session.time}?\n(${session.messageCount} messages)`;
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // Remove from sessions array
    chatSessions = chatSessions.filter(s => s.id !== sessionId);
    
    // Update localStorage
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
    
    // If deleting current session, clear current chat
    if (currentSessionId === sessionId) {
        chatHistory = [];
        currentSessionId = null;
        conversationStarted = false;
        messageCount = 0;
        localStorage.removeItem('chatHistory');
        
        // Clear visual messages
        const messages = document.querySelectorAll('.message-container, .message, .session-separator');
        messages.forEach(msg => msg.remove());
    }
    
    // Refresh history display
    loadHistoryList();
    
    showNotification(`🗑️ Deleted chat from ${session.date} ${session.time}`);
    console.log('🗑️ Deleted session:', sessionId);
};

// ========================================
// CHARACTER COUNTER & INPUT VALIDATION
// ========================================

// No character limit - OpenAI can handle much longer messages

const updateCharCounter = () => {
    const length = input.value.length;
    
    // Only disable send button if input is empty
    sendBtn.disabled = length === 0;
    sendBtn.style.opacity = length === 0 ? '0.5' : '1';
};

// ========================================
// NOTIFICATION SYSTEM
// ========================================

const showNotification = (message, duration = 3000) => {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);
    
    // Hide notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 400);
    }, duration);
};

// ========================================
// EVENT LISTENERS
// ========================================

// Send button click
sendBtn.addEventListener("click", handleMessage);

// Enter key press (Enter to send, Shift+Enter for newline)
input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !sendBtn.disabled) {
        e.preventDefault();
        handleMessage();
    }
});

// Character counter
input.addEventListener("input", updateCharCounter);

// Close history on escape
// Also close help on Escape
// Toggle dark theme with Ctrl/Cmd + J
// (kept minimal to avoid conflicts)
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const modal = document.getElementById('historyModal');
        if (modal.classList.contains('show')) toggleHistory();
        const help = document.getElementById('personalityHelp');
        if (help.classList.contains('show')) togglePersonalityHelp(e);
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        toggleTheme();
    }
});

// Close history when clicking outside
document.getElementById('historyModal').addEventListener('click', (e) => {
    if (e.target.id === 'historyModal') {
        toggleHistory();
    }
});

// ========================================
// PERSONALITY SWITCHING FUNCTIONALITY
// ========================================

const switchPersonality = (personality) => {
    console.log('🔧 switchPersonality called with:', personality);
    
    // Validate personality exists
    if (!window.personalities[personality]) {
        console.error('🔧 Invalid personality:', personality);
        return;
    }
    
    // Update current personality
    currentPersonality = personality;
    console.log('🔧 Current personality set to:', currentPersonality);
    
    // Update UI - remove selected class from all options
    document.querySelectorAll('.personality-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    const selectedOption = document.querySelector(`[data-personality="${personality}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
        console.log('🔧 Added selected class to:', personality);
    } else {
        console.error('🔧 Could not find option for personality:', personality);
    }
    
    // Show notification with personality switch
    const personalityName = window.personalities[personality].name;
    showNotification(`🎭 Switched to ${personalityName} mode!`, 2500);
    
    console.log('🎭 Personality switched to:', personality);
    console.log('🎯 System message:', window.personalities[personality].system);
};

// ========================================
// THEME & HELP TOGGLES
// ========================================

function toggleTheme() {
    const dark = document.body.classList.toggle('dark');
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch {}
    const btn = document.querySelector('.theme-toggle');
    if (btn) btn.textContent = dark ? '💡 Turn on the lights' : '💡 Turn off the lights';
}

function applyStoredTheme() {
    try {
        const stored = localStorage.getItem('theme');
        if (stored === 'dark') {
            document.body.classList.add('dark');
            const btn = document.querySelector('.theme-toggle');
            if (btn) btn.textContent = '💡 Turn on the lights';
        }
    } catch {}
}

function togglePersonalityHelp(event) {
    if (event) event.stopPropagation();
    const modal = document.getElementById('personalityHelp');
    const showing = !modal.classList.contains('show');
    if (showing) {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('show'), 10);
    } else {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
    }
}

document.addEventListener('click', (e) => {
    const modal = document.getElementById('personalityHelp');
    if (!modal) return;
    if (modal.classList.contains('show') && e.target.id === 'personalityHelp') {
        togglePersonalityHelp(e);
    }
});

// ========================================
// INITIALIZATION
// ========================================

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('🔧 DOM Content Loaded - Initializing...');
    applyStoredTheme();
    updateCharCounter();
    input.focus();
    
    // Debug: Check if personality options exist
    const personalityOptions = document.querySelectorAll('.personality-option');
    console.log('🔧 Found personality options:', personalityOptions.length);
    
    // Add click listeners to all personality options (after DOM is ready)
    personalityOptions.forEach((option, index) => {
        console.log(`🔧 Adding listener to option ${index}:`, option.getAttribute('data-personality'));
        option.addEventListener('click', (e) => {
            console.log('🔧 Personality clicked:', e.target);
            const personality = option.getAttribute('data-personality');
            console.log('🔧 Personality value:', personality);
            switchPersonality(personality);
        });
    });
    
    // Show welcome message for new users
    if (chatSessions.length === 0 && chatHistory.length === 0) {
        setTimeout(() => {
            showNotification('👋 Welcome! Each conversation will be saved as a unique session.');
        }, 1000);
    }
    
    console.log('🚀 AI Chat Bot v3 initialized - Unique session management enabled!');
});

// Load current conversation if exists
if (chatHistory.length > 0) {
    conversationStarted = true;
    messageCount = chatHistory.length;
    
    // Re-display messages
    chatHistory.forEach((msg, index) => {
        setTimeout(() => {
            addMessage(msg.text, msg.isUser, false);
        }, index * 50);
    });
}

// ========================================
// FILE UPLOAD SYSTEM
// ========================================

let currentUploadType = '';

function showFileUploadMenu(event) {
    const button = event.target.closest('.upload-btn');
    const rect = button.getBoundingClientRect();
    
    // Position the menu above the button
    fileUploadMenu.style.display = 'block';
    fileUploadMenu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    fileUploadMenu.style.left = `${rect.left}px`;
    fileUploadMenu.style.top = 'auto';
}

function uploadFile(type) {
    currentUploadType = type;
    const input = document.createElement('input');
    input.type = 'file';
    
    // Set file type restrictions
    switch(type) {
        case 'pdf':
            input.accept = '.pdf,.doc,.docx,.pptx';
            break;
        case 'csv':
            input.accept = '.csv,.xlsx,.xls';
            break;
        case 'txt':
            input.accept = '.txt';
            break;
        case 'audio':
            input.accept = '.m4a,.mp3,.wav,.webm,.mp4,.mpeg';
            break;
        case 'image':
            input.accept = '.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg';
            break;
        default:
            input.accept = '*/*';
    }
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            await processUploadedFile(file);
        }
    };
    
    input.click();
    fileUploadMenu.style.display = 'none';
}

async function processUploadedFile(file) {
    try {
        // Show processing indicator
        showFileProcessingIndicator(file.name);
        
        let content = '';
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        const isAudioFile = ['m4a', 'mp3', 'wav', 'webm', 'mp4', 'mpeg'].includes(fileExtension);
        const isImageFile = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension);
        
        switch(fileExtension) {
            case 'pdf':
                content = await extractPDFContent(file);
                break;
            case 'docx':
            case 'doc':
                content = await extractDOCXContent(file);
                break;
            case 'pptx':
                content = await extractPPTXContent(file);
                break;
            case 'csv':
            case 'xlsx':
            case 'xls':
                content = await extractExcelContent(file);
                break;
            case 'txt':
                content = await extractTextContent(file);
                break;
            case 'm4a':
            case 'mp3':
            case 'wav':
            case 'webm':
            case 'mp4':
            case 'mpeg':
                content = await extractAudioContent(file);
                break;
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
            case 'bmp':
            case 'webp':
            case 'svg':
                content = await extractImageContent(file);
                break;
            default:
                throw new Error(`Unsupported file type: ${fileExtension}`);
        }
        
        if (content.trim()) {
            hideFileProcessingIndicator();
            
            if (isAudioFile) {
                // For audio files: Auto-teach the lecture content
                await autoTeachLecture(fileName, content);
            } else {
                // For other files: Store content for user to ask about
                window.uploadedFileContent = {
                    fileName: fileName,
                    content: content
                };
                
                const mainInput = document.querySelector(".chat-input");
                mainInput.value += `**📎 ${fileName}**\n`;
                updateCharCounter();
                
                if (isImageFile) {
                    showNotification(`✅ Image "${fileName}" uploaded! Ask me about it.`, 3000);
                } else {
                    showNotification(`✅ File "${fileName}" processed successfully!`, 3000);
                }
            }
        } else {
            throw new Error('No readable content found in file');
        }
        
    } catch (error) {
        hideFileProcessingIndicator();
        showNotification(`❌ Error processing file: ${error.message}`, 5000);
        console.error('File processing error:', error);
    }
}

// Auto-teach lecture content after transcription
async function autoTeachLecture(fileName, transcriptContent) {
    try {
        // Initialize session if not started
        if (!conversationStarted) {
            initializeNewSession();
            conversationStarted = true;
        }
        
        // Show the transcript in chat
        const transcriptPreview = transcriptContent.length > 500 
            ? transcriptContent.substring(0, 500) + '...\n\n[Full transcript available for analysis]'
            : transcriptContent;
        
        await addMessage(`📎 **${fileName}** (Transcribed)\n\n${transcriptPreview}`, true);
        saveToHistory(`Uploaded audio: ${fileName}`, true);
        
        showNotification('🎓 AI is now analyzing and teaching the lecture...', 3000);
        
        // Add typing indicator
        const typingIndicator = createTypingIndicator();
        inputContainer.insertAdjacentElement("beforebegin", typingIndicator);
        
        // Disable input while processing
        setInputState(false);
        
        // Prepare teaching prompt
        const teachingPrompt = `I've transcribed a lecture recording. Please analyze this lecture and provide a comprehensive explanation:

${transcriptContent}

Please:
1. Provide a clear summary of the main topics covered
2. Explain the key concepts in detail
3. Highlight important points and takeaways
4. Organize the information in a structured, easy-to-understand way
5. Add any relevant examples or clarifications that would help understanding

Teach this material as if you're helping a student learn the content.`;

        // Prepare messages for OpenAI
        const messages = [
            {
                role: "system",
                content: window.personalities[currentPersonality].system + " You are now analyzing a lecture transcript and teaching the content to help the student understand the material thoroughly."
            },
            {
                role: "user",
                content: teachingPrompt
            }
        ];
        
        // Call OpenAI API
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: messages,
                max_tokens: 2000,
                temperature: 0.7
            })
        });
        
        if (!response.ok) {
            throw new Error(`AI response failed: ${response.status}`);
        }
        
        const responseData = await response.json();
        const reply = responseData.choices[0].message.content;
        
        // Remove typing indicator
        typingIndicator.remove();
        
        // Format and display response
        const formattedText = formatBotResponse(reply);
        await addMessage(formattedText, false, true);
        saveToHistory(reply, false);
        
        // Store transcript for follow-up questions
        window.uploadedFileContent = {
            fileName: fileName,
            content: transcriptContent
        };
        
        showNotification('✅ Lecture analysis complete! Ask follow-up questions anytime.', 4000);
        
    } catch (error) {
        console.error('🔧 Auto-teach error:', error);
        showNotification(`❌ Error teaching lecture: ${error.message}`, 5000);
    } finally {
        setInputState(true);
        scrollToBottom();
    }
}

// File content extraction functions
async function extractPDFContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }
                
                resolve(fullText);
            } catch (error) {
                reject(new Error(`PDF parsing failed: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractDOCXContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                const result = await mammoth.extractRawText({arrayBuffer});
                resolve(result.value);
            } catch (error) {
                reject(new Error(`DOCX parsing failed: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read DOCX file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractPPTXContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;
                const workbook = XLSX.read(arrayBuffer, {type: 'array'});
                let content = '';
                
                // Try to extract text from PPTX (basic extraction)
                workbook.SheetNames.forEach(sheetName => {
                    const sheet = workbook.Sheets[sheetName];
                    const sheetData = XLSX.utils.sheet_to_json(sheet, {header: 1});
                    sheetData.forEach(row => {
                        if (Array.isArray(row)) {
                            content += row.join(' ') + '\n';
                        }
                    });
                });
                
                resolve(content || 'PowerPoint file processed (limited text extraction available)');
            } catch (error) {
                reject(new Error(`PPTX parsing failed: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read PPTX file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractExcelContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                let content = '';
                
                workbook.SheetNames.forEach(sheetName => {
                    content += `Sheet: ${sheetName}\n`;
                    const sheet = workbook.Sheets[sheetName];
                    const csvOutput = XLSX.utils.sheet_to_csv(sheet);
                    content += csvOutput + '\n\n';
                });
                
                resolve(content);
            } catch (error) {
                reject(new Error(`Excel/CSV parsing failed: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read Excel/CSV file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractTextContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            resolve(e.target.result);
        };
        reader.onerror = () => reject(new Error('Failed to read text file'));
        reader.readAsText(file);
    });
}

async function extractImageContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Image = e.target.result;
            // Store image separately for vision API
            window.uploadedImageData = {
                fileName: file.name,
                base64: base64Image,
                mimeType: file.type || 'image/png'
            };
            // Return a simple marker instead of the full base64
            resolve(`[IMAGE_MARKER]`);
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}

async function extractAudioContent(file) {
    try {
        const maxSize = 25 * 1024 * 1024;
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        
        if (file.size > maxSize) {
            throw new Error(`Audio file too large (${fileSizeMB} MB). Whisper API limit is 25 MB.\n\n💡 Solutions:\n1. Compress the audio file (reduce bitrate/quality)\n2. Split into smaller segments\n3. Use a video/audio editor to reduce file size\n\nRecommended tools: HandBrake, Audacity, or online audio compressors`);
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', 'whisper-1');
        
        console.log(`🎤 Sending audio (${fileSizeMB} MB) to Whisper API for transcription...`);
        showNotification(`🎤 Transcribing audio (${fileSizeMB} MB)... This may take a moment.`);
        
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: formData
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('🔧 Whisper API error:', errorText);
            throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ Transcription complete:', result);
        
        if (result.text) {
            return `[Audio Transcription]\n\n${result.text}`;
        } else {
            throw new Error('No transcription text returned');
        }
        
    } catch (error) {
        console.error('🔧 Audio extraction error:', error);
        throw new Error(`Audio transcription failed: ${error.message}`);
    }
}

// File processing UI indicators
function showFileProcessingIndicator(fileName) {
    const indicator = document.createElement('div');
    indicator.id = 'fileProcessingIndicator';
    indicator.className = 'file-processing-indicator';
    indicator.innerHTML = `
        <div class="processing-content">
            <div class="processing-spinner"></div>
            <span>Processing "${fileName}"...</span>
        </div>
    `;
    inputContainer.insertAdjacentElement("beforebegin", indicator);
}

function hideFileProcessingIndicator() {
    const indicator = document.getElementById('fileProcessingIndicator');
    if (indicator) {
        indicator.remove();
    }
}

// Close file upload menu when clicking outside
document.addEventListener('click', function(event) {
    if (!event.target.closest('.upload-btn') && !event.target.closest('.file-upload-menu')) {
        fileUploadMenu.style.display = 'none';
    }
});