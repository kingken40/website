/*
PRESENTATION GENERATOR - PAGE 3 JAVASCRIPT (AI-POWERED WITH OPENAI)
====================================================================
This JavaScript file handles AI-powered presentation generation using OpenAI's GPT-4o-mini.

MAIN FUNCTIONS:
1. getPresentationData() - Retrieves form data from page 1
2. generateAIPresentation() - Creates AI-powered presentation content using OpenAI
3. displayPresentation() - Shows the formatted AI-generated presentation
4. downloadPDF() - Exports presentation as PDF
5. downloadPowerPoint() - Exports presentation as PowerPoint

AI INTEGRATION:
Uses OpenAI's GPT-4o-mini API for advanced content generation with educational context.
COST: ~$0.0001-0.0003 per presentation (very affordable)

CONTENT GENERATION:
AI-generated content based on:
- Grade level (determines complexity, vocabulary, and pedagogical approach)
- Topic (drives content focus and subject-specific expertise)
- Number of slides (determines content distribution and depth)
- Standards/objectives (ensures educational alignment and measurable outcomes)
- Additional customization (personalizes for specific classroom needs)
*/

// OpenAI API Configuration
// TODO: Replace with your own OpenAI API key
// Get your API key from: https://platform.openai.com/api-keys
const OPENAI_CONFIG = {
    apiKey: 'YOUR_OPENAI_API_KEY_HERE',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.7,
    baseURL: 'https://api.openai.com/v1/chat/completions'
};

// Global variables
let presentationData = null;
let generatedSlides = [];

// DEBUGGING: Verify script is loading
console.log('🤖 AI-Powered Presentation Generator loaded successfully');

/*
STEP 1: GET PRESENTATION DATA FROM PAGE 1
==========================================
This function retrieves the form data passed from the input page
through URL parameters and converts it back to a usable JavaScript object.
*/
function getPresentationData() {
    const urlParams = new URLSearchParams(window.location.search);
    const dataString = urlParams.get('presentationData');
    
    if (dataString) {
        try {
            return JSON.parse(decodeURIComponent(dataString));
        } catch (error) {
            console.error('Error parsing presentation data:', error);
            return null;
        }
    }
    return null;
}

/*
STEP 2: GENERATE AI-POWERED PRESENTATION CONTENT
===============================================
This function uses OpenAI's GPT-4o-mini to create educational presentations
with advanced understanding of pedagogical principles and content standards.
*/
async function generateAIPresentation(data) {
    const { gradeLevel, topic, numSlides, standards, customization } = data;
    
    console.log('🚀 Starting AI generation for:', data.topic);
    updateAIStatus('🧠 Analyzing educational requirements...');
    
    try {
        // Create the educational AI prompt
        const prompt = createEducationalPrompt(data);
        
        updateAIStatus('🤖 Generating AI-powered content...');
        updateProgress('Connecting to OpenAI educational intelligence...');
        
        // Call OpenAI API
        const aiResponse = await callOpenAI(prompt);
        
        updateAIStatus('✨ Processing AI response...');
        updateProgress('Formatting educational content for optimal learning...');
        
        // Parse and structure the AI response
        const slides = parseAIResponse(aiResponse, parseInt(numSlides));
        
        updateAIStatus('✅ AI generation complete!');
        updateProgress('Ready for classroom use!');
        
        return slides;
        
    } catch (error) {
        console.error('AI Generation failed:', error);
        updateAIStatus('❌ AI generation failed');
        
        // Provide fallback options
        if (error.message.includes('401')) {
            throw new Error('Invalid OpenAI API key. Please check your configuration.');
        } else if (error.message.includes('429')) {
            throw new Error('API rate limit exceeded. Please wait and try again.');
        } else if (error.message.includes('insufficient_quota')) {
            throw new Error('OpenAI API quota exceeded. Please check your account billing.');
        } else {
            throw new Error(`AI generation failed: ${error.message}`);
        }
    }
}

/*
STEP 3: CREATE EDUCATIONAL AI PROMPT
====================================
This function creates a comprehensive prompt that leverages AI's understanding
of educational theory, curriculum standards, and age-appropriate content.
*/
function createEducationalPrompt(data) {
    const { gradeLevel, topic, numSlides, standards, customization } = data;
    
    return `You are an expert educator and instructional designer with 20+ years of experience creating engaging, standards-aligned presentations for ${gradeLevel} students.

PRESENTATION REQUIREMENTS:
- Topic: ${topic}
- Grade Level: ${gradeLevel}
- Number of Slides: ${numSlides}
- Educational Standards: ${standards || 'General educational best practices'}
- Special Requirements: ${customization || 'Standard classroom presentation'}

EDUCATIONAL OBJECTIVES:
Create a comprehensive ${numSlides}-slide presentation that:
1. Uses age-appropriate language and complexity for ${gradeLevel}
2. Follows pedagogical best practices for the target age group
3. Includes clear learning objectives and outcomes
4. Incorporates engaging activities and interactive elements
5. Aligns with educational standards and curriculum requirements
6. Provides assessment opportunities and knowledge checks

SLIDE STRUCTURE REQUIREMENTS:
- Slide 1: Title slide with compelling hook and clear learning objectives
- Slides 2-${Math.max(2, numSlides-1)}: Progressive content development with examples, activities, and engagement
- Slide ${numSlides}: Summary, assessment, and next steps

CONTENT GUIDELINES:
- Use developmentally appropriate vocabulary for ${gradeLevel}
- Include specific examples relevant to the age group
- Add interactive elements (questions, activities, discussions)
- Provide clear transitions between concepts
- Include visual suggestions where appropriate
- Add assessment checkpoints throughout

FORMAT REQUIREMENTS:
Present each slide as:
Slide [number]:
Title: [Clear, engaging title]
Content: [Detailed slide content with bullet points, examples, activities]
Teacher Notes: [Brief presentation guidance]

Generate the complete ${numSlides}-slide presentation now:`;
}

/*
STEP 4: CALL OPENAI API
=======================
This function handles the API call to OpenAI's GPT-4o-mini model
with proper error handling and educational context.
*/
async function callOpenAI(prompt) {
    const payload = {
        model: OPENAI_CONFIG.model,
        messages: [
            {
                role: "system",
                content: "You are an expert educational content creator specializing in K-12 and university-level presentations. You understand pedagogical principles, curriculum standards, and age-appropriate content development."
            },
            {
                role: "user", 
                content: prompt
            }
        ],
        max_tokens: OPENAI_CONFIG.maxTokens,
        temperature: OPENAI_CONFIG.temperature,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
    };

    try {
        console.log('🔧 Making OpenAI API request...');
        
        const response = await fetch(OPENAI_CONFIG.baseURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
            },
            body: JSON.stringify(payload)
        });
        
        console.log('🔧 OpenAI Response status:', response.status);

        if (!response.ok) {
            let errorDetails = `Status: ${response.status}`;
            try {
                const error = await response.json();
                errorDetails = error.error?.message || JSON.stringify(error);
            } catch (e) {
                errorDetails = response.statusText;
            }
            throw new Error(`OpenAI API Error: ${errorDetails}`);
        }

        const data = await response.json();
        
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            throw new Error('No content generated by OpenAI');
        }
        
    } catch (error) {
        console.error('OpenAI API call failed:', error);
        throw error;
    }
}

/*
STEP 5: PARSE AI RESPONSE INTO STRUCTURED SLIDES
===============================================
This function processes the AI-generated content and structures it
into individual slides for display and export.
*/
function parseAIResponse(aiResponse, expectedSlides) {
    try {
        // Split response into slides using "Slide X:" as delimiter
        const slideRegex = /Slide (\d+):(.*?)(?=Slide \d+:|$)/gs;
        const slides = [];
        let match;
        
        while ((match = slideRegex.exec(aiResponse)) !== null) {
            const slideNumber = parseInt(match[1]);
            const slideContent = match[2].trim();
            slides.push(`Slide ${slideNumber}:\n${slideContent}`);
        }
        
        // If parsing failed, try alternative format
        if (slides.length === 0) {
            const lines = aiResponse.split('\n');
            let currentSlide = '';
            let slideCount = 0;
            
            for (const line of lines) {
                if (line.toLowerCase().includes('slide') && line.includes(':')) {
                    if (currentSlide) {
                        slides.push(currentSlide);
                    }
                    slideCount++;
                    currentSlide = `Slide ${slideCount}:\n${line}\n`;
                } else if (currentSlide) {
                    currentSlide += line + '\n';
                }
            }
            if (currentSlide) {
                slides.push(currentSlide);
            }
        }
        
        // Validate we got the expected number of slides
        if (slides.length !== expectedSlides) {
            console.warn(`Expected ${expectedSlides} slides, got ${slides.length}`);
            
            // Pad missing slides if needed
            while (slides.length < expectedSlides) {
                slides.push(`Slide ${slides.length + 1}:\nTitle: Additional Content\nContent: AI content generation incomplete. Please regenerate for full presentation.`);
            }
            
            // Trim extra slides if needed
            while (slides.length > expectedSlides) {
                slides.pop();
            }
        }
        
        return slides;
        
    } catch (error) {
        console.error('Error parsing AI response:', error);
        throw new Error('Failed to parse AI-generated content');
    }
}

/*
STEP 6: DISPLAY AI-GENERATED PRESENTATION
=========================================
This function formats and displays the AI-generated presentation
in a clean, readable format for educators.
*/
function displayPresentation(slides) {
    const container = document.getElementById('presentationContainer');
    
    let html = '<div class="ai-presentation">';
    
    slides.forEach((slide, index) => {
        const slideNumber = index + 1;
        const slideContent = slide.replace(`Slide ${slideNumber}:`, '').trim();
        
        html += `
            <div class="slide-section" style="margin-bottom: 2rem; padding: 1.5rem; border: 1px solid #ddd; border-radius: 8px; background: #fafafa;">
                <h3 style="color: #6c63ff; margin-bottom: 1rem;">📄 Slide ${slideNumber}</h3>
                <div style="white-space: pre-wrap; line-height: 1.6; color: #333;">${slideContent}</div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

/*
UI HELPER FUNCTIONS
==================
These functions manage the user interface during AI generation
*/
function showLoadingSpinner() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('presentationContainer').style.display = 'none';
}

function hideLoadingSpinner() {
    document.getElementById('loadingSpinner').style.display = 'none';
    document.getElementById('presentationContainer').style.display = 'block';
}

function updateAIStatus(message) {
    const statusElement = document.getElementById('statusText');
    if (statusElement) {
        statusElement.textContent = message;
    }
}

function updateProgress(message) {
    const progressElement = document.getElementById('progressDetails');
    if (progressElement) {
        progressElement.textContent = message;
    }
}

function showErrorMessage(message) {
    document.getElementById('errorContainer').style.display = 'block';
    document.getElementById('errorMessage').textContent = message;
    hideLoadingSpinner();
}

/*
DOWNLOAD FUNCTIONS
==================
These functions handle PDF and PowerPoint export of AI-generated content
*/
function downloadPDF() {
    // Implementation for PDF download
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('AI-Generated Educational Presentation', 20, 20);
    
    let yPosition = 40;
    
    generatedSlides.forEach((slide, index) => {
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }
        
        doc.setFontSize(16);
        doc.text(`Slide ${index + 1}`, 20, yPosition);
        yPosition += 10;
        
        doc.setFontSize(12);
        const slideContent = slide.replace(`Slide ${index + 1}:`, '').trim();
        const lines = doc.splitTextToSize(slideContent, 170);
        
        lines.forEach(line => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }
            doc.text(line, 20, yPosition);
            yPosition += 7;
        });
        
        yPosition += 10;
    });
    
    doc.save('ai-presentation.pdf');
}

function downloadPowerPoint() {
    // Implementation for PowerPoint download
    const pptx = new PptxGenJS();
    
    generatedSlides.forEach((slide, index) => {
        const slideObj = pptx.addSlide();
        const slideContent = slide.replace(`Slide ${index + 1}:`, '').trim();
        
        slideObj.addText(`Slide ${index + 1}`, {
            x: 0.5,
            y: 0.5,
            w: '90%',
            h: 1,
            fontSize: 24,
            bold: true,
            color: '363636'
        });
        
        slideObj.addText(slideContent, {
            x: 0.5,
            y: 1.5,
            w: '90%',
            h: '80%',
            fontSize: 14,
            color: '363636'
        });
    });
    
    pptx.writeFile({ fileName: 'ai-presentation.pptx' });
}

/*
PAGE INITIALIZATION
===================
This code runs when the page loads to generate and display
the AI-powered presentation based on the data from page 1.
*/
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🤖 AI Presentation Generator initialized');
    
    // Get the presentation data from URL parameters
    presentationData = getPresentationData();
    console.log('📊 Presentation data retrieved:', presentationData);
    
    if (presentationData) {
        try {
            // Show loading state immediately
            showLoadingSpinner();
            updateAIStatus('🚀 Initializing AI presentation generator...');
            
            console.log('🤖 Starting AI presentation generation with data:', presentationData);
            
            // Generate presentation using OpenAI
            updateAIStatus('🧠 AI is analyzing your educational requirements...');
            generatedSlides = await generateAIPresentation(presentationData);
            
            // Display the presentation
            updateAIStatus('✨ Formatting AI-generated content...');
            displayPresentation(generatedSlides);
            
            updateAIStatus('🎉 AI presentation ready for classroom use!');
            console.log('🎉 AI presentation generated successfully');
            console.log('Generated slides:', generatedSlides);
            
        } catch (error) {
            console.error('AI Presentation generation failed:', error);
            showErrorMessage(`AI generation failed: ${error.message}`);
        } finally {
            hideLoadingSpinner();
        }
    } else {
        // Handle case where no data is available
        document.getElementById('presentationContainer').innerHTML = `
            <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
                <h3>No presentation data found</h3>
                <p>Please go back to the input form and create a new presentation.</p>
                <button onclick="window.location.href='pg_p1.html'" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #6366f1; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Go to Input Form
                </button>
            </div>
        `;
    }
});