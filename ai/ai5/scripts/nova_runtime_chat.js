// Runtime chat history + export module
// Extracted from nova_runtime_features.js.

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
        window.speakText(originalText, null, messageDiv.dataset.sender === 'Avon' ? 'other' : 'nova');
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

// Use var here to avoid temporal-dead-zone errors if handlers run while script is still initializing.
var currentChatId = null;

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
    
    const normalizedPersonality = normalizePersonalityKey(currentPersonality);
    currentPersonality = normalizedPersonality;

    const defaultChatName = `${personalities[normalizedPersonality]?.name || 'Nova'} Chat`;
    const chatData = {
        id: currentChatId,
        name: existingChat?.name || defaultChatName,
        titled: Boolean(existingChat?.titled),
        nameLocked: Boolean(existingChat?.nameLocked),
        timestamp: Date.now(),
        personality: normalizedPersonality,
        messages: chatHistory,
        messageCount: chatHistory.length,
        files: Array.isArray(currentChatFiles) ? currentChatFiles : []
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
    maybeGenerateChatTitle(chatData);
}

// AI-generated chat names: replace the default "<Mode> Chat" name once there is a real exchange to summarize.
var chatTitleAttempts = {};
var chatTitleInFlight = new Set();

function isDefaultChatName(name) {
    return !name || /^[\w .\-]+ Chat$/.test(String(name).trim());
}

function maybeGenerateChatTitle(chat) {
    if (!chat || chat.titled || chat.nameLocked || !isDefaultChatName(chat.name)) return;
    if (chatTitleInFlight.has(chat.id) || (chatTitleAttempts[chat.id] || 0) >= 3) return;
    const messages = (chat.messages || []).filter(m => m && m.text && (m.sender === 'user' || m.sender === 'Nova' || m.sender === 'Avon'));
    if (!messages.some(m => m.sender === 'user') || !messages.some(m => m.sender !== 'user' && !/^Greetings|^Good day|^Hello/i.test(m.text))) return;

    chatTitleInFlight.add(chat.id);
    chatTitleAttempts[chat.id] = (chatTitleAttempts[chat.id] || 0) + 1;
    generateChatTitle(messages).then(title => {
        if (!title) return;
        const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
        const stored = allChats.find(c => c.id === chat.id);
        if (!stored || stored.nameLocked) return;
        stored.name = title;
        stored.titled = true;
        localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
        try { displayChatHistory(); } catch (e) { /* history modal not ready */ }
    }).catch(error => {
        console.warn('Chat title generation failed:', error);
    }).finally(() => chatTitleInFlight.delete(chat.id));
}

async function generateChatTitle(messages) {
    const transcript = messages.slice(0, 8).map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${String(m.text).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)}`).join('\n');
    const requestMessages = [
        { role: 'system', content: 'You name chat conversations. Reply with only a short, specific title of 2 to 5 words that captures the main topic. No quotes, no trailing punctuation, no prefixes like "Title:".' },
        { role: 'user', content: `Conversation:\n${transcript}\n\nTitle:` }
    ];
    const hasUserKey = (typeof OPENROUTER_API_KEY !== 'undefined' && String(OPENROUTER_API_KEY || '').trim()) ||
        (typeof OPENAI_API_KEY !== 'undefined' && String(OPENAI_API_KEY || '').trim());
    const provider = hasUserKey ? providerConfig[currentProvider] : null;
    const headers = { 'Content-Type': 'application/json' };
    if (provider) {
        headers.Authorization = 'Bearer ' + provider.apiKey;
        Object.assign(headers, provider.extraHeaders || {});
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    let data;
    try {
        const response = await fetch(provider ? provider.apiUrl : '/api/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: provider ? provider.model : currentModel,
                messages: requestMessages,
                max_tokens: 24,
                temperature: 0.3,
                stream: false
            }),
            signal: controller.signal
        });
        if (!response.ok) throw new Error(`Title request failed (${response.status})`);
        data = await response.json();
    } finally {
        clearTimeout(timeoutId);
    }
    const raw = data?.choices?.[0]?.message?.content;
    const text = Array.isArray(raw) ? raw.map(part => part?.text || '').join('') : String(raw || '');
    const title = text.split('\n')[0]
        .replace(/^["'“”‘’*#\s]+/, '')
        .replace(/^title\s*:\s*/i, '')
        .replace(/^["'“”‘’*#\s]+|["'“”‘’*#.!?:;,\s]+$/g, '')
        .trim()
        .slice(0, 60);
    return title.length >= 2 ? title : null;
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
    currentChatFiles = [];
    conversationHistory = [];
    currentChatId = generateChatId();
    
    // Clear chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Show greeting
    const normalizedPersonality = normalizePersonalityKey(currentPersonality);
    const personalityConfig = personalities[normalizedPersonality] || personalities.Nova;
    currentPersonality = normalizedPersonality;
    const greeting = normalizedPersonality === 'Nova' ? getRandomNovaGreeting() : personalityConfig.greeting;
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
    currentChatFiles = Array.isArray(chat.files) ? chat.files : [];
    currentPersonality = normalizePersonalityKey(chat.personality || 'Nova');
    
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
    selectPersonality(currentPersonality);
    
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
    chat.nameLocked = true;
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
        const chatMessages = Array.isArray(chat.messages) ? chat.messages : [];
        const date = new Date(chat.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Get first user message as preview
        const firstUserMsg = chatMessages.find(msg => msg.sender === 'user');
        const preview = firstUserMsg ? firstUserMsg.text.substring(0, 100) : 'No messages';
        
        const isCurrent = chat.id === currentChatId;
        const chatPersonality = normalizePersonalityKey(chat.personality);
        const chatName = chat.name || `${personalities[chatPersonality]?.name || 'N.O.V.A'} Chat`;
        const chatFiles = Array.isArray(chat.files) ? chat.files : [];
        const fileGroups = chatFiles.reduce((groups, file) => {
            const extension = String(file.extension || file.name?.split('.').pop() || '').toLowerCase();
            const type = extension === 'pdf' ? 'PDF' : extension === 'docx' ? 'Docx' : null;
            if (type) (groups[type] ||= []).push(file);
            return groups;
        }, {});
        const fileBadges = Object.entries(fileGroups).map(([type, files]) => `
            <button class="chat-file-badge ${type.toLowerCase()}" type="button"
                    onclick="toggleChatFileList('${chat.id}', '${type}', event)"
                    title="Show uploaded ${type} files">
                <i class="fas ${type === 'PDF' ? 'fa-file-pdf' : 'fa-file-word'}"></i> ${type}
            </button>
        `).join('');
        const fileMenus = Object.entries(fileGroups).map(([type, files]) => `
            <div class="chat-file-list" data-chat-file-list="${chat.id}-${type}" hidden>
                ${files.map(file => `<div class="chat-file-entry"><i class="fas ${type === 'PDF' ? 'fa-file-pdf' : 'fa-file-word'}"></i><span>${escapeHtml(file.name)}</span></div>`).join('')}
            </div>
        `).join('');
        
        return `
            <div class="chat-history-item ${isCurrent ? 'current' : ''}" onclick="loadChat('${chat.id}')" data-chat-id="${chat.id}">
                <div class="chat-history-header">
                    <div class="chat-history-title">
                        ${isCurrent ? '📍 ' : ''}${escapeHtml(chatName)}
                        <button class="chat-history-rename-btn" type="button" onclick="renameChat('${chat.id}', event)" title="Rename chat" aria-label="Rename ${escapeHtml(chatName)}">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    </div>
                    <div class="chat-history-date">${dateStr}</div>
                </div>
                <div class="chat-history-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</div>
                <div class="chat-history-meta">
                    <span><i class="fas fa-comments"></i> ${chat.messageCount || chatMessages.length || 0} messages</span>
                    <span><i class="fas fa-robot"></i> ${personalities[chatPersonality]?.name || 'N.O.V.A'}</span>
                    ${fileBadges}
                </div>
                ${fileMenus}
                <div class="chat-history-actions">
                    <button class="chat-history-btn delete" onclick="deleteChat('${chat.id}', event)" title="Delete Chat">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('📚 Displayed', allChats.length, 'chats');
}

function toggleChatFileList(chatId, type, event) {
    event?.stopPropagation();
    const target = document.querySelector(`[data-chat-file-list="${CSS.escape(`${chatId}-${type}`)}"]`);
    if (!target) return;
    const wasHidden = target.hidden;
    document.querySelectorAll('.chat-file-list').forEach(list => { list.hidden = true; });
    target.hidden = !wasHidden;
}
window.toggleChatFileList = toggleChatFileList;

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
