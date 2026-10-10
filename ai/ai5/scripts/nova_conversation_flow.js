// Conversation flow module
// Extracted from nova_main.js for modular structure.

function getModeChangeAssistant() {
    if (window.activeVoiceAssistant === 'other') return 'other';
    if (groupChatEnabled && mutedGroupAssistant === 'other') return 'other';
    return 'nova';
}

function getExplicitGroupMessageTarget(message) {
    if (!groupChatEnabled || mutedGroupAssistant !== 'both') return null;

    const text = String(message || '').trim();
    const novaName = '(?:nova|n\\.?\\s*o\\.?\\s*v\\.?\\s*a\\.?)';
    const avonName = 'a\\.?\\s*v\\.?\\s*o\\.?\\s*n\\.?';
    const addressSuffix = '(?=\\s|[,:;!?-]|$)';

    if (new RegExp(`^(?:(?:hey|yo)\\s+)?${avonName}${addressSuffix}`, 'i').test(text)) {
        return 'other';
    }
    if (new RegExp(`^(?:(?:hey|yo)\\s+)?${novaName}${addressSuffix}`, 'i').test(text)) {
        return 'nova';
    }
    return null;
}

function isQuickConversationMessage(message) {
    const text = String(message || '')
        .toLowerCase()
        .replace(/^(?:(?:hey|yo)\s+)?(?:n\.?\s*o\.?\s*v\.?\s*a\.?|a\.?\s*v\.?\s*o\.?\s*n\.?)[,:\s-]*/i, '')
        .trim();
    return /^(?:hi|hello|hey|yo|good\s+(?:morning|afternoon|evening)|how\s+are\s+you|what(?:'s|\s+is)\s+up|how(?:'s|\s+is)\s+it\s+going|are\s+you\s+(?:there|okay|alright))[\s!?.,]*$/i.test(text);
}

function getModeChangeGreeting(personalityType, personalityConfig, assistant) {
    if (assistant !== 'other') {
        return personalityType === 'Nova' ? getRandomNovaGreeting() : personalityConfig.greeting;
    }

    if (personalityType === 'Nova') {
        return 'A.V.O.N. is ready. How may I assist you?';
    }
    return `A.V.O.N. is ready in ${personalityConfig.name} Mode. ${personalityConfig.greeting}`;
}

function selectPersonality(personalityType) {
    const normalizedPersonality = normalizePersonalityKey(personalityType);
    console.log('🎭 Switching to personality:', personalityType, '=>', normalizedPersonality);
    currentPersonality = normalizedPersonality;
    
    // Update UI - Update mode cards with active class and data-active attribute
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.classList.remove('active');
        card.removeAttribute('data-active');
        if (normalizePersonalityKey(card.dataset.personality) === normalizedPersonality) {
            card.classList.add('active');
            card.setAttribute('data-active', 'true');
            // Force style recalculation
            void card.offsetHeight;
        }
    });
    
    // Update chat title
    const currentModeElement = document.querySelector('.current-mode');
    const personalityConfig = personalities[normalizedPersonality] || personalities.Nova;
    if (currentModeElement) {
        currentModeElement.textContent = personalityConfig.name + ' Mode';
    }
    
    // Keep the mode-change acknowledgement with the assistant currently addressing the user.
    const assistant = getModeChangeAssistant();
    const sender = assistant === 'other' ? 'Avon' : 'Nova';
    const greeting = getModeChangeGreeting(normalizedPersonality, personalityConfig, assistant);
    addMessage(greeting, sender);
    
    // Speak greeting if voice is enabled (with proper voice coordination)
    if (typeof window.speakText === 'function') {
        console.log(`🔊 Mode Switch: Starting ${sender} mode greeting with coordination...`);
        window.speakText(greeting, () => {
            console.log(`🔊 Mode Switch: ${sender} mode greeting completed`);
        }, assistant);
    }
    
    showNotification(`${sender} switched to ${personalityConfig.name} Mode`, 2000);
}

function addMessage(text, sender, timestamp = null, responseModel = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Remove thinking indicator
    removeThinkingIndicator();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${String(sender).toLowerCase()}-message`;
    
    const currentTime = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let senderName = 'You';
    if (sender === 'Nova') {
        const personality = personalities[currentPersonality] || personalities['Nova'];
        senderName = 'N.O.V.A';
    } else if (sender === 'Avon') {
        senderName = 'A.V.O.N.';
    }

    const modelLabel = responseModel ? String(responseModel).trim() : '';
    const responseModelBadge = (sender === 'Nova' || sender === 'Avon') && modelLabel
        ? `<span class="response-model-badge" title="Model that generated this response">Model: ${escapeHtml(modelLabel)}</span>`
        : '';
    
    // Add unique ID for message replay/edit functionality
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">${senderName}</span>
            ${responseModelBadge}
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content" data-speech-content="true" title="${sender === 'Nova' || sender === 'Avon' ? 'Click a word to read aloud from that point' : ''}">${formatMessageContent(text)}</div>
        ${sender === 'user' ? `<button class="message-edit-btn" onclick="editMessage('${messageId}')" title="Edit and resubmit message"><i class="fas fa-edit"></i></button>` : ''}
        <button class="message-replay-btn" onclick="replayMessage('${messageId}')" title="Read message aloud"><i class="fas fa-play"></i></button>
    `;
    
    // Store original text and metadata (for replay/edit functionality)
    messageDiv.dataset.messageId = messageId;
    messageDiv.dataset.originalText = text;
    messageDiv.dataset.sender = sender;
    messageDiv.dataset.messageIndex = chatHistory.length; // Position in history for truncation
    if (modelLabel) {
        messageDiv.dataset.responseModel = modelLabel;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history
    chatHistory.push({
        text: text,
        sender: sender,
        timestamp: currentTime,
        personality: currentPersonality,
        responseModel: modelLabel
    });
    
    console.log('💬 Message added:', { sender, text: text.substring(0, 50) + '...', personality: currentPersonality });
    if (sender === 'Nova' || sender === 'Avon') updateChatSuggestions(text);
}

function getCurrentModeDisplayName() {
    const config = personalities[currentPersonality] || personalities.Nova;
    return config ? config.name : 'N.O.V.A';
}

function isModeQuestion(message) {
    const normalized = String(message || '').toLowerCase();
    return /\b(what\s+mode(?:\s+are\s+you\s+on)?|which\s+mode|current\s+mode|what\s+personality|which\s+personality|what\s+are\s+you\s+in)\b/i.test(normalized);
}

function getModeQuestionResponse() {
    const modeName = getCurrentModeDisplayName();
    return `I’m currently in ${modeName} Mode, sir.`;
}

function isNoveltyRequest(message) {
    const normalized = String(message || '').toLowerCase().trim();
    return /\b(fun\s+fact|interesting\s+fact|tell\s+me\s+something\s+(?:interesting|new)|tell\s+me\s+a\s+fun\s+fact|something\s+new|surprise\s+me\s+with\s+something|another\s+(?:fun\s+fact|interesting\s+thing)|share\s+something\s+interesting)\b/i.test(normalized);
}

function stripSourcesSection(text) {
    return String(text || '')
        .replace(/\n\s*---\s*\n\s*\*\*?\s*Sources\s*&\s*References\s*\*\*?[\s\S]*$/i, '')
        .replace(/\n\s*Sources\s*&\s*References\s*:?\s*[\s\S]*$/i, '')
        .trim();
}

function normalizeNoveltyText(text) {
    return stripSourcesSection(text)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function summarizeNoveltyText(text, maxLength = 220) {
    const cleaned = stripSourcesSection(text).replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
    const summary = sentences.slice(0, 2).join(' ').trim();
    return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trim()}…` : summary;
}

function buildNoveltyFingerprint(text) {
    return normalizeNoveltyText(text).split(' ').slice(0, 32).join(' ');
}

function saveNoveltyMemory() {
    try {
        localStorage.setItem(NOVELTY_MEMORY_STORAGE_KEY, JSON.stringify(noveltyMemory.slice(-NOVELTY_MEMORY_LIMIT)));
    } catch (error) {
        console.warn('⚠️ Failed to persist novelty memory:', error);
    }
}

function recordNoveltyResponse(userMessage, reply, modelName = '') {
    if (!isNoveltyRequest(userMessage)) return;

    const summary = summarizeNoveltyText(reply);
    const fingerprint = buildNoveltyFingerprint(reply);
    if (!summary || !fingerprint) return;

    noveltyMemory = noveltyMemory.filter(entry => entry && entry.fingerprint !== fingerprint);
    noveltyMemory.push({
        prompt: summarizeNoveltyText(userMessage, 120),
        summary,
        fingerprint,
        model: String(modelName || '').trim(),
        timestamp: new Date().toISOString()
    });

    if (noveltyMemory.length > NOVELTY_MEMORY_LIMIT) {
        noveltyMemory = noveltyMemory.slice(-NOVELTY_MEMORY_LIMIT);
    }
    saveNoveltyMemory();
}

function isNoveltyReplyDuplicate(userMessage, reply) {
    if (!isNoveltyRequest(userMessage) || !Array.isArray(noveltyMemory) || noveltyMemory.length === 0) {
        return false;
    }

    const fingerprint = buildNoveltyFingerprint(reply);
    const normalizedReply = normalizeNoveltyText(reply);
    if (!fingerprint || !normalizedReply) return false;

    return noveltyMemory.some(entry => {
        if (!entry || !entry.fingerprint) return false;
        if (entry.fingerprint === fingerprint) return true;
        const prior = String(entry.fingerprint || '');
        return prior.length > 40 && (normalizedReply.includes(prior) || prior.includes(fingerprint));
    });
}

function getNoveltyMemoryContext(userMessage, options = {}) {
    if (!isNoveltyRequest(userMessage) || !Array.isArray(noveltyMemory) || noveltyMemory.length === 0) {
        return '';
    }

    const recentEntries = noveltyMemory.slice(-8);
    const lines = recentEntries.map((entry, index) => `- Earlier shared item ${index + 1}: ${entry.summary}`);
    const retryLine = options.noveltyRetry
        ? '\nYour previous draft was still too similar. You must choose a clearly different topic, example, or fact than any item listed below.'
        : '';

    return `\nNovelty memory:
The user has already heard the following kinds of answers. Do not repeat, paraphrase closely, or reuse the same fact/topic.
${lines.join('\n')}${retryLine}
When asked for something new or interesting, prefer a genuinely different topic than the ones listed above.\n`;
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
    window.noteAutoModeUserActivity?.();
    console.log('💭 ==========================================');
    console.log('💭 processUserMessage CALLED');
    console.log('💭 Message:', userMessage);
    console.log('💭 Current personality:', currentPersonality);
    console.log('💭 isResponseInFlight:', isResponseInFlight);
    console.log('💭 window.isSpeaking:', window.isSpeaking);
    console.log('💭 ==========================================');
    
    try {
        if (isModeQuestion(userMessage)) {
            const modeResponse = getModeQuestionResponse();
            console.log('🎭 Mode question detected - responding directly:', modeResponse);

            window.stopSpeech?.();
            if (activeResponseAbortController) {
                try {
                    activeResponseAbortController.abort();
                } catch (error) {
                    console.warn('🎭 Failed to abort active request for mode question:', error);
                } finally {
                    activeResponseAbortController = null;
                }
            }
            window.voiceInterruptInProgress = false;
            isResponseInFlight = true;
            updateContinuationButtonState();
            addMessage(userMessage, 'user');
            addMessage(modeResponse, 'Nova', null, currentModel);
            conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            });
            conversationHistory.push({
                role: 'assistant',
                content: modeResponse,
                personality: currentPersonality,
                timestamp: new Date().toISOString(),
                model: currentModel
            });
            if (typeof window.speakText === 'function') {
                window.speakText(modeResponse, () => {});
            }
            isResponseInFlight = false;
            updateContinuationButtonState();
            return;
        }

        // Handle interrupt if speech is currently playing
        if (isResponseInFlight && (window.isSpeaking || window.voiceInterruptInProgress)) {
            console.log('🛑 Interrupt detected - speech is in progress');
            handleInterrupt(userMessage);
            return;
        }
        
        if (isResponseInFlight) {
            showNotification('N.O.V.A is still responding. Please wait or use Continue after it finishes.', 2500);
            return;
        }

        isResponseInFlight = true;
        const requestRunId = ++activeResponseRunId;
        updateContinuationButtonState();

        // Detect and save any personalization info from the message
        detectAndSavePersonalization(userMessage);
        
        // Smart model selection based on task type
        updateModelForMessage(userMessage);
        
        // Add user message to chat
        addMessage(userMessage, 'user');
        
        const voiceTarget = window.activeVoiceAssistant || null;
        const explicitTarget = getExplicitGroupMessageTarget(userMessage);
        const responseTarget = explicitTarget || voiceTarget;
        window.currentUserAddressee = groupChatEnabled && responseTarget ? responseTarget : null;
        const fastResponse = isQuickConversationMessage(userMessage);
        const novaAllowed = responseTarget !== 'other' && mutedGroupAssistant !== 'other';
        const avonAllowed = groupChatEnabled && responseTarget !== 'nova' && mutedGroupAssistant !== 'nova';
        const soleResponder = novaAllowed && !avonAllowed
            ? 'nova'
            : avonAllowed && !novaAllowed
                ? 'other'
                : null;

        // Show the specific assistant that will answer when only one is selected.
        addThinkingIndicator(soleResponder === 'other' ? 'Avon' : 'Nova');
        
        // Clear input and reset height
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto'; // Reset to minimum height
        }
        
        // Generate AI response
        setTimeout(async () => {
            try {
                if (novaAllowed) {
                    await generateAIResponse(userMessage, currentPersonality, {
                        assistant: 'nova',
                        groupChat: groupChatEnabled,
                        individualChat: soleResponder === 'nova',
                        fastResponse
                    });
                }
                if (avonAllowed && groupChatModel) {
                    await generateAIResponse(userMessage, currentPersonality, {
                        assistant: 'other',
                        modelOverride: groupChatModel,
                        groupChat: true,
                        individualChat: soleResponder === 'other',
                        skipUserHistory: true,
                        fastResponse
                    });
                }
                updateChatSuggestions(userMessage);
            } finally {
                window.activeVoiceAssistant = null;
                window.currentUserAddressee = null;
                if (requestRunId === activeResponseRunId) {
                    isResponseInFlight = false;
                    updateContinuationButtonState();
                }

            }
        }, 0);
    } catch (error) {
        console.error('❌ Error in processUserMessage:', error);
        isResponseInFlight = false;
        updateContinuationButtonState();
        removeThinkingIndicator();
        addMessage('System error processing your message. Please try again.', 'Nova');
    }

}

const SUGGESTION_STOP_WORDS = new Set('the and but than that this these those with without from into onto about above below over under again further once here there when where why how all any both each few more most other some such only own same too very can will just should would could might must have has had having does did doing been being are was were you your yours they them their what which who whom whose also like really actually maybe sure okay yes not nor for off out per via get got let make made one two many much well even still ever never always often it\'s i\'m i\'ve i\'ll we our ours'.split(' '));

function extractSuggestionTopics(text) {
    const counts = new Map();
    String(text || '').replace(/```[\s\S]*?```/g, ' ').toLowerCase().split(/[^a-z0-9'\-]+/).forEach(word => {
        if (word.length < 4 || SUGGESTION_STOP_WORDS.has(word) || /^\d+$/.test(word)) return;
        counts.set(word, (counts.get(word) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(entry => entry[0]);
}

function buildChatSuggestionPool() {
    const lastAssistant = [...chatHistory].reverse().find(m => (m.sender === 'Nova' || m.sender === 'Avon') && m.text);
    const lastUser = [...chatHistory].reverse().find(m => m.sender === 'user' && m.text);
    const reply = String(lastAssistant?.text || '');
    const lower = (reply + ' ' + String(lastUser?.text || '')).toLowerCase();
    const topics = extractSuggestionTopics(reply || lastUser?.text || '');
    const topic = topics[0];
    const topic2 = topics[1];
    const pool = [];
    const add = (...items) => items.forEach(item => { if (item && !pool.includes(item)) pool.push(item); });

    if (/\?\s*$/.test(reply.trim())) add('Yes, go ahead', 'No, not right now', 'Can you clarify that?');
    if (/```|\b(code|error|bug|function|exception|compile|script|variable)\b/.test(lower)) {
        add('Explain this code step by step', 'Show a corrected example', 'What edge cases could break this?', 'How would I test this?');
    }
    if (/\b(lecture|class|study|exam|homework|assignment|course|quiz)\b/.test(lower)) {
        add('Create a study guide from this', 'Quiz me on this', 'Make flashcards for this');
    }
    if (/\b(recipe|cook|bake|ingredient)\b/.test(lower)) add('List the ingredients I need', 'Can I substitute anything?');
    if (/\b(weather|temperature|forecast|rain)\b/.test(lower)) add('What about tomorrow?', 'Should I bring a jacket?');
    if (/\b(\d+\s*(steps?|ways|options|tips)|first|second|step)\b/.test(lower)) add('Walk me through step one', 'Which option is best?');
    if (topic) add(`Tell me more about ${topic}`, `Give me an example of ${topic}`);
    if (topic && topic2) add(`How does ${topic} relate to ${topic2}?`);
    if (topic) add(`What are common mistakes with ${topic}?`);
    if (groupChatEnabled && lastAssistant) {
        const other = lastAssistant.sender === 'Avon' ? 'Nova' : 'Avon';
        add(`${other}, what do you think about that?`, `${other}, do you agree?`);
    }
    add('Summarize that in one sentence', 'Explain it more simply', 'What should I do next?');
    return pool;
}

function updateChatSuggestions() {
    const container = document.getElementById('chatSuggestions');
    if (!container) return;
    const pool = buildChatSuggestionPool();
    const offset = Number(container.dataset.suggestionSet || 0);
    const suggestions = [0, 1, 2].map(i => pool[(offset * 3 + i) % pool.length]).filter((s, i, arr) => arr.indexOf(s) === i);    container.innerHTML = `<span class="suggestion-spacer" aria-hidden="true"></span>${suggestions.map(suggestion =>
        `<button type="button" class="chat-suggestion" onclick="applyChatSuggestion('${escapeHtml(suggestion).replace(/'/g, '&#39;')}')">${escapeHtml(suggestion)}</button>`
    ).join('')}<button type="button" class="chat-suggestions-refresh" onclick="refreshChatSuggestions()" title="Show different relevant suggestions" aria-label="Show different relevant suggestions"><i class="fas fa-sync-alt"></i></button>`;
}

function applyChatSuggestion(suggestion) {
    const input = document.getElementById('messageInput');
    if (!input) return;
    input.value = suggestion;
    input.focus();
}
window.applyChatSuggestion = applyChatSuggestion;

function refreshChatSuggestions() {
    const container = document.getElementById('chatSuggestions');
    const input = document.getElementById('messageInput');
    if (container) container.dataset.suggestionSet = String(Number(container.dataset.suggestionSet || 0) + 1);
    updateChatSuggestions();
}
window.refreshChatSuggestions = refreshChatSuggestions;

function getLastAssistantMessage() {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const message = chatHistory[i];
        if ((message.sender === 'Nova' || message.sender === 'Avon') && message.text) {
            return message;
        }
    }
    return null;
}

function updateContinuationButtonState() {
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) return;
    continueBtn.disabled = isResponseInFlight;
    continueBtn.classList.toggle('disabled', isResponseInFlight);
}

async function continueConversation(selectedAssistant = null) {
    if (isResponseInFlight) {
        showNotification('Please wait for N.O.V.A to finish the current response.', 2200);
        return;
    }

    const lastAssistantMessage = getLastAssistantMessage();
    if (!lastAssistantMessage) {
        showNotification('No response yet to continue from.', 2200);
        return;
    }

    const bothAssistantsActive = groupChatEnabled && mutedGroupAssistant === 'both';
    if (bothAssistantsActive && !selectedAssistant) {
        const chooser = document.getElementById('continueAssistantModal');
        if (chooser) {
            chooser.classList.add('active');
            document.getElementById('continueWithNova')?.focus();
            return;
        }
    }

    const recipient = selectedAssistant || (lastAssistantMessage.sender === 'Avon' ? 'other' : 'nova');
    const recipientName = recipient === 'other' ? 'A.V.O.N.' : 'N.O.V.A.';
    const previousSpeaker = lastAssistantMessage.sender === 'Avon' ? 'A.V.O.N.' : 'N.O.V.A.';
    const previousTime = lastAssistantMessage.timestamp ? ` at ${lastAssistantMessage.timestamp}` : '';

    isResponseInFlight = true;
    updateContinuationButtonState();
    addThinkingIndicator(recipient === 'other' ? 'Avon' : 'Nova');

    const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
    if (thinkingEl) {
        thinkingEl.textContent = `${recipientName} is continuing the response...`;
    }

    const continuationPrompt = recipientName === previousSpeaker
        ? `You are ${recipientName}, continuing your own earlier message (you said it${previousTime}). Continue it naturally based on this ongoing chat.
Keep it directly relevant to what we are discussing right now.
Do not restart from scratch, do not repeat the same points, and do not be random.
Build from where you left off with useful next details.

Your previous response:
${lastAssistantMessage.text}`
        : `You are ${recipientName}. ${previousSpeaker}, the other assistant, said the following${previousTime}; it was NOT you. Respond directly to ${previousSpeaker}'s message in this group chat, as a distinct assistant addressing ${previousSpeaker}.
Stay relevant to the same topic, add useful perspective or continue the thought, and do not impersonate ${previousSpeaker} or repeat their answer.

${previousSpeaker}'s message${previousTime}:
${lastAssistantMessage.text}`;

    try {
        await generateAIResponse(continuationPrompt, currentPersonality, {
            assistant: recipient,
            modelOverride: recipient === 'other' ? groupChatModel : undefined,
            groupChat: groupChatEnabled,
            conversationPartner: previousSpeaker,
            skipUserHistory: true
        });
    } finally {
        isResponseInFlight = false;
        updateContinuationButtonState();
    }
}

// Screen sharing: while on, the latest screen frame is attached to each AI request.
let screenShareStream = null;
let screenShareVideo = null;
let screenShareTarget = 'both';

function setScreenShareUi(active) {
    ['screenShareBtn', 'mobileScreenShareBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.querySelector('i')?.classList.toggle('fa-eye', !active);
        btn.querySelector('i')?.classList.toggle('fa-eye-slash', active);
    });
}

function stopScreenShare(message) {
    if (screenShareStream) {
        screenShareStream.getTracks().forEach(track => track.stop());
    }
    screenShareStream = null;
    if (screenShareVideo) screenShareVideo.srcObject = null;
    screenShareVideo = null;
    setScreenShareUi(false);
    if (message) showNotification(message, 2200);
}

// Returns a JPEG data URL of the current shared screen, or null when not sharing.
window.getScreenShareFrame = function (assistant) {
    if (assistant && screenShareTarget !== 'both' && screenShareTarget !== assistant) return null;
    if (!screenShareStream || !screenShareVideo || !screenShareVideo.videoWidth) return null;
    const scale = Math.min(1, 1280 / screenShareVideo.videoWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(screenShareVideo.videoWidth * scale);
    canvas.height = Math.round(screenShareVideo.videoHeight * scale);
    canvas.getContext('2d').drawImage(screenShareVideo, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
};

window.getScreenShareSignature = function (assistant) {
    if (assistant && screenShareTarget !== 'both' && screenShareTarget !== assistant) return null;
    if (!screenShareStream || !screenShareVideo || !screenShareVideo.videoWidth) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 18;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not inspect the shared screen.');
    context.drawImage(screenShareVideo, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const signature = new Uint8Array(canvas.width * canvas.height * 3);
    for (let pixel = 0; pixel < canvas.width * canvas.height; pixel += 1) {
        signature[pixel * 3] = pixels[pixel * 4] >> 4;
        signature[pixel * 3 + 1] = pixels[pixel * 4 + 1] >> 4;
        signature[pixel * 3 + 2] = pixels[pixel * 4 + 2] >> 4;
    }
    return signature;
};

window.getScreenShareTarget = function () {
    return screenShareStream ? screenShareTarget : null;
};

async function toggleScreenShare(chosenTarget) {
    if (screenShareStream) return stopScreenShare('Screen sharing stopped.');
    if (typeof chosenTarget !== 'string') {
        const chooser = document.getElementById('screenShareAssistantModal');
        if (chooser && groupChatEnabled && mutedGroupAssistant === 'both') {
            chooser.classList.add('active');
            return;
        }
        chosenTarget = 'both';
    }
    screenShareTarget = chosenTarget;
    if (!navigator.mediaDevices?.getDisplayMedia) {
        showNotification('Screen sharing is not supported in this browser.', 3000);
        return;
    }
    try {
        screenShareStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (error) {
        screenShareStream = null;
        showNotification('Screen sharing was cancelled or blocked.', 2500);
        return;
    }
    screenShareVideo = document.createElement('video');
    screenShareVideo.muted = true;
    screenShareVideo.playsInline = true;
    screenShareVideo.srcObject = screenShareStream;
    await screenShareVideo.play().catch(() => {});
    screenShareStream.getVideoTracks()[0]?.addEventListener('ended', () => stopScreenShare('Screen sharing ended.'));
    setScreenShareUi(true);
    showNotification('Screen sharing on: the AI can now see your screen. Use a vision-capable model.', 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('screenShareBtn')?.addEventListener('click', () => toggleScreenShare());
    document.getElementById('mobileScreenShareBtn')?.addEventListener('click', () => toggleScreenShare());
    const shareModal = document.getElementById('screenShareAssistantModal');
    const closeShareModal = () => shareModal?.classList.remove('active');
    document.getElementById('closeScreenShareAssistantModal')?.addEventListener('click', closeShareModal);
    shareModal?.addEventListener('click', e => { if (e.target === shareModal) closeShareModal(); });
    [['shareWithNova', 'nova'], ['shareWithAvon', 'other'], ['shareWithBoth', 'both']].forEach(([id, target]) => {
        document.getElementById(id)?.addEventListener('click', () => { closeShareModal(); toggleScreenShare(target); });
    });
});

// Auto Mode checks meaningful changes in a shared screen and speaks only when useful.
let autoModeActive = false;
let autoModeRunId = 0;
let autoModeLastInteractionAt = 0;
let autoModeLastSpokeAt = 0;
let autoModeEvaluationInFlight = false;
let autoPilotActive = false;
let autoPilotRunId = 0;

function setAutoModeUi(active) {
    ['autoModeBtn', 'mobileAutoModeBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
        btn.title = active
            ? 'Auto Mode is on: proactively notice useful changes on your shared screen'
            : 'Auto Mode: proactively notice useful changes on your shared screen';
    });
}

function stopAutoMode(message) {
    if (!autoModeActive) return;
    autoModeActive = false;
    autoModeRunId += 1;
    setAutoModeUi(false);
    if (message) showNotification(message, 2200);
}

function setAutoPilotUi(active) {
    ['autoPilotBtn', 'mobileAutoPilotBtn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
}

function stopAutoPilot(message) {
    if (!autoPilotActive) return;
    autoPilotActive = false;
    autoPilotRunId += 1;
    setAutoPilotUi(false);
    if (message) showNotification(message, 2200);
}

function noteAutoModeUserActivity() {
    autoModeLastInteractionAt = Date.now();
}
window.noteAutoModeUserActivity = noteAutoModeUserActivity;

['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(eventName => {
    document.addEventListener(eventName, noteAutoModeUserActivity, { passive: true });
});

function getAutoModeAssistant() {
    const allowed = groupChatEnabled
        ? mutedGroupAssistant === 'nova'
            ? ['nova']
            : mutedGroupAssistant === 'other'
                ? ['other']
                : ['nova', 'other']
        : [window.activeVoiceAssistant === 'other' ? 'other' : 'nova'];
    const shareTarget = window.getScreenShareTarget?.();
    if (!shareTarget) return null;
    const visible = shareTarget === 'both' ? allowed : allowed.filter(assistant => assistant === shareTarget);
    if (!visible.length) return null;
    if (visible.length === 1) return visible[0];

    const lastAssistant = getLastAssistantMessage();
    const preferred = lastAssistant
        ? lastAssistant.sender === 'Avon' ? 'nova' : 'other'
        : 'nova';
    return visible.includes(preferred) ? preferred : visible[0];
}

function getScreenChangeRatio(previous, current) {
    if (!previous || !current || previous.length !== current.length) return 1;
    let changedPixels = 0;
    const totalPixels = current.length / 3;
    for (let pixel = 0; pixel < totalPixels; pixel += 1) {
        const offset = pixel * 3;
        const distance = Math.abs(current[offset] - previous[offset]) +
            Math.abs(current[offset + 1] - previous[offset + 1]) +
            Math.abs(current[offset + 2] - previous[offset + 2]);
        if (distance >= 15) changedPixels += 1;
    }
    return changedPixels / totalPixels;
}

const AUTO_MODE_PROMPT = `AUTO MODE SCREEN CHECK
You are watching the user's shared screen live and may speak first, without being spoken to, just like in a normal screen-share conversation.
Look at the latest shared-screen image (and the recent conversation, if any). React the way a helpful companion would: comment on, explain, or help with what is on screen or what the user just opened, highlighted, or did. Answer or help with any question, problem, error, or task visible on the page.
Stay quiet (do not narrate every tiny change, repeat yourself, or guess at hidden content). Do not click, search, submit, or claim to have taken actions.
If there is genuinely nothing worth saying, reply with exactly: NO_ACTION
Otherwise reply with only one brief, natural spoken remark (at most two sentences).`;

async function runAutoModeLoop(runId) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    let lastEvaluatedSignature = null;
    let lastEvaluationAt = 0;

    while (autoModeActive && runId === autoModeRunId) {
        await sleep(3000);
        if (!autoModeActive || runId !== autoModeRunId) return;

        const assistant = getAutoModeAssistant();
        if (!assistant || autoModeEvaluationInFlight) continue;

        let signature;
        try {
            signature = window.getScreenShareSignature?.(assistant);
        } catch (error) {
            console.error('Auto Mode could not inspect the shared screen:', error);
            stopAutoMode(`Auto Mode paused: ${error.message}`);
            return;
        }
        if (!signature || getScreenChangeRatio(lastEvaluatedSignature, signature) < 0.015) continue;

        const now = Date.now();
        const messageInput = document.getElementById('messageInput');
        const userIsComposing = Boolean(messageInput?.value.trim());
        if (now - lastEvaluationAt < 10000 ||
            now - autoModeLastInteractionAt < 2500 ||
            now - autoModeLastSpokeAt < 15000 ||
            isResponseInFlight ||
            window.isSpeaking ||
            window.voiceInterruptInProgress ||
            window.speechSynthesis?.speaking ||
            userIsComposing) {
            continue;
        }

        lastEvaluatedSignature = signature;
        lastEvaluationAt = now;
        autoModeEvaluationInFlight = true;
        try {
            const replyResult = await generateAIResponse(AUTO_MODE_PROMPT, currentPersonality, {
                assistant,
                modelOverride: assistant === 'other' ? groupChatModel : undefined,
                groupChat: groupChatEnabled,
                individualChat: !groupChatEnabled || mutedGroupAssistant !== 'both',
                skipUserHistory: true,
                proactiveEvaluation: true
            });
            if (!autoModeActive || runId !== autoModeRunId) return;

            const reply = String(replyResult?.reply || '').trim();
            if (!reply || /^NO_ACTION(?:\s|[.!:—-]|$)/i.test(reply)) continue;
            if (Date.now() - autoModeLastInteractionAt < 3500 ||
                isResponseInFlight ||
                window.isSpeaking ||
                window.voiceInterruptInProgress ||
                window.speechSynthesis?.speaking) {
                continue;
            }

            const sender = assistant === 'other' ? 'Avon' : 'Nova';
            addMessage(reply, sender, null, replyResult.model);
            conversationHistory.push({
                role: 'assistant',
                speaker: sender,
                content: reply,
                personality: currentPersonality,
                timestamp: new Date().toISOString(),
                model: replyResult.model
            });
            autoModeLastSpokeAt = Date.now();
            speakAssistantResponse(reply, sender);
        } catch (error) {
            console.error('Auto Mode screen check failed:', error);
            stopAutoMode(`Auto Mode paused: ${error.message}`);
            return;
        } finally {
            autoModeEvaluationInFlight = false;
        }
    }
}

function toggleAutoMode() {
    if (autoModeActive) return stopAutoMode('Auto Mode off.');
    stopAutoPilot();
    autoModeActive = true;
    autoModeRunId += 1;
    setAutoModeUi(true);
    showNotification('Auto Mode on. Share your screen for proactive, screen-aware help.', 3500);
    runAutoModeLoop(autoModeRunId);
}

async function runAutoPilotLoop(runId) {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    while (autoPilotActive && runId === autoPilotRunId) {
        if (isResponseInFlight || window.speechSynthesis?.speaking) {
            await sleep(500);
            continue;
        }
        const last = getLastAssistantMessage();
        if (!last) return stopAutoPilot('Auto-Pilot needs a first response to start from. Send a message first.');
        const countBefore = document.querySelectorAll('#chatMessages .message').length;
        await continueConversation(last.sender === 'Avon' ? 'nova' : 'other');
        if (!autoPilotActive || runId !== autoPilotRunId) return;
        if (document.querySelectorAll('#chatMessages .message').length <= countBefore) {
            return stopAutoPilot('Auto-Pilot stopped: no new reply was produced.');
        }
        await sleep(1200);
    }
}

function toggleAutoPilot() {
    if (autoPilotActive) return stopAutoPilot('Auto-Pilot off.');
    if (!getLastAssistantMessage()) {
        showNotification('Send a message first so the assistants have something to talk about.', 2500);
        return;
    }

    stopAutoMode();
    const groupToggle = document.getElementById('groupChatEnabled');
    if (!groupChatEnabled && groupToggle) {
        groupToggle.checked = true;
        groupToggle.dispatchEvent(new Event('change'));
    }
    const muteSelect = document.getElementById('mutedGroupAssistant');
    if (muteSelect && muteSelect.value !== 'both') {
        muteSelect.value = 'both';
        muteSelect.dispatchEvent(new Event('change'));
    }
    autoPilotActive = true;
    autoPilotRunId += 1;
    setAutoPilotUi(true);
    showNotification('Auto-Pilot on: N.O.V.A and A.V.O.N. are now chatting.', 2500);
    runAutoPilotLoop(autoPilotRunId);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('autoModeBtn')?.addEventListener('click', toggleAutoMode);
    document.getElementById('mobileAutoModeBtn')?.addEventListener('click', toggleAutoMode);
    document.getElementById('autoPilotBtn')?.addEventListener('click', toggleAutoPilot);
    document.getElementById('mobileAutoPilotBtn')?.addEventListener('click', toggleAutoPilot);
    document.getElementById('clearChat')?.addEventListener('click', () => {
        stopAutoMode();
        stopAutoPilot();
    });
});

// Handle interrupt when user speaks during Nova's response (topic change)
async function handleInterrupt(userMessage) {
    const interruptRunId = ++activeResponseRunId;

    // Stop speech synthesis immediately
    window.stopSpeech?.();
    console.log('🛑 Speech synthesis stopped (interrupt)');

    if (activeResponseAbortController) {
        try {
            activeResponseAbortController.abort();
            console.log('🛑 Active AI request aborted for interrupt');
        } catch (error) {
            console.warn('🛑 Failed to abort active AI request:', error);
        } finally {
            activeResponseAbortController = null;
        }
    }
    
    // If response is in flight, set flag to stop continuation
    const wasResponseInFlight = isResponseInFlight;
    if (!isResponseInFlight) {
        isResponseInFlight = true;
        updateContinuationButtonState();
    }
    
    // Add user's interruption to chat and history
    addMessage(userMessage, 'user');
    conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
    });
    
    // Get the last Nova message to understand context
    const lastNovaMessage = getLastNovaMessageText();
    
    // Build context-aware prompt that understands natural conversation flow
    const interruptPrompt = `The user has interrupted your previous response mid-way. They are now saying or asking:

"${userMessage}"

Here's what you were discussing before they interrupted:
${lastNovaMessage}

Now respond to their new input naturally. Determine if they are:
1. Asking a clarification or follow-up to what you were saying
2. Asking something related but different
3. Asking something completely unrelated

Respond contextually and intelligently. If related, acknowledge the connection. If unrelated, smoothly transition to the new topic. Do not repeat information you already provided. Keep your response focused on what they just asked or said.`;
    
    try {
        removeThinkingIndicator();
        addThinkingIndicator();
        const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
        if (thinkingEl) {
            thinkingEl.textContent = 'N.O.V.A is responding to your interruption...';
        }
        
        await generateAIResponse(interruptPrompt, currentPersonality);
    } finally {
        window.voiceInterruptInProgress = false;
        if (interruptRunId === activeResponseRunId) {
            isResponseInFlight = false;
            updateContinuationButtonState();
        }
    }
}
