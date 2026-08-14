// Runtime file upload + formatting module
// Extracted from nova_runtime_features.js.

function setupFileUploadListeners() {
    console.log('📎 Setting up file upload listeners...');
    
    // Verify file menu exists
    const fileMenu = document.getElementById('fileMenu');
    const attachBtn = document.getElementById('attachBtn');
    console.log('📎 File menu found:', !!fileMenu);
    console.log('📎 Attach button found:', !!attachBtn);
    
    // File option buttons
    const fileOptions = document.querySelectorAll('.file-option');
    console.log('📎 File options found:', fileOptions.length);
    
    fileOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const type = option.dataset.type;
            console.log('📎 File option clicked:', type);
            
            const fileInput = document.getElementById(`${type}FileInput`);
            if (fileInput) {
                console.log('📎 File input found for type:', type);
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
    const audioInput = document.getElementById('audioFileInput');
    console.log('📎 Audio file input found:', !!audioInput);
    
    document.getElementById('textFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Text file selected');
        handleFileUpload(e, 'text');
    });
    document.getElementById('imageFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Image file selected');
        handleFileUpload(e, 'image');
    });
    document.getElementById('pdfFileInput')?.addEventListener('change', (e) => {
        console.log('📎 PDF file selected');
        handleFileUpload(e, 'pdf');
    });
    document.getElementById('codeFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Code file selected');
        handleFileUpload(e, 'code');
    });
    document.getElementById('audioFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Audio file selected');
        handleFileUpload(e, 'audio');
    });
    
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

function sanitizeMessageUrl(url) {
    try {
        const normalizedUrl = String(url || '').trim().replace(/[),.;!?]+$/g, '');
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
        return parsedUrl.href;
    } catch (error) {
        return null;
    }
}

function stripHtmlTags(text) {
    return String(text || '').replace(/<[^>]*>/g, '').trim();
}

function buildSafeMessageLink(url, label) {
    const safeUrl = sanitizeMessageUrl(url);
    if (!safeUrl) {
        return null;
    }

    const safeLabel = stripHtmlTags(label) || safeUrl;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(safeLabel)}</a>`;
}

// Format message content with proper line breaks and markdown-style formatting
function formatMessageContent(text) {
    if (!text) return '';
    
    let formatted = text;
    const placeholders = [];

    function storePlaceholder(value) {
        placeholders.push(value);
        return `###PLACEHOLDER${placeholders.length - 1}###`;
    }

    // Preserve safe raw HTML links generated by app messages or model output
    formatted = formatted.replace(/<a\s+[^>]*href=(["'])(https?:\/\/[^"'<>]+)\1[^>]*>(.*?)<\/a>/gi, (match, quote, url, label) => {
        const safeLink = buildSafeMessageLink(url, label);
        return safeLink ? storePlaceholder(safeLink) : match;
    });
    
    // Convert numbered lists with bold formatting (before general bold processing)
    // Match patterns like "**1:" or "**1." followed by content
    formatted = formatted.replace(/\*\*(\d+)[:.]\s*/g, '\n<strong>$1.</strong> ');
    
    // Convert markdown-style links to safe clickable HTML
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
        const safeLink = buildSafeMessageLink(url, label);
        return safeLink ? storePlaceholder(safeLink) : match;
    });

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

    // Convert bare URLs to safe clickable HTML
    formatted = formatted.replace(/(^|[\s>(])((https?:\/\/[^\s<]+))/gi, (match, prefix, url) => {
        const safeLink = buildSafeMessageLink(url, url);
        return safeLink ? `${prefix}${storePlaceholder(safeLink)}` : match;
    });
    
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
    formatted = formatted.replace(tagPattern, (match) => {
        return storePlaceholder(match);
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

