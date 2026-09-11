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
                        individualChat: soleResponder === 'nova'
                    });
                }
                if (avonAllowed && groupChatModel) {
                    await generateAIResponse(userMessage, currentPersonality, {
                        assistant: 'other',
                        modelOverride: groupChatModel,
                        groupChat: true,
                        individualChat: soleResponder === 'other',
                        skipUserHistory: true
                    });
                }
                updateChatSuggestions(userMessage);
            } finally {
                window.activeVoiceAssistant = null;
                if (requestRunId === activeResponseRunId) {
                    isResponseInFlight = false;
                    updateContinuationButtonState();
                }

            }
        }, 1000);
    } catch (error) {
        console.error('❌ Error in processUserMessage:', error);
        isResponseInFlight = false;
        updateContinuationButtonState();
        removeThinkingIndicator();
        addMessage('System error processing your message. Please try again.', 'Nova');
    }

}

function updateChatSuggestions(currentText = '') {
    const container = document.getElementById('chatSuggestions');
    if (!container) return;
    const text = String(currentText || '').toLowerCase();
    const suggestionSets = text.includes('code') || text.includes('error')
        ? [
            ['Explain this step by step', 'Show a corrected example', 'Find the likely bug'],
            ['Review this for edge cases', 'Make this more efficient', 'Add a test for it']
        ]
        : text.includes('lecture') || text.includes('class')
            ? [
                ['Create a study guide', 'Quiz me on this', 'Explain the hardest concept'],
                ['Make flashcards', 'Give me a real-world example', 'What should I memorize?']
            ]
            : [
                ['Ask a follow-up question', 'Give me an example', 'Summarize the key points'],
                ['Explain it more simply', 'Compare the alternatives', 'What should I do next?']
            ];
    const suggestionSetIndex = Number(container.dataset.suggestionSet || 0) % suggestionSets.length;
    const suggestions = suggestionSets[suggestionSetIndex];
    container.dataset.suggestionSet = String(suggestionSetIndex);
    container.innerHTML = `<span class="suggestion-spacer" aria-hidden="true"></span>${suggestions.map(suggestion =>
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
    if (container) container.dataset.suggestionSet = String((Number(container.dataset.suggestionSet || 0) + 1) % 2);
    updateChatSuggestions(input?.value || '');
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

    isResponseInFlight = true;
    updateContinuationButtonState();
    addThinkingIndicator(recipient === 'other' ? 'Avon' : 'Nova');

    const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
    if (thinkingEl) {
        thinkingEl.textContent = `${recipientName} is continuing the response...`;
    }

    const continuationPrompt = recipientName === previousSpeaker
        ? `Continue your previous response naturally based on this ongoing chat.
Keep it directly relevant to what we are discussing right now.
Do not restart from scratch, do not repeat the same points, and do not be random.
Build from where you left off with useful next details.

Your previous response:
${lastAssistantMessage.text}`
        : `You are ${recipientName}. Respond directly to ${previousSpeaker}'s prior message in this group chat, as a distinct assistant addressing ${previousSpeaker}.
Stay relevant to the same topic, add useful perspective or continue the thought, and do not impersonate ${previousSpeaker} or repeat their answer.

${previousSpeaker}'s message:
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
