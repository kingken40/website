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

    const chatData = {
        id: currentChatId,
        name: existingChat?.name || `${personalities[normalizedPersonality]?.name || 'Nova'} Chat`,
        timestamp: Date.now(),
        personality: normalizedPersonality,
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
                    <span><i class="fas fa-comments"></i> ${chat.messageCount || chatMessages.length || 0} messages</span>
                    <span><i class="fas fa-robot"></i> ${personalities[chatPersonality]?.name || 'N.O.V.A'}</span>
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

