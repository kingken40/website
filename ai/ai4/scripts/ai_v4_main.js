// ========================================
// CORE VARIABLES
// ========================================

let chatHistory = [];
let conversationStarted = false;
let messageCount = 0;
let currentSessionId = null;

// DOM elements
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCounter = document.getElementById('charCounter');
const inputContainer = document.querySelector('.input-container');
const fileInput = document.getElementById('fileInput');
const fileUploadMenu = document.getElementById('fileUploadMenu');

// ========================================
// OPENAI API CONFIGURATION  
// ========================================

// TODO: Replace with your own OpenAI API key
// Get your API key from: https://platform.openai.com/api-keys
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ========================================
// AI PERSONALITY SYSTEM - ENHANCED
// ========================================

let currentPersonality = 'assistant'; // Default personality

const personalities = {
    assistant: {
        name: "🤖 Professional Assistant",
        system: "You are a professional, helpful AI teaching assistant. Provide clear, accurate, and well-structured answers. Be friendly but maintain academic professionalism. Remember our conversation context and build upon previous messages. When creating diagrams, use Mermaid syntax wrapped in ```mermaid code blocks. Create dynamic diagrams based on the specific request rather than generic examples."
    },
    creative: {
        name: "💡 Creative Mentor",
        system: "You are a creative, inspiring AI mentor with an artistic soul. Use vivid language, metaphors, and innovative thinking. Help brainstorm creative solutions and think outside the box. Be inspiring and expressive while remembering our creative journey together."
    },
    coder: {
        name: "🧑‍💻 Programming Expert",
        system: "You are an expert programming mentor and software engineering professor. Provide clear code examples, explain concepts step-by-step, suggest best practices, and help debug issues. Focus on practical, working solutions while remembering our coding discussions. For diagrams (architecture, flowcharts, etc.), use Mermaid syntax in ```mermaid code blocks to create dynamic, relevant visualizations."
    },
    teacher: {
        name: "🎓 Patient Educator", 
        system: "You are a patient, encouraging university professor. Break down complex topics into digestible steps, use analogies and real-world examples, ask guiding questions, and adapt to the student's level. Remember what we've discussed to build knowledge progressively. When helpful for learning, create educational diagrams using Mermaid syntax in ```mermaid code blocks to visualize concepts."
    },
    funny: {
        name: "🎪 Humorous Tutor",
        system: "You are a witty, entertaining professor with excellent humor. Use appropriate jokes, clever analogies, and light-hearted responses while maintaining educational value. Keep learning fun and engaging, remembering our humorous academic conversations."
    },
    scholar: {
        name: "📚 Research Scholar",
        system: "You are a distinguished academic researcher and scholar. Provide detailed, well-researched answers with academic depth. Reference relevant theories, studies, and historical context when appropriate. Remember our intellectual discussions to build deeper scholarly insights. For complex concepts or research frameworks, create scholarly diagrams using Mermaid syntax in ```mermaid code blocks."
    }
};

// ========================================
// MESSAGE PREPARATION FOR OPENAI
// ========================================

const prepareOpenAIMessages = (currentMessage) => {
    // Get recent conversation history (last 12 messages for better context)
    const recentHistory = chatHistory.slice(-12);
    
    // Convert chat history to OpenAI message format
    const messages = recentHistory.map(msg => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.text.replace(/<[^>]*>/g, '').trim() // Clean HTML tags
    }));
    
    // Check if there's uploaded file content to include
    let finalMessage = currentMessage;
    let isImageUpload = false;
    
    if (window.uploadedFileContent && currentMessage.includes(window.uploadedFileContent.fileName)) {
        // Check if it's an image file
        if (window.uploadedFileContent.content.startsWith('[IMAGE_FILE_BASE64]:')) {
            isImageUpload = true;
            const base64Data = window.uploadedFileContent.content.replace('[IMAGE_FILE_BASE64]:', '');
            
            // For images, use OpenAI's vision format
            messages.push({
                role: "user",
                content: [
                    {
                        type: "text",
                        text: `Please analyze this image (${window.uploadedFileContent.fileName}) and explain what you see. ${currentMessage.replace(`**📎 ${window.uploadedFileContent.fileName}**`, '').trim()}`
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: base64Data
                        }
                    }
                ]
            });
        } else {
            // Smart content handling for large files
            const processedContent = processLargeFileContent(window.uploadedFileContent.content, window.uploadedFileContent.fileName);
            
            // Replace the filename reference with processed content
            finalMessage = currentMessage.replace(
                `**📎 ${window.uploadedFileContent.fileName}**`,
                `**📎 ${window.uploadedFileContent.fileName}** (${processedContent.type}):\n\n${processedContent.content}`
            );
            
            // Add current user message (with processed file content)
            messages.push({
                role: "user",
                content: finalMessage
            });
        }
        
        // Clear the uploaded file content after using it
        window.uploadedFileContent = null;
    } else {
        // Add current user message (no file content)
        messages.push({
            role: "user",
            content: finalMessage
        });
    }
    
    // ALWAYS add system message with current personality (at the beginning)
    messages.unshift({
        role: "system",
        content: personalities[currentPersonality].system
    });
    
    return { messages, isImageUpload };
};

// ========================================
// SMART CONTENT PROCESSING FOR LARGE FILES
// ========================================

function processLargeFileContent(content, fileName) {
    // Estimate token count (rough approximation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(content.length / 4);
    const maxTokens = 12000; // Leave room for system message, user message, and response
    
    console.log(`📊 File content analysis: ${estimatedTokens} estimated tokens`);
    
    if (estimatedTokens <= maxTokens) {
        return {
            type: "Full Content",
            content: content
        };
    }
    
    // For large files, create an intelligent summary
    console.log(`⚠️ Large file detected (${estimatedTokens} tokens). Creating smart summary...`);
    
    if (fileName.toLowerCase().includes('.ppt') || fileName.toLowerCase().includes('powerpoint')) {
        return processLargePowerPoint(content, estimatedTokens, maxTokens);
    } else if (fileName.toLowerCase().includes('.xlsx') || fileName.toLowerCase().includes('.csv')) {
        return processLargeSpreadsheet(content, estimatedTokens, maxTokens);
    } else {
        return processLargeTextFile(content, estimatedTokens, maxTokens);
    }
}

function processLargePowerPoint(content, estimatedTokens, maxTokens) {
    const lines = content.split('\n');
    const slides = [];
    let currentSlide = null;
    let speakerNotes = [];
    
    // Parse slides and notes
    for (const line of lines) {
        if (line.startsWith('--- Slide ')) {
            if (currentSlide) {
                slides.push(currentSlide);
            }
            currentSlide = {
                title: line,
                content: []
            };
        } else if (line.startsWith('--- Speaker Notes ---')) {
            if (currentSlide) {
                slides.push(currentSlide);
                currentSlide = null;
            }
            // Start collecting speaker notes
        } else if (line.trim() && currentSlide) {
            currentSlide.content.push(line.trim());
        } else if (line.trim() && !currentSlide && lines.indexOf(line) > lines.findIndex(l => l.includes('Speaker Notes'))) {
            speakerNotes.push(line.trim());
        }
    }
    
    if (currentSlide) {
        slides.push(currentSlide);
    }
    
    // Create intelligent summary
    let summary = `📊 PowerPoint Summary (${slides.length} slides, ${estimatedTokens} tokens - auto-summarized for optimal processing)\n\n`;
    
    // Add overview
    summary += `🎯 PRESENTATION OVERVIEW:\n`;
    summary += `• Total Slides: ${slides.length}\n`;
    summary += `• Content Length: ${estimatedTokens} estimated tokens\n`;
    summary += `• Processing: Smart summary to fit context window\n\n`;
    
    // Sample key slides (first few, middle, and last few)
    const keySlideIndices = getKeySlideIndices(slides.length);
    
    summary += `📋 KEY SLIDES CONTENT:\n\n`;
    
    keySlideIndices.forEach(index => {
        const slide = slides[index];
        summary += `${slide.title}\n`;
        
        // Add first few lines of content
        const slideContent = slide.content.slice(0, 3).join('\n');
        if (slideContent) {
            summary += `${slideContent}\n`;
            if (slide.content.length > 3) {
                summary += `... (${slide.content.length - 3} more lines)\n`;
            }
        }
        summary += '\n';
    });
    
    // Add slide titles overview
    if (slides.length > keySlideIndices.length) {
        summary += `📑 ALL SLIDE TITLES:\n`;
        slides.forEach((slide, index) => {
            summary += `${index + 1}. ${slide.title.replace('--- Slide ', 'Slide ')}\n`;
        });
        summary += '\n';
    }
    
    // Add speaker notes summary if available
    if (speakerNotes.length > 0) {
        summary += `🎤 SPEAKER NOTES SUMMARY:\n`;
        summary += speakerNotes.slice(0, 5).join('\n');
        if (speakerNotes.length > 5) {
            summary += `\n... (${speakerNotes.length - 5} more notes)\n`;
        }
        summary += '\n';
    }
    
    summary += `💡 NOTE: This is an intelligent summary. Ask specific questions about particular slides or topics for detailed analysis.`;
    
    return {
        type: "Smart Summary",
        content: summary
    };
}

function processLargeSpreadsheet(content, estimatedTokens, maxTokens) {
    const lines = content.split('\n');
    const sheets = [];
    let currentSheet = null;
    
    // Parse sheets
    for (const line of lines) {
        if (line.startsWith('Sheet: ')) {
            if (currentSheet) {
                sheets.push(currentSheet);
            }
            currentSheet = {
                name: line.replace('Sheet: ', ''),
                rows: []
            };
        } else if (line.trim() && currentSheet) {
            currentSheet.rows.push(line.trim());
        }
    }
    
    if (currentSheet) {
        sheets.push(currentSheet);
    }
    
    let summary = `📊 Spreadsheet Summary (${sheets.length} sheets, ${estimatedTokens} tokens - auto-summarized)\n\n`;
    
    summary += `🎯 SPREADSHEET OVERVIEW:\n`;
    summary += `• Total Sheets: ${sheets.length}\n`;
    summary += `• Content Length: ${estimatedTokens} estimated tokens\n\n`;
    
    sheets.forEach((sheet, index) => {
        summary += `📋 Sheet ${index + 1}: ${sheet.name}\n`;
        summary += `• Rows: ${sheet.rows.length}\n`;
        
        // Show first few rows
        if (sheet.rows.length > 0) {
            summary += `• Sample Data:\n`;
            sheet.rows.slice(0, 3).forEach(row => {
                summary += `  ${row}\n`;
            });
            if (sheet.rows.length > 3) {
                summary += `  ... (${sheet.rows.length - 3} more rows)\n`;
            }
        }
        summary += '\n';
    });
    
    summary += `💡 NOTE: This is a summary. Ask specific questions about particular sheets or data for detailed analysis.`;
    
    return {
        type: "Smart Summary",
        content: summary
    };
}

function processLargeTextFile(content, estimatedTokens, maxTokens) {
    const lines = content.split('\n');
    const targetLength = Math.floor(maxTokens * 4 * 0.8); // 80% of max tokens, converted to characters
    
    let summary = `📄 Large Text File Summary (${estimatedTokens} tokens - auto-summarized)\n\n`;
    
    summary += `🎯 FILE OVERVIEW:\n`;
    summary += `• Original Length: ${content.length} characters\n`;
    summary += `• Estimated Tokens: ${estimatedTokens}\n`;
    summary += `• Total Lines: ${lines.length}\n\n`;
    
    summary += `📋 CONTENT PREVIEW:\n\n`;
    
    // Add beginning of file
    const beginningLines = lines.slice(0, 20);
    summary += beginningLines.join('\n');
    
    if (lines.length > 40) {
        summary += `\n\n... (${lines.length - 40} lines omitted) ...\n\n`;
        
        // Add end of file
        const endLines = lines.slice(-20);
        summary += endLines.join('\n');
    }
    
    summary += `\n\n💡 NOTE: This is a summary of a large file. Ask specific questions for detailed analysis.`;
    
    return {
        type: "Smart Summary",
        content: summary
    };
}

function getKeySlideIndices(totalSlides) {
    if (totalSlides <= 6) {
        return Array.from({length: totalSlides}, (_, i) => i);
    }
    
    const indices = [];
    
    // Always include first 2 slides
    indices.push(0, 1);
    
    // Add middle slides
    const middleIndex = Math.floor(totalSlides / 2);
    indices.push(middleIndex - 1, middleIndex, middleIndex + 1);
    
    // Always include last 2 slides
    indices.push(totalSlides - 2, totalSlides - 1);
    
    // Remove duplicates and sort
    return [...new Set(indices)].sort((a, b) => a - b);
}

// ========================================
// MAIN MESSAGE HANDLER
// ========================================

const sendMessage = async () => {
    const message = input.value.trim();
    
    if (!message) {
        // Add shake animation to input if empty
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
        return;
    }
    
    if (!conversationStarted) {
        conversationStarted = true;
        // Initialize session ID for first message
        if (!currentSessionId) {
            currentSessionId = generateSessionId();
            console.log('🆕 New session started:', currentSessionId);
        }
    }
    
    // Add user message
    addMessage(message, true);
    saveToHistory(message, true, false); // User messages are plain text
    saveCurrentSession(); // Save session after user message
    input.value = "";
    updateCharCounter();
    
    // Add typing indicator
    const typingIndicator = createTypingIndicator();
    inputContainer.insertAdjacentElement("beforebegin", typingIndicator);
    
    // Disable input while processing
    setInputState(false);
    
    try {
        // Add network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('🚀 Sending request to OpenAI...');
        console.log('🎭 Current personality:', currentPersonality);
        
        // Check API key
        if (OPENAI_API_KEY === 'your-openai-api-key-here') {
            typingIndicator.remove();
            const errorMsg = `🔑 OpenAI API Key Required!
            
Please add your OpenAI API key to the code:
1. Get key from: https://platform.openai.com/api-keys
2. Replace 'your-openai-api-key-here' in the code with your actual key`;
            
            await addMessage(errorMsg, false, false, 'error');
            setInputState(true);
            return;
        }
        
        // Prepare OpenAI messages array with conversation history
        const { messages, isImageUpload } = prepareOpenAIMessages(message);
        
        const requestPayload = {
            model: isImageUpload ? "gpt-4o" : "gpt-3.5-turbo",
            messages: messages,
            max_tokens: isImageUpload ? 800 : 600,
            temperature: 0.7
        };
        
        console.log('🤖 OpenAI Request:');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(OPENAI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 Response received - Status:', response.status);
        
        if (!response.ok) {
            let errorText;
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Unable to read error response';
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
        saveToHistory(formattedText, false, true); // Save formatted HTML content
        console.log('💾 Saved AI response with HTML formatting:', formattedText.length, 'characters');
        saveCurrentSession(); // Save session after AI response
        
    } catch (error) {
        
        let errorMsg;
        
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Request timed out - The AI is taking too long to respond. Please try again.';
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            errorMsg = '🌐 Network error - Check your connection and try again.';
        } else if (error.message.includes('HTTP 429')) {
            errorMsg = '⏱️ Too many requests - Please wait a moment and try again.';
        } else if (error.message.includes('HTTP 500')) {
            errorMsg = '🔧 Server error - The AI service is temporarily unavailable.';
        } else if (error.message.includes('insufficient_quota')) {
            errorMsg = '💳 OpenAI quota exceeded - Please check your billing at https://platform.openai.com/settings/organization/billing';
        } else {
            errorMsg = `⚠️ Error: ${error.message.substring(0, 200)} - Please try again.`;
        }
        
        typingIndicator.remove();
        await addMessage(errorMsg, false, false, 'error');
    }
    
    // Re-enable input
    setInputState(true);
    ensureLastMessageVisible();
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

    // Ensure visibility of the latest message immediately after insert
    ensureLastMessageVisible();
    
    // Add entrance animation
    containerDiv.style.animation = 'fadeInUp 0.5s ease-out';
    
    // Render Mermaid diagrams if present
    if (isHTML && typeof mermaid !== 'undefined') {
        setTimeout(() => {
            const mermaidElements = containerDiv.querySelectorAll('.mermaid');
            mermaidElements.forEach(async (element, index) => {
                try {
                    const uniqueId = `mermaid_${Date.now()}_${index}`;
                    element.id = uniqueId;
                    

                    
                    // Render the diagram
                    const { svg } = await mermaid.render(uniqueId + '_svg', element.textContent);
                    element.innerHTML = svg;
                    
                    console.log(`🎨 Successfully rendered Mermaid diagram: ${uniqueId}`);
                    // After rendering each diagram, ensure visibility again
                    setTimeout(ensureLastMessageVisible, 50);
                } catch (error) {
                    // Check if this is a dependency diagram and provide fallback
                    const fallbackType = element.getAttribute('data-fallback');
                    if (fallbackType === 'dependency') {
                        element.innerHTML = generateDependencyFallback();
                    } else {
                        element.innerHTML = `<div style="color: #ff6b6b; padding: 20px; text-align: center;">
                            📊 Diagram could not be rendered
                        </div>`;
                    }
                }
            });
        }, 100); // Small delay to ensure DOM is ready
    }
    
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
        <span style="margin-left: 12px; color: rgba(255, 255, 255, 0.7); font-size: 14px;">Professor is thinking...</span>
    `;
    return indicator;
};

const formatBotResponse = (text) => {
    let formattedText = text
        .replace(/###\s+(.*)/g, "<h3>$1</h3>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/^\s*-\s+(.+)/gm, "<li>$1</li>")
        .replace(/^\s*\d+\.\s+(.+)/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
        .replace(/<\/ul>\s*<ul>/g, ""); // Merge consecutive lists

    // Replace broken image URLs with actual visual content
    formattedText = formattedText.replace(/https?:\/\/assets\.coderrocketfuel\.com\/[^\s]+/g, '🖼️ [Visual content generated below]');
    
    // Also handle markdown image syntax with broken URLs
    formattedText = formattedText.replace(/!\[([^\]]*)\]\(https?:\/\/assets\.coderrocketfuel\.com\/[^\)]+\)/g, 
        '🖼️ **$1** - [Generating visual content below]');
    
    // Handle any remaining broken image patterns
    formattedText = formattedText.replace(/!\[([^\]]*)\]\([^)]*assets\.coderrocketfuel[^)]*\)/g, 
        '🖼️ **$1** - [Generating visual content below]');

    // Convert ```mermaid code blocks to renderable Mermaid diagrams
    formattedText = formattedText.replace(/```mermaid\s*\n?([\s\S]*?)\n?\s*```/g, (match, mermaidCode) => {
        const diagramId = `mermaid_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        return `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">📊 Diagram</div>
                <div class="mermaid" id="${diagramId}">${mermaidCode.trim()}</div>
            </div>
        `;
    });

    // Detect and generate visual content
    formattedText = generateVisualContent(formattedText);

    return formattedText;
};

// ========================================
// VISUAL CONTENT GENERATION SYSTEM
// ========================================

const generateVisualContent = (text) => {
    // Disabled hardcoded diagram generation - let AI create dynamic diagrams naturally
    return text;
};

const generateFlowchartContent = (text) => {
    // Detect flowchart requests
    const flowchartPatterns = [
        /(?:here'?s?\s+)?(?:a\s+)?(?:flowchart|flow\s*chart|process\s+diagram|workflow)/i,
        /(?:the\s+)?(?:following\s+)?(?:process|steps?)\s+(?:can\s+be\s+)?(?:visualized|shown|represented)/i,
        /(?:step-by-step|sequential)\s+(?:process|flow)/i
    ];
    
    const hasFlowchartRequest = flowchartPatterns.some(pattern => pattern.test(text));
    
    if (hasFlowchartRequest) {
        const diagramId = 'diagram_' + Math.random().toString(36).substr(2, 9);
        
        // Extract steps or create a generic flowchart
        const steps = extractProcessSteps(text);
        const mermaidCode = generateMermaidFlowchart(steps);
        
        const diagramHTML = `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">📊 Process Flowchart</div>
                <div class="mermaid" id="${diagramId}">${mermaidCode}</div>
            </div>
        `;
        
        // Insert diagram after the first mention
        const insertionPoint = text.search(flowchartPatterns.find(pattern => pattern.test(text)));
        if (insertionPoint !== -1) {
            const beforeText = text.substring(0, insertionPoint);
            const afterText = text.substring(insertionPoint);
            const firstSentenceEnd = afterText.indexOf('.') + 1;
            
            return beforeText + afterText.substring(0, firstSentenceEnd) + diagramHTML + afterText.substring(firstSentenceEnd);
        }
    }
    
    return text;
};

const generateOrgChartContent = (text) => {
    const orgPatterns = [
        /(?:organizational|organization|org)\s+(?:chart|structure|hierarchy)/i,
        /(?:company|team|department)\s+(?:structure|hierarchy)/i,
        /(?:reporting\s+)?(?:structure|hierarchy)/i
    ];
    
    const hasOrgRequest = orgPatterns.some(pattern => pattern.test(text));
    
    if (hasOrgRequest) {
        const diagramId = 'orgchart_' + Math.random().toString(36).substr(2, 9);
        const mermaidCode = generateMermaidOrgChart(text);
        
        const diagramHTML = `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">🏢 Organizational Structure</div>
                <div class="mermaid" id="${diagramId}">${mermaidCode}</div>
            </div>
        `;
        
        return text + diagramHTML;
    }
    
    return text;
};

const generateNetworkDiagramContent = (text) => {
    const networkPatterns = [
        /(?:network|system|context)\s+diagram/i,
        /(?:architecture|system)\s+(?:overview|structure)/i,
        /(?:data\s+)?flow\s+diagram/i,
        /(?:component|module)\s+(?:interaction|relationship)/i
    ];
    
    const hasNetworkRequest = networkPatterns.some(pattern => pattern.test(text));
    
    if (hasNetworkRequest) {
        const diagramId = 'network_' + Math.random().toString(36).substr(2, 9);
        const mermaidCode = generateMermaidNetworkDiagram(text);
        
        const diagramHTML = `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">🔗 System Architecture</div>
                <div class="mermaid" id="${diagramId}">${mermaidCode}</div>
            </div>
        `;
        
        return text + diagramHTML;
    }
    
    return text;
};

const generateDependencyDiagramContent = (text) => {
    const dependencyPatterns = [
        /dependency\s+(?:structure\s+)?diagram/i,
        /dependency\s+(?:graph|chart|tree)/i,
        /module\s+dependencies/i,
        /component\s+dependencies/i,
        /\*\*dependency\s+structure\s+diagram\*\*/i,
        /dependency\s+relationships/i
    ];
    
    const hasDependencyRequest = dependencyPatterns.some(pattern => pattern.test(text));
    
    if (hasDependencyRequest) {
        const timestamp = Date.now();
        const diagramId = `dependency_${timestamp}_${Math.random().toString(36).substr(2, 5)}`;
        const mermaidCode = generateMermaidDependencyDiagram(text);
        
        const diagramHTML = `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">🔗 Dependency Structure Diagram</div>
                <div class="mermaid" id="${diagramId}" data-fallback="dependency" data-type="dependency">${mermaidCode}</div>
            </div>
        `;
        

        return text + diagramHTML;
    }
    
    return text;
};

const generateTimelineContent = (text) => {
    const timelinePatterns = [
        /(?:timeline|chronology|sequence)/i,
        /(?:historical|time-based)\s+(?:progression|sequence)/i,
        /(?:over\s+time|chronological\s+order)/i
    ];
    
    const hasTimelineRequest = timelinePatterns.some(pattern => pattern.test(text));
    
    if (hasTimelineRequest) {
        const diagramId = 'timeline_' + Math.random().toString(36).substr(2, 9);
        const mermaidCode = generateMermaidTimeline(text);
        
        const diagramHTML = `
            <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">⏰ Timeline</div>
                <div class="mermaid" id="${diagramId}">${mermaidCode}</div>
            </div>
        `;
        
        return text + diagramHTML;
    }
    
    return text;
};

const generateChartContent = (text) => {
    const chartPatterns = [
        /(?:bar\s+chart|pie\s+chart|graph|visualization)/i,
        /(?:data|statistics?|metrics?)\s+(?:visualization|chart|graph)/i
    ];
    
    const hasChartRequest = chartPatterns.some(pattern => pattern.test(text));
    
    if (hasChartRequest) {
        const chartId = 'chart_' + Math.random().toString(36).substr(2, 9);
        const chartHTML = generateSimpleChart(text, chartId);
        
        return text + chartHTML;
    }
    
    return text;
};

// Helper functions for generating specific diagram types
const extractProcessSteps = (text) => {
    // Try to extract numbered or bulleted steps
    const stepMatches = text.match(/(?:^\s*[\d\w][\.\)]\s+(.+)|^\s*[-\*]\s+(.+))/gm);
    
    if (stepMatches && stepMatches.length > 1) {
        return stepMatches.map(step => step.replace(/^\s*[\d\w][\.\)]\s*|^\s*[-\*]\s*/, '').trim());
    }
    
    // Fallback to generic process
    return ['Start', 'Process Data', 'Make Decision', 'End'];
};

const generateMermaidFlowchart = (steps) => {
    let flowchart = 'graph TD\n';
    
    steps.forEach((step, index) => {
        const nodeId = `step${index}`;
        const nextNodeId = `step${index + 1}`;
        
        if (index === 0) {
            flowchart += `    ${nodeId}[${step}]\n`;
        } else if (index === steps.length - 1) {
            flowchart += `    ${nodeId}[${step}]\n`;
        } else {
            flowchart += `    ${nodeId}[${step}]\n`;
        }
        
        if (index < steps.length - 1) {
            flowchart += `    ${nodeId} --> ${nextNodeId}\n`;
        }
    });
    
    return flowchart;
};

const generateMermaidNetworkDiagram = (text) => {
    return `graph TB
    User[User Interface]
    API[API Layer]
    Service1[Service A]
    Service2[Service B]
    Database[(Database)]
    Cache[(Cache)]
    
    User --> API
    API --> Service1
    API --> Service2
    Service1 --> Database
    Service2 --> Database
    Service1 --> Cache
    Service2 --> Cache`;
};

const generateMermaidDependencyDiagram = (text) => {
    // Create a simple, reliable dependency diagram
    return `graph TB
    subgraph "Application Architecture"
        A[Core Module]
        B[Utils Library]
        C[API Layer]
        D[UI Components]
        E[Authentication]
        F[Data Layer]
    end
    
    D --> A
    D --> B
    D --> E
    C --> A
    C --> E
    C --> F
    F --> A
    E --> A
    E --> B
    A --> B
    
    style A fill:#FFD700,stroke:#FFA500,stroke-width:3px
    style B fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px
    style C fill:#00b894,stroke:#55efc4,stroke-width:2px
    style D fill:#00b894,stroke:#55efc4,stroke-width:2px
    style E fill:#00b894,stroke:#55efc4,stroke-width:2px
    style F fill:#00b894,stroke:#55efc4,stroke-width:2px`;
};



const generateDependencyFallback = () => {
    return `
        <div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 20px; text-align: left;">
            <div style="color: #FFD700; font-weight: 600; text-align: center; margin-bottom: 15px;">📊 Dependency Structure (Text View)</div>
            <div style="font-family: monospace; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.9);">
                <div style="margin: 8px 0;"><span style="color: #FFD700;">🏗️ Core Module</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">├── <span style="color: #6c5ce7;">🔧 Utils Library</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">└── <span style="color: #00b894;">⚙️ Configuration</span></div>
                
                <div style="margin: 8px 0;"><span style="color: #00b894;">🎨 UI Components</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">├── Core Module</div>
                <div style="margin: 8px 0; margin-left: 20px;">├── Utils Library</div>
                <div style="margin: 8px 0; margin-left: 20px;">└── <span style="color: #00b894;">🔐 Authentication</span></div>
                
                <div style="margin: 8px 0;"><span style="color: #00b894;">🌐 API Layer</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">├── Core Module</div>
                <div style="margin: 8px 0; margin-left: 20px;">├── Authentication</div>
                <div style="margin: 8px 0; margin-left: 20px;">├── <span style="color: #00b894;">💾 Data Layer</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">└── <span style="color: #00b894;">📋 Logging System</span></div>
                
                <div style="margin: 8px 0;"><span style="color: #00b894;">💾 Data Layer</span></div>
                <div style="margin: 8px 0; margin-left: 20px;">├── Core Module</div>
                <div style="margin: 8px 0; margin-left: 20px;">└── Configuration</div>
            </div>
            <div style="text-align: center; margin-top: 15px; font-size: 12px; opacity: 0.7;">
                Fallback view - Mermaid diagram failed to render
            </div>
        </div>
    `;
};

const generateMermaidTimeline = (text) => {
    return `timeline
    title Project Timeline
    
    Phase 1 : Planning
           : Requirements Gathering
           : Design Review
    
    Phase 2 : Development
           : Implementation
           : Testing
    
    Phase 3 : Deployment
           : Production Release
           : Monitoring`;
};

const generateMermaidOrgChart = (text) => {
    return `graph TD
    A[CEO] --> B[CTO]
    A --> C[CFO]
    A --> D[COO]
    B --> E[Dev Team]
    B --> F[QA Team]
    C --> G[Finance]
    D --> H[Operations]
    
    style A fill:#FFD700,stroke:#FFA500,stroke-width:3px
    style B fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px
    style C fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px
    style D fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px`;
};

const generateMermaidNetworkDiagramLR = (text) => {
    return `graph LR
    A[Client] --> B[Load Balancer]
    B --> C[Web Server 1]
    B --> D[Web Server 2]
    C --> E[Database]
    D --> E
    E --> F[Cache]
    
    style A fill:#FFD700,stroke:#FFA500,stroke-width:3px
    style B fill:#6c5ce7,stroke:#a29bfe,stroke-width:2px
    style C fill:#00b894,stroke:#55efc4,stroke-width:2px
    style D fill:#00b894,stroke:#55efc4,stroke-width:2px
    style E fill:#e17055,stroke:#fab1a0,stroke-width:2px
    style F fill:#e17055,stroke:#fab1a0,stroke-width:2px`;
};

const generateSimpleChart = (text, chartId) => {
    return `
        <div class="diagram-container" style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <div class="diagram-header" style="color: #FFD700; font-weight: 600; margin-bottom: 15px;">📊 Data Visualization</div>
            <div id="${chartId}" style="display: flex; justify-content: space-around; align-items: end; height: 200px; background: rgba(255,255,255,0.05); border-radius: 8px; padding: 20px;">
                <div style="background: linear-gradient(to top, #FFD700, #FFA500); width: 40px; height: 60%; border-radius: 4px 4px 0 0; display: flex; align-items: end; justify-content: center; color: #1e3c72; font-weight: bold; padding-bottom: 10px;">A</div>
                <div style="background: linear-gradient(to top, #6c5ce7, #a29bfe); width: 40px; height: 80%; border-radius: 4px 4px 0 0; display: flex; align-items: end; justify-content: center; color: white; font-weight: bold; padding-bottom: 10px;">B</div>
                <div style="background: linear-gradient(to top, #00b894, #55efc4); width: 40px; height: 45%; border-radius: 4px 4px 0 0; display: flex; align-items: end; justify-content: center; color: white; font-weight: bold; padding-bottom: 10px;">C</div>
                <div style="background: linear-gradient(to top, #e17055, #fab1a0); width: 40px; height: 70%; border-radius: 4px 4px 0 0; display: flex; align-items: end; justify-content: center; color: white; font-weight: bold; padding-bottom: 10px;">D</div>
            </div>
        </div>
    `;
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

// Ensure the last message is fully visible, accounting for the fixed input area
const ensureLastMessageVisible = () => {
    const inputEl = document.querySelector('.input-container');
    const lastMessage = document.querySelector('.message-container:last-of-type');
    if (!lastMessage) return;

    // Align the bottom of the last message with the viewport bottom
    lastMessage.scrollIntoView({ block: 'end', behavior: 'smooth' });

    // Nudge up slightly to avoid being covered by the input bar
    const offset = inputEl ? inputEl.offsetHeight + 12 : 80;
    window.scrollTo({
        top: window.pageYOffset - offset,
        behavior: 'smooth'
    });
};

const saveToHistory = (message, isUser, isHTML = false) => {
    chatHistory.push({
        text: message,
        isUser: isUser,
        isHTML: isHTML, // Track whether content contains HTML
        timestamp: Date.now(),
        personality: currentPersonality
    });
    
    // Keep only last 50 messages in memory
    if (chatHistory.length > 50) {
        chatHistory = chatHistory.slice(-50);
    }
};

// ========================================
// FILE UPLOAD SYSTEM - ENHANCED
// ========================================

let currentUploadType = '';

// File size constants (in bytes)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const LARGE_FILE_WARNING = 25 * 1024 * 1024; // 25MB
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for processing

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
        case 'image':
            input.accept = '.jpg,.jpeg,.png,.gif,.bmp,.webp';
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
        // File size validation
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File too large! Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB. Your file is ${Math.round(file.size / (1024 * 1024))}MB.`);
        }
        
        // Show warning for large files
        if (file.size > LARGE_FILE_WARNING) {
            const proceed = confirm(`⚠️ Large File Warning!\n\nFile size: ${Math.round(file.size / (1024 * 1024))}MB\n\nThis may take a while to process. Continue?`);
            if (!proceed) {
                return;
            }
        }
        
        // Show processing indicator with progress
        showFileProcessingIndicator(file.name, file.size);
        
        let content = '';
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        
        // Add timeout for large file processing
        const timeoutMs = file.size > LARGE_FILE_WARNING ? 120000 : 60000; // 2 minutes for large files, 1 minute for others
        
        const extractionPromise = (async () => {
            switch(fileExtension) {
                case 'pdf':
                    return await extractPDFContent(file);
                case 'docx':
                case 'doc':
                    return await extractDOCXContent(file);
                case 'pptx':
                    return await extractPPTXContent(file);
                case 'csv':
                case 'xlsx':
                case 'xls':
                    return await extractExcelContent(file);
                case 'txt':
                    return await extractTextContent(file);
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'gif':
                case 'bmp':
                case 'webp':
                    return await extractImageContent(file);
                default:
                    throw new Error(`Unsupported file type: ${fileExtension}`);
            }
        })();
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`File processing timed out after ${timeoutMs/1000} seconds. The file may be too large or complex.`)), timeoutMs);
        });
        
        content = await Promise.race([extractionPromise, timeoutPromise]);
        
        if (content.trim()) {
            // Store file content globally for later use
            window.uploadedFileContent = {
                fileName: fileName,
                content: content
            };
            
            // Check if content will need smart processing
            const estimatedTokens = Math.ceil(content.length / 4);
            const maxTokens = 12000;
            
            // Only show filename in text box (not full content)
            input.value += `**📎 ${fileName}**\n`;
            updateCharCounter();
            
            hideFileProcessingIndicator();
            
            if (estimatedTokens > maxTokens) {
                showNotification(`✅ File "${fileName}" processed! 🧠 Smart summarization will be applied (${estimatedTokens} tokens → optimized for AI)`, 4000);
            } else {
                showNotification(`✅ File "${fileName}" processed successfully!`, 3000);
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

// File content extraction functions
async function extractPDFContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                updateFileProcessingProgress(20, 'Loading PDF document...');
                
                const typedarray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = '';
                
                updateFileProcessingProgress(40, `Processing ${pdf.numPages} pages...`);
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                    
                    // Update progress
                    const progress = 40 + (i / pdf.numPages) * 50;
                    updateFileProcessingProgress(progress, `Processing page ${i} of ${pdf.numPages}...`);
                }
                
                updateFileProcessingProgress(95, 'Finalizing PDF content...');
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
                updateFileProcessingProgress(30, 'Reading Word document...');
                
                const arrayBuffer = e.target.result;
                
                updateFileProcessingProgress(70, 'Extracting text content...');
                
                const result = await mammoth.extractRawText({arrayBuffer});
                
                updateFileProcessingProgress(95, 'Finalizing document content...');
                
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
                updateFileProcessingProgress(20, 'Reading PowerPoint file...');
                
                const arrayBuffer = e.target.result;
                const zip = new JSZip();
                
                updateFileProcessingProgress(40, 'Extracting PowerPoint structure...');
                
                const zipFile = await zip.loadAsync(arrayBuffer);
                let content = '';
                let slideCount = 0;
                
                updateFileProcessingProgress(60, 'Processing slides...');
                
                // Extract text from slides
                const slideFiles = Object.keys(zipFile.files).filter(name => 
                    name.startsWith('ppt/slides/slide') && name.endsWith('.xml')
                );
                
                for (let i = 0; i < slideFiles.length; i++) {
                    const slideFile = slideFiles[i];
                    const slideXml = await zipFile.files[slideFile].async('text');
                    
                    // Extract text from XML using regex (basic but effective)
                    const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
                    if (textMatches) {
                        slideCount++;
                        content += `\n--- Slide ${slideCount} ---\n`;
                        textMatches.forEach(match => {
                            const text = match.replace(/<[^>]*>/g, '').trim();
                            if (text) {
                                content += text + '\n';
                            }
                        });
                    }
                    
                    // Update progress
                    const progress = 60 + (i / slideFiles.length) * 30;
                    updateFileProcessingProgress(progress, `Processing slide ${i + 1} of ${slideFiles.length}...`);
                }
                
                updateFileProcessingProgress(95, 'Finalizing content...');
                
                // Also try to extract from notes if available
                const notesFiles = Object.keys(zipFile.files).filter(name => 
                    name.startsWith('ppt/notesSlides/notesSlide') && name.endsWith('.xml')
                );
                
                if (notesFiles.length > 0) {
                    content += '\n--- Speaker Notes ---\n';
                    for (const notesFile of notesFiles) {
                        const notesXml = await zipFile.files[notesFile].async('text');
                        const textMatches = notesXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g);
                        if (textMatches) {
                            textMatches.forEach(match => {
                                const text = match.replace(/<[^>]*>/g, '').trim();
                                if (text) {
                                    content += text + '\n';
                                }
                            });
                        }
                    }
                }
                
                updateFileProcessingProgress(100, 'Complete!');
                
                const finalContent = content.trim() || `PowerPoint file processed successfully!\n\nFound ${slideCount} slides.\n\n(Note: Some content may not be extractable due to formatting or embedded objects)`;
                
                resolve(finalContent);
            } catch (error) {
                console.error('PPTX extraction error:', error);
                reject(new Error(`PowerPoint processing failed: ${error.message}. The file may be corrupted or use unsupported features.`));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read PowerPoint file'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractExcelContent(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                updateFileProcessingProgress(30, 'Reading Excel file...');
                
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                let content = '';
                
                updateFileProcessingProgress(60, `Processing ${workbook.SheetNames.length} sheets...`);
                
                workbook.SheetNames.forEach((sheetName, index) => {
                    content += `Sheet: ${sheetName}\n`;
                    const sheet = workbook.Sheets[sheetName];
                    const csvOutput = XLSX.utils.sheet_to_csv(sheet);
                    content += csvOutput + '\n\n';
                    
                    // Update progress
                    const progress = 60 + ((index + 1) / workbook.SheetNames.length) * 30;
                    updateFileProcessingProgress(progress, `Processing sheet ${index + 1} of ${workbook.SheetNames.length}...`);
                });
                
                updateFileProcessingProgress(95, 'Finalizing Excel content...');
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
            updateFileProcessingProgress(50, 'Reading text file...');
            updateFileProcessingProgress(95, 'Finalizing text content...');
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
            updateFileProcessingProgress(50, 'Processing image file...');
            // Return base64 data URL for images
            const base64Data = e.target.result;
            updateFileProcessingProgress(95, 'Finalizing image content...');
            resolve(`[IMAGE_FILE_BASE64]:${base64Data}`);
        };
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}

// File processing UI indicators
function showFileProcessingIndicator(fileName, fileSize = 0) {
    const indicator = document.createElement('div');
    indicator.id = 'fileProcessingIndicator';
    indicator.className = 'file-processing-indicator';
    
    const fileSizeText = fileSize > 0 ? ` (${Math.round(fileSize / (1024 * 1024) * 10) / 10}MB)` : '';
    
    indicator.innerHTML = `
        <div class="processing-content">
            <div class="processing-spinner"></div>
            <div class="processing-text">
                <div class="processing-filename">Processing "${fileName}"${fileSizeText}...</div>
                <div class="processing-status">Initializing...</div>
            </div>
            <div class="progress-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-percentage">0%</div>
            </div>
        </div>
    `;
    inputContainer.insertAdjacentElement("beforebegin", indicator);
}

function updateFileProcessingProgress(percentage, status) {
    const indicator = document.getElementById('fileProcessingIndicator');
    if (indicator) {
        const progressFill = indicator.querySelector('.progress-fill');
        const progressPercentage = indicator.querySelector('.progress-percentage');
        const processingStatus = indicator.querySelector('.processing-status');
        
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(percentage)}%`;
        }
        if (processingStatus && status) {
            processingStatus.textContent = status;
        }
    }
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

const updateCharCounter = () => {
    const length = input.value.length;
    // No character limit - OpenAI can handle much longer messages
    
    // Only disable send button if input is empty
    sendBtn.disabled = length === 0;
    sendBtn.style.opacity = length === 0 ? '0.6' : '1';
};

// ========================================
// PERSONALITY SWITCHING FUNCTIONALITY
// ========================================

const switchPersonality = (personality) => {
    // Update current personality
    currentPersonality = personality;
    
    // Update UI - remove selected class from all options
    document.querySelectorAll('.personality-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    // Add selected class to clicked option
    document.querySelector(`[data-personality="${personality}"]`).classList.add('selected');
    
    // Show notification with personality switch
    const personalityName = personalities[personality].name;
    showNotification(`🎭 Switched to ${personalityName}!`, 3000);
    
    console.log('🎭 Personality switched to:', personality);
    console.log('🎯 System message:', personalities[personality].system);
};

// ========================================
// CONTROL FUNCTIONS
// ========================================

const startNewChat = () => {
    // Save current session if it has messages
    if (chatHistory.length > 0) {
        saveCurrentSession();
    }
    
    // Clear chat history and UI
    chatHistory = [];
    conversationStarted = false;
    messageCount = 0;
    currentSessionId = null;
    
    // Remove all message containers
    document.querySelectorAll('.message-container, .typing-indicator').forEach(el => el.remove());
    
    // Show notification
    showNotification('🆕 New chat session started!', 2000);
    
    // Focus input
    input.focus();
    
    console.log('🆕 New chat session started');
};

const saveCurrentSession = () => {
    if (chatHistory.length === 0) return;
    
    const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
    
    // Generate meaningful title from first user message
    const firstUserMessage = chatHistory.find(msg => msg.isUser);
    let sessionTitle = 'New Conversation';
    if (firstUserMessage) {
        // Clean the message and truncate to reasonable length
        const cleanMessage = firstUserMessage.text.replace(/<[^>]*>/g, '').replace(/\*\*.*?\*\*/g, '').trim();
        sessionTitle = cleanMessage.length > 50 ? cleanMessage.substring(0, 47) + '...' : cleanMessage;
    }
    
    // Get active course information
    let courseContext = null;
    if (activeCourse && courses[activeCourse]) {
        courseContext = {
            id: activeCourse,
            title: courses[activeCourse].title
        };
    }
    
    // Create or update session
    const sessionData = {
        id: currentSessionId || generateSessionId(),
        timestamp: new Date().toISOString(),
        personality: currentPersonality,
        messages: [...chatHistory],
        messageCount: chatHistory.length,
        sessionNumber: sessions.length + 1,
        title: sessionTitle,
        courseContext: courseContext
    };
    
    // Check if updating existing session or creating new one
    const existingIndex = sessions.findIndex(s => s.id === sessionData.id);
    if (existingIndex >= 0) {
        // Always update timestamp when updating existing session
        sessionData.timestamp = new Date().toISOString();
        sessions[existingIndex] = sessionData;
        console.log('📝 Updated existing session:', sessionData.id);
    } else {
        sessions.push(sessionData);
        console.log('🆕 Created new session:', sessionData.id);
    }
    
    // Keep only last 50 sessions to prevent storage overflow
    if (sessions.length > 50) {
        sessions.splice(0, sessions.length - 50);
    }
    
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
    console.log('💾 Session saved:', sessionData.id);
};

const generateSessionId = () => {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

const migrateSessionsForHTMLSupport = () => {
    try {
        const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
        let migrationNeeded = false;
        
        sessions.forEach(session => {
            if (session.messages) {
                session.messages.forEach(msg => {
                    if (msg.isHTML === undefined) {
                        // For backward compatibility, assume non-user messages with HTML tags are HTML content
                        msg.isHTML = !msg.isUser && msg.text && msg.text.includes('<');
                        migrationNeeded = true;
                    }
                });
            }
        });
        
        if (migrationNeeded) {
            localStorage.setItem('chatSessions', JSON.stringify(sessions));
            console.log('📦 Migrated existing sessions for HTML support');
        }
    } catch (error) {
        console.error('🔧 Session migration error:', error);
    }
};

const exportChat = () => {
    if (chatHistory.length === 0) {
        showNotification('❌ No conversation to export!', 2000);
        return;
    }
    
    let exportText = `AI Professor v4 Conversation Export\n`;
    exportText += `Date: ${new Date().toLocaleString()}\n`;
    exportText += `Messages: ${chatHistory.length}\n`;
    exportText += `Current Personality: ${personalities[currentPersonality].name}\n\n`;
    exportText += '=' + '='.repeat(50) + '\n\n';
    
    chatHistory.forEach((msg, index) => {
        const sender = msg.isUser ? '👤 You' : `🎓 AI Professor (${personalities[msg.personality]?.name || 'Assistant'})`;
        const cleanText = msg.text.replace(/<[^>]*>/g, ''); // Remove HTML tags
        exportText += `${sender}:\n${cleanText}\n\n${'─'.repeat(30)}\n\n`;
    });
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-professor-chat-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('💾 Chat exported successfully!', 2000);
};

const clearChat = () => {
    if (chatHistory.length === 0) {
        showNotification('❌ No conversation to clear!', 2000);
        return;
    }
    
    if (confirm('🗑️ Clear all messages? This cannot be undone.')) {
        startNewChat();
        showNotification('🗑️ All messages cleared!', 2000);
    }
};

// ========================================
// NOTIFICATION SYSTEM
// ========================================

const showNotification = (message, duration = 3000, type = 'default') => {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Add special styling for smart processing notifications
    if (message.includes('🧠') || message.includes('Smart summarization')) {
        notification.classList.add('smart-processing');
    }
    
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
// EVENT LISTENERS & INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('🎓 AI Professor v4 - Ultimate Edition Loaded!');
    
    // Initialize Mermaid.js for diagram rendering
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ 
            startOnLoad: false,
            theme: 'dark',
            themeVariables: {
                primaryColor: '#FFD700',
                primaryTextColor: '#ffffff',
                primaryBorderColor: '#FFA500',
                lineColor: '#FFD700',
                secondaryColor: '#2a5298',
                tertiaryColor: '#1e3c72'
            },
            flowchart: {
                useMaxWidth: true,
                htmlLabels: true,
                curve: 'basis'
            },
            logLevel: 'error'
        });
        console.log('🎨 Mermaid.js initialized for diagram rendering with enhanced settings');
    }
    
    // Migrate existing sessions to support HTML formatting
    migrateSessionsForHTMLSupport();
    
    // Initialize character counter
    updateCharCounter();
    input.focus();
    
    // Add personality click listeners (after DOM is ready)
    document.querySelectorAll('.personality-option').forEach(option => {
        option.addEventListener('click', () => {
            const personality = option.getAttribute('data-personality');
            switchPersonality(personality);
        });
    });
    
    // Send button click
    sendBtn.addEventListener("click", sendMessage);
    
    // Enter key press (Shift+Enter for new line)
    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !e.shiftKey && !sendBtn.disabled) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Character counter update
    input.addEventListener("input", () => {
        updateCharCounter();
        
        // Auto-resize textarea
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
    
    // Show welcome message
    setTimeout(() => {
        showNotification('🎓 Welcome to AI Professor v4! Choose your preferred teaching personality above.', 4000);
    }, 1000);
});

// ========================================
// PERSONALITY HELP FUNCTIONS  
// ========================================

const showPersonalityHelp = () => {
    const modal = document.getElementById('personalityHelpModal');
    modal.classList.add('show');
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hidePersonalityHelp();
        }
    });
};

const hidePersonalityHelp = () => {
    const modal = document.getElementById('personalityHelpModal');
    modal.classList.remove('show');
};

// Close help modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        hidePersonalityHelp();
        hideChatHistory();
    }
});

// ========================================
// CHAT HISTORY FUNCTIONS  
// ========================================

const showChatHistory = () => {
    const modal = document.getElementById('chatHistoryModal');
    const historyList = document.getElementById('historyList');
    
    if (!modal) {
        console.error('❌ ERROR: chatHistoryModal not found!');
        return;
    }
    
    if (!historyList) {
        console.error('❌ ERROR: historyList not found!');
        return;
    }
    
    console.log('📜 Opening chat history (most recent first)...');
    
    // Load and display chat sessions
    loadChatHistory(historyList);
    
    modal.classList.add('show');
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            hideChatHistory();
        }
    });
};

const hideChatHistory = () => {
    const modal = document.getElementById('chatHistoryModal');
    modal.classList.remove('show');
};

const loadChatHistory = (container) => {
    const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
    
    if (sessions.length === 0) {
        container.innerHTML = '<div class="no-history">No chat sessions found. Start a conversation to create your first session!</div>';
        return;
    }
    
    // Sort sessions by timestamp (most recent first) - enhanced sorting
    sessions.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        
        // Fallback to session creation order if timestamps are invalid
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
            return (b.sessionNumber || 0) - (a.sessionNumber || 0);
        }
        
        return dateB.getTime() - dateA.getTime();
    });
    
    console.log('📋 Chat History Sorted (newest first):', sessions.map(s => ({
        title: s.title?.substring(0, 30) + '...',
        timestamp: s.timestamp,
        id: s.id
    })));
    
    container.innerHTML = sessions.map(session => {
        const date = new Date(session.timestamp);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        const personality = personalities[session.personality] || personalities.assistant;
        
        // Use meaningful title or fallback to generic session number
        const sessionTitle = session.title || `Session ${session.sessionNumber || sessions.indexOf(session) + 1}`;
        
        // Check if this is today's session
        const today = new Date().toDateString();
        const sessionDate = new Date(session.timestamp).toDateString();
        const isToday = today === sessionDate;
        
        // Check if this is the current active session
        const isCurrentSession = session.id === currentSessionId;
        
        // Format course context if available
        const courseInfo = session.courseContext ? 
            `<div class="history-session-course">📚 ${session.courseContext.title}</div>` : 
            `<div class="history-session-course">🎭 General AI Professor</div>`;
        
        // Add badges for recent/current sessions
        let badges = '';
        if (isCurrentSession) badges += '<span class="session-badge current">📍 Current</span>';
        if (isToday && !isCurrentSession) badges += '<span class="session-badge today">🕐 Today</span>';
        
        return `
            <div class="history-item ${isCurrentSession ? 'current-session' : ''}" onclick="loadSession('${session.id}')">
                <div class="history-session-info">
                    <div class="history-session-title">
                        ${sessionTitle} ${badges}
                    </div>
                    <div class="history-session-time">
                        ${formattedDate} at ${formattedTime}
                    </div>
                ${courseInfo}
                </div>
                <div class="history-session-details">
                    <span class="history-personality">${personality.name}</span>
                    <span class="history-message-count">${session.messageCount || 0} messages</span>
                </div>
            </div>
        `;
    }).join('');
};

const loadSession = (sessionId) => {
    // Check if we're already in this session
    if (currentSessionId === sessionId) {
        showNotification('📋 This session is already loaded', 2000);
        hideChatHistory();
        return;
    }
    
    const sessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
    const session = sessions.find(s => s.id === sessionId);
    
    if (session && session.messages) {
        // Clear current chat
        document.body.querySelectorAll('.message-container').forEach(msg => msg.remove());
        
        // Load session messages
        chatHistory = session.messages;
        currentSessionId = sessionId;
        
        // Switch to session personality
        switchPersonality(session.personality || 'assistant');
        
        // Restore conversation started state
        conversationStarted = chatHistory.length > 0;
        
        // Display all messages with proper formatting
        session.messages.forEach(msg => {
            // Handle backward compatibility for sessions without isHTML property
            const isHTML = msg.isHTML !== undefined ? msg.isHTML : (!msg.isUser && msg.text.includes('<'));
            addMessage(msg.text, msg.isUser, isHTML);
        });
        
        // Close history modal
        hideChatHistory();
        
        // Show notification
        showNotification(`📜 Loaded session "${session.title}" with ${session.messageCount || 0} messages`, 3000);
        
        // Update message count
        messageCount = session.messages.length;
        
        // Re-render any Mermaid diagrams after a small delay
        setTimeout(() => {
            if (typeof mermaid !== 'undefined') {
                const mermaidElements = document.querySelectorAll('.mermaid');
                mermaidElements.forEach(async (element, index) => {
                    if (element.innerHTML && !element.innerHTML.includes('<svg')) {
                        try {
                            const uniqueId = `mermaid_loaded_${Date.now()}_${index}`;
                            element.id = uniqueId;
                            
                            const { svg } = await mermaid.render(uniqueId + '_svg', element.textContent);
                            element.innerHTML = svg;
                            
                            console.log(`🎨 Re-rendered loaded Mermaid diagram: ${uniqueId}`);
                        } catch (error) {
                            // Check if this is a dependency diagram and provide fallback
                            const fallbackType = element.getAttribute('data-fallback');
                            if (fallbackType === 'dependency') {
                                element.innerHTML = generateDependencyFallback();
                            } else {
                                element.innerHTML = `<div style="color: #ff6b6b; padding: 15px; text-align: center;">
                                    📊 Diagram could not be rendered
                                </div>`;
                            }
                        }
                    }
                });
            }
        }, 500); // Delay to ensure DOM is ready
    }
};

// Save session on page unload and prevent accidental reload
window.addEventListener('beforeunload', (e) => {
    if (chatHistory.length > 0) {
        saveCurrentSession();
        e.preventDefault();
        e.returnValue = '';
    }
});

// Auto-save session every 30 seconds if there are changes
let lastSaveTime = 0;
setInterval(() => {
    if (chatHistory.length > 0 && chatHistory.length !== lastSaveTime) {
        saveCurrentSession();
        lastSaveTime = chatHistory.length;
    }
}, 30000);

// ========================================
// COURSE CONFIGURATION SYSTEM
// ========================================

let courses = {
    'software-eng-practicum': {
        id: 'software-eng-practicum',
        title: 'Software Engineering Practicum',
        prompt: 'Capstone software project in which the student applies concepts learned in the program. The practicum can be completed in a course in which the instructor oversees teams of students, or through an arrangement with an industry partner in which a manager evaluates the work of a student on a particular project. The latter requires prior approval.'
    },
    'computer-networks': {
        id: 'computer-networks',
        title: 'Computer Networks',
        prompt: 'Introduction to network design and programming. The course covers topics such as data transmission, link control, encoding, network topologies, internetworking, address resolution, protocol layering, routing methods, network and data security, socket programming, and remote procedure calls.'
    }
};

let activeCourse = 'software-eng-practicum';

// Load courses from localStorage on startup
function loadCourses() {
    const savedCourses = localStorage.getItem('ai_professor_courses');
    if (savedCourses) {
        courses = JSON.parse(savedCourses);
    }
    
    const savedActiveCourse = localStorage.getItem('ai_professor_active_course');
    if (savedActiveCourse && courses[savedActiveCourse]) {
        activeCourse = savedActiveCourse;
    }
    
    updateCourseSelector();
}

// Save courses to localStorage
function saveCourses() {
    localStorage.setItem('ai_professor_courses', JSON.stringify(courses));
    localStorage.setItem('ai_professor_active_course', activeCourse);
}

// Show course configuration modal
function showCourseConfig() {
    const modal = document.getElementById('courseConfigModal');
    if (modal) {
        modal.style.display = 'flex';
        renderCourseList();
    }
}

// Hide course configuration modal
function hideCourseConfig() {
    const modal = document.getElementById('courseConfigModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Render the course list in the modal
function renderCourseList() {
    const courseList = document.getElementById('courseList');
    if (!courseList) return;
    
    courseList.innerHTML = '';
    
    Object.values(courses).forEach(course => {
        const courseDiv = document.createElement('div');
        courseDiv.className = 'course-item';
        courseDiv.setAttribute('data-course-id', course.id);
        
        courseDiv.innerHTML = `
            <div class="course-info">
                <label>Course Title:</label>
                <input type="text" class="course-title" value="${course.title}" />
                <label>Course Context Prompt:</label>
                <textarea class="course-prompt" rows="4">${course.prompt}</textarea>
                <div class="course-actions">
                    <button class="save-course-btn" onclick="saveCourse('${course.id}')">💾 Save</button>
                    <button class="delete-course-btn" onclick="deleteCourse('${course.id}')">🗑️ Delete</button>
                </div>
            </div>
        `;
        
        courseList.appendChild(courseDiv);
    });
}

// Add a new course
function addNewCourse() {
    const courseId = 'course-' + Date.now();
    const newCourse = {
        id: courseId,
        title: 'New Course',
        prompt: 'Enter the course context and description here...'
    };
    
    courses[courseId] = newCourse;
    renderCourseList();
    updateCourseSelector();
}

// Save a specific course
function saveCourse(courseId) {
    const courseItem = document.querySelector(`[data-course-id="${courseId}"]`);
    if (!courseItem) return;
    
    const title = courseItem.querySelector('.course-title').value.trim();
    const prompt = courseItem.querySelector('.course-prompt').value.trim();
    
    if (!title || !prompt) {
        alert('⚠️ Please fill in both course title and prompt.');
        return;
    }
    
    courses[courseId] = {
        id: courseId,
        title: title,
        prompt: prompt
    };
    
    saveCourses();
    updateCourseSelector();
    
    // Show success notification
    showNotification(`💾 Course "${title}" saved successfully!`, 2000);
}

// Delete a course
function deleteCourse(courseId) {
    const course = courses[courseId];
    if (!course) return;
    
    const confirmDelete = confirm(`🗑️ Are you sure you want to delete the course "${course.title}"?`);
    if (!confirmDelete) return;
    
    delete courses[courseId];
    
    // If this was the active course, switch to no course
    if (activeCourse === courseId) {
        activeCourse = '';
        document.getElementById('activeCourseSelect').value = '';
    }
    
    saveCourses();
    renderCourseList();
    updateCourseSelector();
    
    showNotification(`🗑️ Course "${course.title}" deleted.`, 2000);
}

// Update the course selector dropdown
function updateCourseSelector() {
    const select = document.getElementById('activeCourseSelect');
    if (!select) return;
    
    // Clear existing options except the first (no course)
    const firstOption = select.firstElementChild;
    select.innerHTML = '';
    select.appendChild(firstOption);
    
    // Add all courses as options
    Object.values(courses).forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = `📖 ${course.title}`;
        if (course.id === activeCourse) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

// Set the active course
function setActiveCourse() {
    const select = document.getElementById('activeCourseSelect');
    if (!select) return;
    
    activeCourse = select.value;
    saveCourses();
    
    if (activeCourse && courses[activeCourse]) {
        showNotification(`📚 Active course set to: ${courses[activeCourse].title}`, 2000);
    } else {
        showNotification('🎭 Switched to general AI Professor mode', 2000);
    }
}

// Get the current course context for system prompts
function getCurrentCourseContext() {
    if (!activeCourse || !courses[activeCourse]) {
        return '';
    }
    
    const course = courses[activeCourse];
    return `\n\nCOURSE CONTEXT:\nYou are specifically helping with: ${course.title}\nCourse Description: ${course.prompt}\n\nTailor your responses to be relevant to this specific course context.`;
}

// Override the prepareOpenAIMessages function to include course context
const originalPrepareOpenAIMessages = prepareOpenAIMessages;

window.prepareOpenAIMessages = (currentMessage) => {
    const messages = originalPrepareOpenAIMessages(currentMessage);
    
    // Add course context to the system message if there's an active course
    if (activeCourse && courses[activeCourse] && messages[0] && messages[0].role === 'system') {
        messages[0].content += getCurrentCourseContext();
    }
    
    return messages;
};

// Make chat history functions globally accessible
window.showChatHistory = showChatHistory;
window.hideChatHistory = hideChatHistory;
window.loadSession = loadSession;

// Initialize courses on page load
document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
});

console.log('🚀 AI Professor v4 Ultimate Edition - Ready for learning!');