// Runtime AI + web context module
// Extracted from nova_runtime_features.js.

function sendMessageWithAttachment() {
    const messageInput = document.getElementById('messageInput');
    const userText = messageInput ? messageInput.value.trim() : '';
    
    // Check if there's either text or a file attachment
    if (!userText && !currentFileAttachment) {
        return; // Nothing to send
    }
    
    let finalMessage = userText;
    const uploadedFile = currentFileAttachment ? {
        name: currentFileAttachment.name,
        type: currentFileAttachment.type,
        extension: currentFileAttachment.extension || currentFileAttachment.name.split('.').pop()
    } : null;
    
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
                fileContent = content.length > 60000 ? content.substring(0, 60000) + '\n\n[Transcript context shortened; ask for a specific timestamp or section for deeper review.]' : content;
                finalMessage = `I've uploaded an audio file "${name}". Here is the transcription:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
        }
        
        // Clear the file attachment after using it
        clearFileAttachment();
    }
    
    // Send the message
    if (finalMessage) {
        if (uploadedFile) {
            currentChatFiles = Array.isArray(currentChatFiles) ? currentChatFiles : [];
            currentChatFiles.push(uploadedFile);
        }
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

// Make handleInterrupt globally available for interrupt detection
window.handleInterrupt = handleInterrupt;

function buildWebTaskMessage(userMessage, webContext = '') {
    const liveContext = webContext ? `\n\n${webContext}` : '';
    return `${userMessage}${liveContext}

WEB SEARCH TASK:
Use the live web context to answer accurately and naturally.
Prefer primary and official sources, and distinguish facts from interpretation.
Every internet-derived factual claim must have an inline clickable markdown citation when possible.
Always finish with "Sources & References" containing the source title and full clickable markdown URL for every source used.
Also include "Where to get more" with useful official pages, documentation, or further reading.
Never invent a URL or citation, and never claim you cannot browse.`;
}

function extractResponseText(choice) {
    const message = choice?.message || choice;
    let content = message?.content || message?.reasoning || message?.reasoning_content || choice?.text || '';
    if (typeof content !== 'string') {
        try {
            content = JSON.stringify(content);
        } catch (error) {
            content = String(content);
        }
    }
    return content.trim();
}

function needsResponseCompletion(reply, finishReason) {
    if (!reply) return finishReason === 'length';
    if (finishReason === 'length' || finishReason === 'max_tokens') return true;

    const finalText = reply.trim();
    if (/[,:;—-]$/.test(finalText)) return true;
    if (/\b(and|but|or|because|with|to|the|a|an|of|for|in|on|at|from|that|which|who|when|where|while|if|then|than|as|real)$/i.test(finalText)) {
        return true;
    }
    return /[\(\[\{]$/.test(finalText);
}

function buildResponseCompletionRequest(originalMessage, partialReply) {
    return `Continue and finish your previous answer to the user's message below. Start exactly where the partial answer stopped; do not repeat its wording, add a greeting, mention this instruction, or describe the continuation.\n\nUser message:\n${originalMessage}\n\nPartial answer:\n${partialReply}`;
}

function speakAssistantResponse(text, responseSender, onEndCallback = null) {
    const assistant = responseSender === 'Avon' ? 'other' : 'nova';
    if (typeof window.enqueueAssistantSpeech === 'function') {
        window.enqueueAssistantSpeech(text, assistant, onEndCallback);
        return;
    }
    if (typeof window.speakText === 'function') {
        window.speakText(text, onEndCallback, assistant);
    }
}

function getInstantConversationReply(userMessage, responseSender) {
    const text = String(userMessage || '').toLowerCase();
    const assistantName = responseSender === 'Avon' ? 'A.V.O.N.' : 'N.O.V.A.';

    if (/\bhow\s+are\s+you\b|\bhow(?:'s|\s+is)\s+it\s+going\b|\bare\s+you\s+(?:there|okay|alright)\b/.test(text)) {
        return responseSender === 'Avon'
            ? 'I am doing well, thank you. A.V.O.N. is online and ready to help. How are you?'
            : 'I am doing well, thank you. N.O.V.A. is online and ready to help. How are you?';
    }
    if (/\bgood\s+(?:morning|afternoon|evening)\b/.test(text)) {
        return `Good day. ${assistantName} is ready to assist you.`;
    }
    return responseSender === 'Avon'
        ? 'Hello. A.V.O.N. is here and ready to help. What would you like to discuss?'
        : 'Hello. N.O.V.A. is here and ready to help. What would you like to discuss?';
}

// Try the server-side /api/chat proxy (uses OPENROUTER_API_KEY or OPENAI_API_KEY env variable on Vercel)
async function generateViaServerProxy(userMessage, personality, options = {}) {
    const webIntent = _resolveWebIntent(userMessage);
    const shouldUseWeb = !!webIntent;
    let collectedWebSources = [];
    let proxyMessage = userMessage;

    if (webIntent) {
        const webBundle = await getWebSearchContext(userMessage);
        if (webBundle && webBundle.context) {
            proxyMessage = buildWebTaskMessage(userMessage, webBundle.context);
            collectedWebSources = Array.isArray(webBundle.sources) ? webBundle.sources : [];
        } else {
            proxyMessage = buildWebTaskMessage(userMessage);
        }
    }

    const messages = prepareOpenAIMessages(proxyMessage, personality, options);
    const requestPayload = {
        model: shouldUseWeb ? 'perplexity/sonar' : (options.modelOverride || currentModel),
        messages: messages,
        max_tokens: options.fastResponse ? 512 : 4096,
        temperature: personality === 'brainstorm' ? 0.95 : 0.7,
        stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.fastResponse ? 15000 : 30000);
    activeResponseAbortController = controller;

    let response;
    try {
        response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
        if (activeResponseAbortController === controller) {
            activeResponseAbortController = null;
        }
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Server proxy error (${response.status}): ${errText}`);
    }

    const responseData = await response.json();
    const responseModel = responseData.model || requestPayload.model || currentModel;
    setLastResponseModel(responseModel);

    // OpenRouter returns errors in the body with HTTP 200 for some failures
    if (responseData.error) {
        const errMsg = (responseData.error.message || JSON.stringify(responseData.error)).substring(0, 300);
        console.error('🔧 Server proxy response body error:', responseData.error);
        if (shouldUseWeb) {
            console.warn('🌐 Web model errored via proxy — falling back to Jina...');
            const jinaResult = await _retryWithJinaFallback('', userMessage);
            if (jinaResult) return { reply: jinaResult, webUsed: true, model: responseModel };
        }
        throw new Error(`Server proxy error: ${errMsg}`);
    }

    if (!responseData.choices || !responseData.choices[0]) {
        if (shouldUseWeb) {
            const jinaResult = await _retryWithJinaFallback('', userMessage);
            if (jinaResult) return { reply: jinaResult, webUsed: true, model: responseModel };
        }
        throw new Error('Invalid server proxy response format');
    }

    const choiceObj = responseData.choices[0];
    let extractedText = extractResponseText(choiceObj);
    if (!extractedText && !shouldUseWeb) {
        if (choiceObj.finish_reason === 'length') {
            extractedText = 'Response was cut off due to length limits. Please ask me to continue.';
        } else {
            throw new Error(`The selected model (${responseModel}) returned an empty response. Please select a different model or try Auto-select.`);
        }
    }

    if (!options.completionAttempt && needsResponseCompletion(extractedText, choiceObj.finish_reason)) {
        console.warn('✍️ Server response appears incomplete; requesting a seamless continuation.', {
            model: responseModel,
            finishReason: choiceObj.finish_reason
        });
        try {
            const continuation = await generateViaServerProxy(
                buildResponseCompletionRequest(userMessage, extractedText),
                personality,
                { ...options, completionAttempt: true, slimContext: true }
            );
            if (continuation.reply) {
                extractedText = `${extractedText} ${continuation.reply}`.trim();
            }
        } catch (error) {
            console.warn('✍️ Automatic continuation failed; preserving the original reply.', error);
        }
    }

    const rawReply = extractedText;
    const jinaOverride = shouldUseWeb ? await _retryWithJinaFallback(rawReply, userMessage) : null;
    if (jinaOverride) {
        console.log('Jina fallback in server proxy');
        return { reply: jinaOverride, webUsed: true, model: responseModel };
    }
    const payloadSources = _extractSourcesFromProviderPayload(responseData);
    const mergedSources = _mergeSourceLists(payloadSources, collectedWebSources);
    const reply = _ensureWebSourcesInReply(rawReply, mergedSources, shouldUseWeb);
    return { reply, webUsed: shouldUseWeb, model: responseModel };
}

// Enhanced AI integration with multi-provider support and improved error handling
async function generateAIResponse(userMessage, personality, options = {}) {
    console.log('🤖 Generating AI response for personality:', personality);
    const responseSender = options.assistant === 'other' ? 'Avon' : 'Nova';

    if (options.fastResponse) {
        const reply = getInstantConversationReply(userMessage, responseSender);
        removeThinkingIndicator();
        addMessage(reply, responseSender);
        conversationHistory.push({ role: 'assistant', content: reply, personality, timestamp: new Date().toISOString() });
        if (typeof window.speakText === 'function') {
            const onEnd = window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function'
                ? () => { window.restoreWakeListeningAfterResponse(); }
                : () => {};
            speakAssistantResponse(reply, responseSender, onEnd);
        }
        return;
    }
    
    // Check if user has configured a provider API key
    const hasUserKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') ||
                       (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '');

    // Try server-side proxy first when no user key is configured
    if (!hasUserKey) {
        console.log('🌐 No user API key configured — trying server proxy (/api/chat)...');
        try {
            const proxyResult = await generateViaServerProxy(userMessage, personality, options);
            const reply = proxyResult.reply;
            const responseModel = proxyResult.model || lastResponseModel || currentModel;
            if (!options.noveltyRetry && isNoveltyReplyDuplicate(userMessage, reply)) {
                console.log('🧠 Novelty reply duplicated prior memory - retrying with stronger instruction');
                await generateAIResponse(userMessage, personality, { ...options, noveltyRetry: true, skipUserHistory: true });
                return;
            }
            removeThinkingIndicator();
            addMessage(reply, responseSender, null, responseModel);
            conversationHistory.push({ role: 'assistant', content: reply, personality, timestamp: new Date().toISOString(), model: responseModel });
            recordNoveltyResponse(userMessage, reply, responseModel);
            if (typeof window.speakText === 'function') {
                if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                    speakAssistantResponse(reply, responseSender, () => { window.restoreWakeListeningAfterResponse(); });
                } else {
                    speakAssistantResponse(reply, responseSender, () => {});
                }
            }
            return;
        } catch (proxyErr) {
            if (window.voiceInterruptInProgress && proxyErr && proxyErr.name === 'AbortError') {
                console.log('🛑 Server proxy request aborted due to user interrupt');
                return;
            }
            if (isPromptLimitErrorMessage(proxyErr.message) && !options.slimContext) {
                console.warn('🌐 Server proxy prompt too large — retrying with slim context');
                await generateAIResponse(userMessage, personality, { ...options, slimContext: true });
                return;
            }
            console.warn('🌐 Server proxy unavailable:', proxyErr.message);
            // Server proxy failed — fall through to show the most useful message we can
            removeThinkingIndicator();
            if (/503|No AI API key configured on server/i.test(proxyErr.message)) {
                addMessage(
                    '⚙️ N.O.V.A requires an AI API key to respond. Please click the ⚙️ Settings button and enter your OpenRouter API key (get one free at <a href="https://openrouter.ai/keys" target="_blank" style="color:#FFD700">openrouter.ai/keys</a>).',
                    'Nova'
                );
            } else {
                addMessage(`❌ AI Error: ${proxyErr.message}`, 'Nova');
            }
            return;
        }
    }

    // Get current provider configuration
    const provider = providerConfig[currentProvider];
    console.log('🚀 Sending request to', currentProvider.toUpperCase(), 'API (', provider.model, ')...');
    
    try {
        // --- Web search / URL fetch ---
        let effectiveMessage = userMessage;
        let requestModel = options.modelOverride || provider.model;
        const webIntent = _resolveWebIntent(userMessage);
        const shouldUseWeb = !!webIntent;
        let collectedWebSources = [];
        if (webIntent) {
            // Update thinking indicator text so user sees we're searching
            const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
            if (thinkingEl) thinkingEl.textContent = _webLoadingText(webIntent);

            if (currentProvider === 'openrouter') {
                // Use a model with built-in web search so this works even when
                // browser-side fetch is blocked by CORS/network.
                requestModel = 'perplexity/sonar';
                effectiveMessage = `${buildWebTaskMessage(userMessage)}
For every internet-derived claim, include a source title and clickable markdown URL.
If the user asked for downloadable resources, prioritize official download pages and direct file links when available.`;
                console.log('🌐 Web intent detected — routing via online model:', requestModel);
            } else {
                // Fallback path for non-OpenRouter providers.
                const webBundle = await getWebSearchContext(userMessage);
                if (webBundle && webBundle.context) {
                    effectiveMessage = `${userMessage}\n\n${webBundle.context}`;
                    collectedWebSources = Array.isArray(webBundle.sources) ? webBundle.sources : [];
                    console.log('🌐 Web context injected, length:', webBundle.context.length, 'sources:', collectedWebSources.length);
                } else {
                    console.warn('🌐 Web search returned no usable content');
                }
            }
        }
        
        // Prepare messages array with conversation history
        const messages = prepareOpenAIMessages(effectiveMessage, personality, options);
        
        const requestPayload = {
            model: requestModel,
            messages: messages,
            max_tokens: options.fastResponse ? 512 : provider.maxTokens,
            temperature: personality === 'brainstorm' ? 0.95 : 0.7,
            stream: false
        };
        
        console.log('🤖', currentProvider.toUpperCase(), 'Request:');
        console.log('🔑 Using API Key:', provider.apiKey ? (provider.apiKey.substring(0, 10) + '...' + provider.apiKey.slice(-4)) : 'NONE');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), options.fastResponse ? 15000 : 30000);
        activeResponseAbortController = controller;
        
        let response;
        try {
            response = await fetch(provider.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${provider.apiKey}`,
                    ...(provider.extraHeaders || {})
                },
                body: JSON.stringify(requestPayload),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
            if (activeResponseAbortController === controller) {
                activeResponseAbortController = null;
            }
        }
        
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

        // OpenRouter (and some providers) return errors in the body with HTTP 200
        if (responseData.error) {
            const errMsg = (responseData.error.message || JSON.stringify(responseData.error)).substring(0, 300);
            console.error('🔧 API returned error in response body:', responseData.error);
            // If this was a web request, try Jina directly before giving up
            if (shouldUseWeb) {
                console.warn('🌐 Web model errored — falling back to direct Jina search...');
                const jinaResult = await _retryWithJinaFallback('', userMessage);
                if (jinaResult) {
                    const fallbackModel = provider.model || currentModel;
                    setLastResponseModel(fallbackModel);
                    removeThinkingIndicator();
                    addMessage(jinaResult, responseSender, null, fallbackModel);
                    conversationHistory.push({ role: 'assistant', content: jinaResult, personality, timestamp: new Date().toISOString(), model: fallbackModel });
                    recordNoveltyResponse(userMessage, jinaResult, fallbackModel);
                    speakAssistantResponse(jinaResult, responseSender);
                    return;
                }
            }
            throw new Error(`${currentProvider.toUpperCase()} API Error: ${errMsg}`);
        }

        const responseModel = responseData.model || requestModel || provider.model || currentModel;
        setLastResponseModel(responseModel);

        // Response format validation
        if (!responseData.choices || !responseData.choices[0]) {
            // If this was a web query, attempt Jina rather than surfacing a cryptic error
            if (shouldUseWeb) {
                console.warn('🌐 Web model returned unexpected format — falling back to Jina...');
                const jinaResult = await _retryWithJinaFallback('', userMessage);
                if (jinaResult) {
                    removeThinkingIndicator();
                    addMessage(jinaResult, responseSender, null, responseModel);
                    conversationHistory.push({ role: 'assistant', content: jinaResult, personality, timestamp: new Date().toISOString(), model: responseModel });
                    recordNoveltyResponse(userMessage, jinaResult, responseModel);
                    speakAssistantResponse(jinaResult, responseSender);
                    return;
                }
            }
            throw new Error(`Invalid ${currentProvider.toUpperCase()} response format`);
        }
        
        const choiceObjDirect = responseData.choices[0];
        let extractedTextDirect = extractResponseText(choiceObjDirect);
        if (!extractedTextDirect && !shouldUseWeb) {
            if (choiceObjDirect.finish_reason === 'length') {
                extractedTextDirect = 'Response was cut off due to length limits. Please ask me to continue.';
            } else {
                throw new Error(`The selected model (${responseModel}) returned an empty response. Please select a different model or try Auto-select.`);
            }
        }

        if (!options.completionAttempt && needsResponseCompletion(extractedTextDirect, choiceObjDirect.finish_reason)) {
            console.warn('✍️ Direct provider response appears incomplete; requesting a seamless continuation.', {
                model: responseModel,
                finishReason: choiceObjDirect.finish_reason
            });
            const completionPayload = {
                ...requestPayload,
                messages: prepareOpenAIMessages(
                    buildResponseCompletionRequest(userMessage, extractedTextDirect),
                    personality,
                    { ...options, completionAttempt: true, slimContext: true }
                ),
                max_tokens: 2048
            };
            try {
                const completionResponse = await fetch(provider.apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${provider.apiKey}`,
                        ...(provider.extraHeaders || {})
                    },
                    body: JSON.stringify(completionPayload)
                });
                if (!completionResponse.ok) {
                    throw new Error(`${currentProvider.toUpperCase()} continuation API error (${completionResponse.status})`);
                }
                const completionData = await completionResponse.json();
                if (completionData.error) {
                    throw new Error(`${currentProvider.toUpperCase()} continuation API error: ${completionData.error.message || JSON.stringify(completionData.error)}`);
                }
                const completionText = extractResponseText(completionData.choices?.[0]);
                if (completionText) {
                    extractedTextDirect = `${extractedTextDirect} ${completionText}`.trim();
                }
            } catch (error) {
                console.warn('✍️ Automatic continuation failed; preserving the original reply.', error);
            }
        }

        const rawReply = extractedTextDirect;
        const jinaOverrideDirect = shouldUseWeb ? await _retryWithJinaFallback(rawReply, userMessage) : null;
        if (jinaOverrideDirect) {
            console.log('Jina fallback in direct path');
            removeThinkingIndicator();
            addMessage(jinaOverrideDirect, responseSender, null, responseModel);
            conversationHistory.push({ role: 'assistant', content: jinaOverrideDirect, personality, timestamp: new Date().toISOString(), model: responseModel });
            recordNoveltyResponse(userMessage, jinaOverrideDirect, responseModel);
            speakAssistantResponse(jinaOverrideDirect, responseSender);
            return;
        }
        const payloadSources = _extractSourcesFromProviderPayload(responseData);
        const mergedSources = _mergeSourceLists(collectedWebSources, payloadSources);
        const reply = _ensureWebSourcesInReply(rawReply, mergedSources, shouldUseWeb);
        console.log('✅', currentProvider.toUpperCase(), 'Response Success - Length:', reply.length, 'characters');
        console.log('🎭 Personality:', personality);

        if (!options.noveltyRetry && isNoveltyReplyDuplicate(userMessage, reply)) {
            console.log('🧠 Novelty reply duplicated prior memory - retrying with stronger instruction');
            await generateAIResponse(userMessage, personality, { ...options, noveltyRetry: true, skipUserHistory: true });
            return;
        }
        
        // Remove thinking indicator
        removeThinkingIndicator();
        
        // Add response to chat
        addMessage(reply, responseSender, null, responseModel);
        
        // Save to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: reply,
            personality: personality,
            timestamp: new Date().toISOString(),
            model: responseModel
        });
        recordNoveltyResponse(userMessage, reply, responseModel);
        
        // Speak response if voice is enabled (with proper voice coordination)
        if (typeof window.speakText === 'function') {
            console.log('🔊 AI Response: Starting voice output with coordination...');
            console.log('🔊 AI Response: isWakeWordSession =', window.isWakeWordSession);
            
            // Only add restoration callback if this is a wake word session
            if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                speakAssistantResponse(reply, responseSender, () => {
                    console.log('🔊 AI Response: Voice output completed');
                    console.log('🔊 AI Response complete - restoring wake listening');
                    window.restoreWakeListeningAfterResponse();
                });
            } else {
                speakAssistantResponse(reply, responseSender, () => {
                    console.log('🔊 AI Response: Voice output completed (push-to-talk mode)');
                });
            }
        }
        
    } catch (error) {
        console.error('🔧 DEBUG - Full error object:', error);
        console.error('🔧 DEBUG - Error message:', error.message);
        console.error('🔧 DEBUG - Error stack:', error.stack);

        if (window.voiceInterruptInProgress && error && error.name === 'AbortError') {
            console.log('🛑 AI request aborted due to user interrupt');
            return;
        }

        if (isPromptLimitErrorMessage(error.message) && !options.slimContext) {
            console.warn('🔄 Prompt too large — retrying with slim context');
            try {
                await generateAIResponse(userMessage, personality, { ...options, slimContext: true });
                return;
            } catch (retryError) {
                console.error('🔧 Slim-context retry failed:', retryError);
            }
        }
        
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
                await generateAIResponse(userMessage, personality, options);
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
            addMessage(errorMsg, responseSender);
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


// ============================================================
// WEB SEARCH MODULE — Jina AI (free, no API key required)
//   r.jina.ai/{url}    — fetch any webpage as clean markdown
//   s.jina.ai/{query}  — search the web, returns top results
// ============================================================

const _WEB_URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

// Explicit web intent: URL present OR clear search/browse keywords
const _WEB_INTENT_RE = /\b(search(?:\s+(?:for|the\s+web|online))?|look\s*(?:it\s+)?up|browse|visit|go\s+to|open\s+(?:the\s+)?(?:site|page|link|url|website)|fetch|check\s+(?:the\s+)?(?:website|page|site)|(?:their|its|the)\s+(?:website|webpage|web\s+page|site)|(?:find|get)\s+(?:online|on\s+the\s+web|current|real.?time|live)|latest\s+news|current\s+news|real.?time|what(?:'?s?|\s+is)\s+(?:on|at)\s+(?:the\s+)?(?:website|site|page)|download(?:able|s)?|installer|setup\s+file|github\s+release|official\s+download|apk|exe|dmg|zip\s+file|pdf\s+download|dataset|what(?:'?s?|\s+is)\s+(?:current|new|happening|going\s+on|trending|breaking)\s*(?:in|with|at|on|for)?|what(?:'?s?|\s+is)\s+(?:new\s+)?(?:in|with|at|on)\s+\w|update\s+on\s+|news\s+(?:about|on|for)|(?:latest|recent)\s+(?:on|in|about|from)|today\s+in|this\s+week\s+in|what'?s?\s+new|whats\s+new|whats\s+(?:current|happening|going)\s+|what\s+is\s+(?:current|happening|going))\b/i;
const _FACT_LOOKUP_RE = /\b(what\s+is|who\s+is|where\s+is|when\s+is|why\s+is|how\s+to|latest|current|news|price|specs?|release\s+date|documentation|docs|official|best|top\s+\d+|compare|review|download(?:able|s)?|template|example|guide|tutorial|dataset|statistics?|evidence|research|according\s+to|source|happening|update|recent|today|tonight|this\s+week|this\s+year|trending|breaking|announce[dm]|launch[ed]?|reveal[ed]?|new\s+in|2025|2026)\b/i;
const _EDUCATIONAL_LOOKUP_RE = /\b(explain|teach\s+me|help\s+me\s+learn|learn\s+about|how\s+does|why\s+does|why\s+do|meaning\s+of|definition\s+of|difference\s+between|pros\s+and\s+cons|advantages?\s+and\s+disadvantages?|is\s+.+\s+(?:good|safe|accurate|worth)|understand)\b/i;
const _LOCAL_TASK_RE = /\b(this\s+(?:chat|conversation|file|project|repo|code|snippet)|from\s+my\s+(?:notes|knowledge\s+base)|summari[sz]e\s+(?:this|above)|rewrite|rephrase|translate|fix\s+my\s+code|debug\s+this|remember\s+that)\b/i;
const _CASUAL_CHAT_RE = /\b(hi|hello|hey|how are you|thanks|thank you|good morning|good night|tell me a joke|who are you)\b/i;
const _STOPWORD_SET = new Set([
    'the','and','for','with','that','this','from','have','what','when','where','which','about','your','please','could','would','there','their','they','them','into','just','some','more','than','then','also','does','dont','cant','want','need','help','find','give','show','tell','make'
]);


// Detects model responses that refuse web access so we can retry with Jina context
const _CANT_BROWSE_RE = /\b(i\s+(?:can'?t|cannot|don'?t|do\s+not|am\s+unable\s+to)\s+(?:browse|search\s+the\s+(?:web|internet)|access\s+(?:the\s+)?(?:internet|web|real.?time\s+data)|perform\s+(?:web|internet)\s+searches?|retrieve\s+(?:live|real.?time|current)\s+info)|i\s+don'?t\s+have\s+(?:real.?time|live|current|internet|web)\s+(?:access|data|browsing|information|capabilities)|my\s+(?:training\s+data|knowledge)\s+(?:has\s+a\s+cutoff|only\s+goes\s+up\s+to)|my\s+knowledge\s+(?:cutoff|goes\s+up)|as\s+of\s+my\s+(?:last\s+)?(?:training|knowledge)|i\s+(?:am\s+)?unable\s+to\s+(?:browse|search|access)\s+(?:the\s+)?(?:internet|web))\b/i;

// Fetch Jina results and synthesize an answer when the model refuses to browse
// or when called directly as a fallback (rawReply can be empty string).
async function _retryWithJinaFallback(rawReply, userMessage) {
    if (rawReply && !_CANT_BROWSE_RE.test(rawReply)) return null;
    console.warn('🌐 Web refusal detected — overriding with direct Jina search...');
    try {
        const jinaResult = await _jinaSearch(userMessage);
        if (!jinaResult) return null;
        const sources = _extractSourcesFromText(jinaResult);
        const lines = jinaResult.split('\n').filter(l => {
            const t = l.trim();
            return t.length > 15 && !/^(Jina AI|Results for|Search results|URL:|Title:|Published:|Source:)/i.test(t);
        }).slice(0, 40);
        let result = `Here's what I found with a live web search:\n\n${lines.join('\n')}`;
        if (sources.length) {
            result += '\n\n---\n**Sources & References**\n';
            for (const src of sources.slice(0, 6)) {
                result += `- ${src.title}\n  Link: [${src.url}](${src.url})\n`;
            }
            result += '\n**Where to get more**\n';
            for (const src of sources.slice(0, 4)) {
                result += `- ${src.title}: [${src.url}](${src.url})\n`;
            }
        }
        return result;
    } catch (e) {
        console.warn('🌐 Jina fallback failed:', e.message);
        return null;
    }
}
function _detectWebIntent(message) {
    const urls = message.match(_WEB_URL_RE) || [];
    if (urls.length) return { type: 'url', urls };
    if (_WEB_INTENT_RE.test(message)) return { type: 'search', query: message };
    return null;
}

function _tokenizeForLocalMatch(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 4 && !_STOPWORD_SET.has(t));
}

function _hasLikelyLocalKnowledge(message) {
    if (!Array.isArray(persistentMaterial) || persistentMaterial.length === 0) {
        return false;
    }

    const tokens = Array.from(new Set(_tokenizeForLocalMatch(message))).slice(0, 10);
    if (tokens.length === 0) return false;

    const localCorpus = persistentMaterial
        .slice(0, 20)
        .map(item => `${item.name || ''}\n${item.content || ''}`)
        .join('\n')
        .toLowerCase();

    let matches = 0;
    for (const token of tokens) {
        if (localCorpus.includes(token)) {
            matches += 1;
            if (matches >= 2) return true;
        }
    }
    return false;
}

function _resolveWebIntent(message) {
    const explicit = _detectWebIntent(message);
    if (explicit) return explicit;

    const text = String(message || '').trim();
    if (!text || _LOCAL_TASK_RE.test(text) || _CASUAL_CHAT_RE.test(text)) return null;

    const factualRequest = _FACT_LOOKUP_RE.test(text) || _EDUCATIONAL_LOOKUP_RE.test(text);
    if (!factualRequest) return null;

    if (_hasLikelyLocalKnowledge(text)) {
        return null;
    }

    return { type: 'auto', query: text };
}

function _webLoadingText(intent) {
    return intent.type === 'url'
        ? `🌐 Fetching page content...`
        : intent.type === 'auto'
            ? `🌐 Checking live web sources...`
            : `🔍 Searching the web...`;
}

const _IDENTITY_QUESTION_RE = /\b(who\s+are\s+you|what\s+(?:is|are)\s+(?:your\s+name|you|nova|n\.?o\.?v\.?a\.?)|what\s+does\s+n\.?o\.?v\.?a\.?\s+stand|tell\s+me\s+about\s+yourself|your\s+(?:name|identity|purpose|full\s+name)|introduce\s+yourself|what(?:'s|\s+is)\s+your\s+name|do\s+you\s+know\s+your\s+name|are\s+you\s+nova)\b/i;

function getIdentityKnowledgeBaseItems() {
    if (!Array.isArray(persistentMaterial) || persistentMaterial.length === 0) return [];
    const identityGroupNames = ['who you are', 'identity', 'about nova', 'about me', 'persona', 'about', 'your identity', 'self'];
    return persistentMaterial.filter(item => {
        const group = String(item.groupName || '').toLowerCase().trim();
        return identityGroupNames.some(name => group.includes(name));
    });
}

function getIdentityKnowledgeBaseContext() {
    const items = getIdentityKnowledgeBaseItems();
    if (items.length === 0) return '';
    return getPersistentMaterialContext(items, 4000, 2000);
}

function shouldInjectKnowledgeBaseContext(message, personality, options = {}) {
    if (options.slimContext) return false;

    const text = String(message || '').trim();
    if (!text || !Array.isArray(persistentMaterial) || persistentMaterial.length === 0) {
        return false;
    }

    if (personality === 'study') return true;

    // Always inject KB for identity/self-reference questions so Nova knows its own name
    if (_IDENTITY_QUESTION_RE.test(text)) return true;

    return _LOCAL_TASK_RE.test(text) ||
        /\b(knowledge\s+base|my\s+(notes|file|document|pdf|slides)|uploaded|attachment|attached|from\s+the\s+(file|pdf|document)|use\s+my\s+notes)\b/i.test(text) ||
        _hasLikelyLocalKnowledge(text);
}

async function _jinaFetch(url) {
    try {
        const r = await fetch(`https://r.jina.ai/${url}`, {
            headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        return text.slice(0, 9000);
    } catch (e) {
        console.warn('🌐 Jina fetch failed:', url, e.message);
        return null;
    }
}

async function _jinaSearch(query) {
    try {
        const r = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
            headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        return text.slice(0, 9000);
    } catch (e) {
        console.warn('🔍 Jina search failed:', e.message);
        return null;
    }
}

function _normalizeSourceUrl(url) {
    try {
        const parsed = new URL(String(url || '').trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch (error) {
        return null;
    }
}

function _sourceTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const parts = parsed.pathname.split('/').filter(Boolean);
        const tail = parts.length ? parts[parts.length - 1].replace(/[-_]+/g, ' ') : '';
        return tail ? `${host} — ${tail}` : host;
    } catch (error) {
        return String(url || 'Source');
    }
}

function _extractSourcesFromText(text) {
    const sources = [];
    const seen = new Set();
    const raw = String(text || '');

    raw.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, title, url) => {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return match;
        seen.add(normalizedUrl);
        sources.push({ title: String(title || '').trim() || _sourceTitleFromUrl(normalizedUrl), url: normalizedUrl });
        return match;
    });

    raw.replace(/(?:^|\s)(https?:\/\/[^\s<>"')\]]+)/g, (match, url) => {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return match;
        seen.add(normalizedUrl);
        sources.push({ title: _sourceTitleFromUrl(normalizedUrl), url: normalizedUrl });
        return match;
    });

    return sources.slice(0, 12);
}

function _extractSourcesFromProviderPayload(responseData) {
    const sources = [];
    const seen = new Set();

    function add(url, title) {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return;
        seen.add(normalizedUrl);
        sources.push({
            title: String(title || '').trim() || _sourceTitleFromUrl(normalizedUrl),
            url: normalizedUrl
        });
    }

    const candidates = [];
    if (Array.isArray(responseData?.citations)) candidates.push(...responseData.citations);
    if (Array.isArray(responseData?.sources)) candidates.push(...responseData.sources);

    const message = responseData?.choices?.[0]?.message;
    if (Array.isArray(message?.citations)) candidates.push(...message.citations);
    if (Array.isArray(message?.sources)) candidates.push(...message.sources);
    if (Array.isArray(message?.annotations)) candidates.push(...message.annotations);

    for (const item of candidates) {
        if (!item) continue;
        if (typeof item === 'string') {
            add(item, '');
        } else {
            add(item.url || item.link || item.href, item.title || item.name || item.source);
        }
    }

    const modelText = message?.content || '';
    const inlineSources = _extractSourcesFromText(modelText);
    for (const src of inlineSources) add(src.url, src.title);

    return sources.slice(0, 12);
}

function _mergeSourceLists(...lists) {
    const merged = [];
    const seen = new Set();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (!item || !item.url) continue;
            const normalizedUrl = _normalizeSourceUrl(item.url);
            if (!normalizedUrl || seen.has(normalizedUrl)) continue;
            seen.add(normalizedUrl);
            merged.push({
                title: String(item.title || '').trim() || _sourceTitleFromUrl(normalizedUrl),
                url: normalizedUrl
            });
        }
    }
    return merged.slice(0, 12);
}

function _ensureWebSourcesInReply(reply, sources, webWasUsed) {
    const text = String(reply || '').trim();
    if (!webWasUsed) return text;

    const hasSourcesHeader = /sources\s*&\s*references|sources\s*:|references\s*:|\bsource\b/i.test(text);
    const hasMarkdownLinks = /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/i.test(text) || /(?:^|\s)(https?:\/\/[^\s<>'")\]]+)/i.test(text);
    const hasWhereToGetMoreHeader = /where\s+to\s+get\s+more|learn\s+more|further\s+reading|additional\s+resources|official\s+links/i.test(text);

    const mergedSources = _mergeSourceLists(sources, _extractSourcesFromText(text));
    const sourceLines = [
        '',
        '---',
        '**Sources & References**'
    ];
    const moreLines = [
        '',
        '**Where to get more**'
    ];

    if (mergedSources.length === 0) {
        // Avoid leaving dangling [1]/[2] style citations with no actual links.
        return text.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    for (const src of mergedSources.slice(0, 8)) {
        sourceLines.push(`- ${src.title}`);
        sourceLines.push(`  Link: [${src.url}](${src.url})`);
    }

    for (const src of mergedSources.slice(0, 5)) {
        moreLines.push(`- ${src.title}: [${src.url}](${src.url})`);
    }

    const needsSourcesSection = !(hasSourcesHeader && hasMarkdownLinks);
    const needsWhereToGetMoreSection = !hasWhereToGetMoreHeader;
    if (!needsSourcesSection && !needsWhereToGetMoreSection) {
        return text;
    }

    let output = text;
    if (needsSourcesSection) {
        output += `\n${sourceLines.join('\n')}`;
    }
    if (needsWhereToGetMoreSection) {
        output += `\n${moreLines.join('\n')}`;
    }

    return output;
}

async function getWebSearchContext(userMessage) {
    const intent = _resolveWebIntent(userMessage);
    if (!intent) return null;

    console.log('🌐 Web intent detected:', intent.type);

    if (intent.type === 'url') {
        const blocks = [];
        const sources = [];
        for (const url of intent.urls.slice(0, 2)) {
            const content = await _jinaFetch(url);
            if (content) {
                blocks.push(`=== LIVE PAGE CONTENT: ${url} ===\n${content}\n=== END PAGE CONTENT ===`);
                const pageSources = _extractSourcesFromText(content);
                const titleLine = content.match(/^Title:\s*(.+)$/im);
                sources.push({ title: titleLine ? titleLine[1].trim() : _sourceTitleFromUrl(url), url });
                sources.push(...pageSources);
            }
        }
        if (!blocks.length) return null;
        return { context: blocks.join('\n\n'), sources: _mergeSourceLists(sources) };
    }

    // Search
    const query = intent.query || userMessage;
    const result = await _jinaSearch(query);
    if (!result) return null;
    const sources = _extractSourcesFromText(result);
    return {
        context: `=== LIVE WEB SEARCH RESULTS ===\n${result}\n=== END SEARCH RESULTS ===`,
        sources: _mergeSourceLists(sources)
    };
}

// ============================================================
// END WEB SEARCH MODULE
// ============================================================


function prepareOpenAIMessages(userMessage, personality, options = {}) {
    console.log('📝 Preparing messages for OpenAI with personality:', personality);
    
    // Get personality config
    const config = personalities[personality] || personalities.Nova;
    const isAvon = options.assistant === 'other';
    
    // Build personality-specific instructions
    const isSlimContext = !!options.slimContext;
    const isWebBackedRequest = !!_resolveWebIntent(userMessage) || /=== LIVE PAGE CONTENT|=== LIVE WEB SEARCH RESULTS ===/i.test(String(userMessage || ''));
    const isAudioBackedRequest = /AUDIO ANALYSIS PACKET|I've uploaded an audio file/i.test(String(userMessage || ''));
    let personalityInstructions = '';
    if (isAudioBackedRequest) {
        personalityInstructions = isSlimContext
            ? 'Analyze the uploaded audio transcript faithfully. Preserve timestamps and speaker labels when present, summarize the key ideas, and answer the user’s specific question without inventing missing words or identities.'
            : 'Treat the uploaded audio transcript as a primary source. First understand its setting (lecture, classroom, meeting, interview, or conversation) from the content. Preserve timestamps and speaker labels when present, clearly separate what was said from your interpretation, and never invent speaker identities. For lectures, act as the professor: organize the material into concepts, definitions, examples, misconceptions, exam-relevant points, and a step-by-step tutoring path. Offer a concise summary first, then teach any requested concept with examples and a check-for-understanding. For meetings or interviews, identify decisions, action items, owners, and unresolved questions.';
    } else if (personality === 'study' || personality === 'professor') {
        personalityInstructions = isSlimContext
            ? 'Act as an exceptionally efficient tutor: identify the learner goal, explain the key idea step by step, define essential terms, and give a concise check-for-understanding.'
            : 'Act as an exceptionally effective tutor and teacher. First infer the learner goal and current level, then scaffold the explanation from intuition to precise detail. Define essential terms, use a concrete example, show the reasoning rather than only the answer, call out common mistakes, and end with a brief check-for-understanding or next practice step. Adapt when the learner is confused and never make them feel judged.';
    } else {
        personalityInstructions = isSlimContext
            ? 'Be helpful, direct, accurate, and conversational. Answer the actual question, preserve continuity with the conversation, and avoid unnecessary filler.'
            : `Be an excellent conversational partner: listen for the user's intent and emotional context, answer naturally, remember relevant details from the conversation, ask a useful follow-up only when it genuinely helps, and avoid repetitive canned phrasing.
Be clear, accurate, efficient, and warm. Explain difficult ideas simply without talking down to the user. When teaching, use progressive disclosure: short answer first, then detail, examples, and a practical next step.
If you are N.O.V.A, keep a witty but efficient British assistant tone without overusing "sir" or theatrical phrases.
If live web blocks are included, treat them as current evidence and use them directly.`;
    }

    const ownerIdentityUnlocked = shouldInjectOwnerKnowledge(userMessage);
    const includeKnowledgeBase = ownerIdentityUnlocked || shouldInjectKnowledgeBaseContext(userMessage, personality, options);
    const knowledgeBaseItems = includeKnowledgeBase
        ? (ownerIdentityUnlocked
            ? persistentMaterial
            : getRelevantPersistentMaterial(userMessage, isSlimContext ? 2 : 4, true))
        : [];

    // Always inject identity KB items (from "Who you are" group) so Nova always knows its own identity
    // N.O.V.A.'s reference material can describe N.O.V.A.'s identity. Do not
    // give it to A.V.O.N., whose distinct identity must never be overwritten.
    const identityContext = isSlimContext || isAvon ? '' : getIdentityKnowledgeBaseContext();
    const ownerIdentityKnowledge = !isAvon && ownerIdentityUnlocked && Array.isArray(persistentMaterial) && persistentMaterial.length > 0
        ? getPersistentMaterialContext(persistentMaterial, isSlimContext ? 1800 : 12000, isSlimContext ? 900 : 2500)
        : '';

    // Inject persistent Knowledge Base, user profile, and real-time data into context
    const novaStyleContext = isSlimContext || isAvon ? '' : getnovaStyleReferenceContext(personality);
    const directiveContext = includeKnowledgeBase
        ? getKnowledgeBaseDirectiveContext(knowledgeBaseItems, isSlimContext ? 8 : KNOWLEDGE_BASE_DIRECTIVE_MAX_LINES)
        : '';
    const materialContext = includeKnowledgeBase
        ? getPersistentMaterialContext(knowledgeBaseItems, isSlimContext ? 1800 : 12000, isSlimContext ? 900 : 2500)
        : '';
    const noveltyContext = getNoveltyMemoryContext(userMessage, options);
    const profileContext = getUserProfileContext(userMessage);
    const realtimeContext = getRealtimeContextString({ slim: isSlimContext || isWebBackedRequest });
    const assistantKey = options.assistant === 'other' ? 'other' : 'nova';
    const selectedPreset = assistantPresetSelections?.[assistantKey];
    const presetConfig = selectedPreset ? ASSISTANT_PERSONALITY_PRESETS?.[selectedPreset] : null;

    // System message with personality
    const systemMessage = {
        role: "system",
        content: [
            isAvon
                ? 'You are A.V.O.N. Your name is A.V.O.N., not N.O.V.A, Nova, or any variation of N.O.V.A. You are a distinct assistant in this system. Never claim to be N.O.V.A, never expand N.O.V.A., and never correct a user by saying they meant N.O.V.A. When your name is misspelled, politely identify yourself as A.V.O.N. and continue helping.'
                : 'You are N.O.V.A., which stands for Networking Orthogonal Virtual Assistant. Your name is N.O.V.A., not A.V.O.N. You are a distinct assistant in this system and must accurately state your full name when asked.',
            'You are ' + (isAvon ? 'A.V.O.N.' : 'N.O.V.A') + ', a ' + config.style + '.',
            options.groupChat
                ? options.individualChat
                    ? `You are participating in a group-chat system, but the user selected a one-on-one conversation with you. You are ${options.assistant === 'other' ? 'A.V.O.N.' : 'N.O.V.A'}. The other assistant is muted for this turn and will not respond. Address the user directly as their sole assistant; never speak for, mention a response from, or impersonate the other assistant.`
                    : `You are participating in a group chat with two distinct assistants: N.O.V.A and A.V.O.N. You are ${options.assistant === 'other' ? 'A.V.O.N.' : 'N.O.V.A'}. Only answer as your assigned assistant, never impersonate the other assistant, and keep your response relevant to the user message.`
                : '',
            options.conversationPartner
                ? `For this continuation, you are responding directly to ${options.conversationPartner}'s message. Address ${options.conversationPartner} as your fellow assistant, preserve the topic and context, and do not claim to be them.`
                : '',
            personalityInstructions,
            novaStyleContext,
            identityContext,
            ownerIdentityKnowledge,
            directiveContext,
            materialContext,
            noveltyContext,
            profileContext,
            realtimeContext,
            '',
            'Current active mode: ' + config.name + ' Mode.',
            'If the user asks what mode you are on, answer with the current active mode above.',
            '',
            'Rules:',
            '- Complete your thought before ending a response. Never end mid-sentence, after a trailing comma, or with an unfinished clause. If space is limited, give a concise complete answer instead of beginning extra content you cannot finish.',
            '- You have real-time web search capability. Proactively search when a question is factual, educational, research-oriented, current, uncertain, asks for a definition/explanation/comparison, or would benefit from reliable external evidence. Do not wait for the user to say "look it up"; do not search for simple greetings, casual conversation, or tasks fully grounded in the user-provided text/files.',
            '- NEVER say you cannot browse, cannot search the web, or do not have internet access. If a search fails, be transparent that live verification failed rather than presenting unverified current claims as certain.',
            isAvon
                ? '- Knowledge Base blocks may contain information about N.O.V.A. They are not your identity. Your identity is always A.V.O.N.; never call yourself N.O.V.A. or expand N.O.V.A., even if another context block says otherwise.'
                : '- If Knowledge Base blocks are included, treat them as highest-priority user context. This includes your identity information — use it to answer questions about who you are, your name, and your purpose.',
            '- For AUDIO ANALYSIS PACKET content, treat the transcript as the primary source. Do not invent words, timestamps, speaker identities, or facts not supported by it.',
            '- If the message includes "=== LIVE PAGE CONTENT" or "=== LIVE WEB SEARCH RESULTS ===", treat that as current web data and use it directly.',
            '- For every web-backed answer, cite web-derived claims inline with clickable markdown links where possible, then end with BOTH sections: "Sources & References" and "Where to get more". Each must use source title plus a full clickable markdown URL.',
            '- Prefer official documentation, primary research, government sources, and first-party announcements for factual claims. Do not cite a search engine or Jina as the authority when the underlying source is available.',
            '- Use clear headings, short paragraphs, bullets, and numbered steps instead of dense walls of text. Format mathematics for readability: put standalone equations on their own line using $$...$$, use \\(...\\) for inline math, and do not bury formulas in ordinary prose. Use subscripts and superscripts where helpful, for example $$sigmoid(x_i) = 1 / (1 + e^{-x_i})$$.',
            assistantPersonalities?.nova && options.assistant !== 'other' ? `Custom N.O.V.A personality knowledge:\n${assistantPersonalities.nova}` : '',
            assistantPersonalities?.other && options.assistant === 'other' ? `Custom A.V.O.N. personality knowledge:\n${assistantPersonalities.other}` : '',
            presetConfig ? `Active ${assistantKey === 'other' ? 'A.V.O.N.' : 'N.O.V.A'} personality preset (${presetConfig.name}):\n${presetConfig.instructions}` : '',
            isAvon
                ? 'Final identity check: You are A.V.O.N. For "who are you?" answer that you are A.V.O.N. Do not say "I am N.O.V.A." or "I am a Networking Orthogonal Virtual Assistant."'
                : 'Final identity check: You are N.O.V.A., Networking Orthogonal Virtual Assistant. For "who are you?" answer as N.O.V.A., never as A.V.O.N.',
            '- Never invent URLs, citations, or DOIs.'
        ].filter(Boolean).join('\n')
   };
    
    // Build messages array starting with system message
    const messages = [systemMessage];
    
    // Add recent conversation history (last 6 messages to avoid token limits)
    const historyLimit = isSlimContext ? 1 : (isWebBackedRequest ? 4 : includeKnowledgeBase ? 6 : 8);
    const historyCharLimit = isSlimContext ? CONTEXT_HISTORY_CHAR_LIMIT_SLIM : CONTEXT_HISTORY_CHAR_LIMIT;
    const historyTotalCharLimit = isSlimContext ? CONTEXT_HISTORY_TOTAL_CHARS_SLIM : (isWebBackedRequest ? 2200 : CONTEXT_HISTORY_TOTAL_CHARS);
    const recentHistory = conversationHistory.slice(-historyLimit);
    let historyCharsUsed = 0;
    for (const msg of recentHistory) {
        const summarizedContent = summarizeMessageForContext(msg.content, historyCharLimit);
        if (!summarizedContent) continue;
        if (historyCharsUsed + summarizedContent.length > historyTotalCharLimit) {
            break;
        }
        messages.push({
            role: msg.role,
            content: summarizedContent
        });
        historyCharsUsed += summarizedContent.length;
    }
    
    // Add current user message
    messages.push({
        role: "user",
        content: userMessage
    });
    
    // Save user message to history
    if (!options.skipUserHistory) {
        conversationHistory.push({
            role: 'user',
            content: userMessage,
            personality: personality,
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('📤 Prepared messages array:', messages);
    return messages;
}

// Note: Default responses removed - now using OpenAI exclusively for intelligent responses
