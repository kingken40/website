/*
PRESENTATION GENERATOR - PAGE 2 JAVASCRIPT (TEXT-BASED FORMAT)
===============================================================
This JavaScript file handles the text-based presentation generation and display.

MAIN FUNCTIONS:
1. getPresentationData() - Retrieves form data from page 1
2. generateTextPresentation() - Creates text-based presentation content
3. displayPresentation() - Shows the formatted presentation
4. downloadPDF() - Exports presentation as PDF
5. downloadPowerPoint() - Exports presentation as PowerPoint

TEXT FORMAT:
The presentation is generated in the format:
Slide 1:
<content for slide 1>

Slide 2:
<content for slide 2>

etc.

CONTENT GENERATION:
Content is generated based on:
- Grade level (determines complexity and vocabulary)
- Topic (drives content focus)
- Number of slides (determines content distribution)
- Standards/objectives (ensures educational alignment)
- Additional customization (personalizes content)
*/

// Global variable to store the generated presentation data
let presentationData = null;
let generatedSlides = [];

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
STEP 2: GENERATE TEXT-BASED PRESENTATION CONTENT
===============================================
This is the core function that creates the presentation content
in the requested text format. It generates appropriate content
for each slide based on the input parameters.
*/
function generateTextPresentation(data) {
    const { gradeLevel, topic, numSlides, standards, customization } = data;
    const slides = [];
    
    // Generate content for each slide
    for (let i = 1; i <= parseInt(numSlides); i++) {
        const slideContent = generateSlideContent(i, topic, gradeLevel, standards, customization, parseInt(numSlides));
        slides.push(`Slide ${i}:\n${slideContent}`);
    }
    
    return slides;
}

/*
STEP 3: GENERATE INDIVIDUAL SLIDE CONTENT
=========================================
This function creates appropriate educational content for each slide
based on the slide number, topic, and grade level. The content
varies based on the slide's purpose in the presentation.
*/
function generateSlideContent(slideNumber, topic, gradeLevel, standards, customization, totalSlides) {
    // Adjust content complexity based on grade level
    const complexity = getComplexityLevel(gradeLevel);
    
    switch (slideNumber) {
        case 1:
            // Title slide with learning objectives
            return generateTitleSlide(topic, gradeLevel, standards);
            
        case 2:
            // Introduction/Definition slide
            return generateIntroductionSlide(topic, complexity);
            
        case 3:
            // Key concepts or examples
            if (totalSlides <= 4) {
                return generateSummarySlide(topic, complexity);
            } else {
                return generateKeyConceptsSlide(topic, complexity);
            }
            
        case 4:
            // Examples or activities
            if (totalSlides <= 5) {
                return generateSummarySlide(topic, complexity);
            } else {
                return generateExamplesSlide(topic, complexity);
            }
            
        case 5:
            // Practice or application
            if (totalSlides <= 6) {
                return generateSummarySlide(topic, complexity);
            } else {
                return generatePracticeSlide(topic, complexity);
            }
            
        default:
            // Additional content or summary
            if (slideNumber === totalSlides) {
                return generateSummarySlide(topic, complexity);
            } else {
                return generateAdditionalContentSlide(topic, complexity, slideNumber);
            }
    }
}

/*
CONTENT GENERATION HELPER FUNCTIONS
===================================
These functions generate specific types of educational content
appropriate for different slide purposes and grade levels.
*/

function getComplexityLevel(gradeLevel) {
    if (['Pre-K', 'Kindergarten', '1st Grade', '2nd Grade'].includes(gradeLevel)) {
        return 'elementary';
    } else if (['3rd Grade', '4th Grade', '5th Grade', '6th Grade'].includes(gradeLevel)) {
        return 'intermediate';
    } else if (['7th Grade', '8th Grade', '9th Grade'].includes(gradeLevel)) {
        return 'middle';
    } else if (['10th Grade', '11th Grade', '12th Grade'].includes(gradeLevel)) {
        return 'high';
    } else {
        return 'university';
    }
}

function generateTitleSlide(topic, gradeLevel, standards) {
    let content = `${topic}\n`;
    content += `Grade Level: ${gradeLevel}\n\n`;
    content += `Learning Objectives:\n`;
    content += `• Students will understand the basic concepts of ${topic}\n`;
    content += `• Students will be able to identify key elements related to ${topic}\n`;
    content += `• Students will apply their knowledge through examples and activities\n`;
    
    if (standards && standards.trim()) {
        content += `\nStandards Addressed:\n${standards.trim()}`;
    }
    
    return content;
}

function generateIntroductionSlide(topic, complexity) {
    let content = `What is ${topic}?\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `${topic} is an important concept that we use in our daily lives.\n\n`;
            content += `Key Points:\n`;
            content += `• ${topic} helps us understand the world around us\n`;
            content += `• We can see examples of ${topic} everywhere\n`;
            content += `• Learning about ${topic} is fun and useful`;
            break;
            
        case 'intermediate':
            content += `${topic} is a fundamental concept that plays an important role in many areas.\n\n`;
            content += `Key Points:\n`;
            content += `• ${topic} has specific characteristics that make it unique\n`;
            content += `• Understanding ${topic} helps us solve problems\n`;
            content += `• ${topic} connects to other concepts we've learned`;
            break;
            
        case 'middle':
            content += `${topic} is a complex concept with multiple components and applications.\n\n`;
            content += `Key Points:\n`;
            content += `• ${topic} involves several interconnected elements\n`;
            content += `• The principles of ${topic} can be applied in various contexts\n`;
            content += `• ${topic} has both theoretical and practical importance`;
            break;
            
        case 'high':
            content += `${topic} represents a sophisticated concept requiring analysis and critical thinking.\n\n`;
            content += `Key Points:\n`;
            content += `• ${topic} involves complex relationships and processes\n`;
            content += `• Understanding ${topic} requires examining multiple perspectives\n`;
            content += `• ${topic} has significant implications for advanced study`;
            break;
            
        default: // university
            content += `${topic} is an advanced concept requiring comprehensive analysis and synthesis.\n\n`;
            content += `Key Points:\n`;
            content += `• ${topic} encompasses multiple theoretical frameworks\n`;
            content += `• Research in ${topic} continues to evolve and expand\n`;
            content += `• ${topic} has interdisciplinary applications and implications`;
    }
    
    return content;
}

function generateKeyConceptsSlide(topic, complexity) {
    let content = `Key Concepts in ${topic}\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `Important Ideas:\n`;
            content += `• The main parts of ${topic}\n`;
            content += `• How ${topic} works in simple terms\n`;
            content += `• Why ${topic} is important to us\n`;
            content += `• Where we can find ${topic} in our lives`;
            break;
            
        default:
            content += `Essential Elements:\n`;
            content += `• Core principles underlying ${topic}\n`;
            content += `• Key relationships and connections\n`;
            content += `• Important terminology and definitions\n`;
            content += `• Foundational concepts for further learning`;
    }
    
    return content;
}

function generateExamplesSlide(topic, complexity) {
    let content = `Examples of ${topic}\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `Real-Life Examples:\n`;
            content += `• Example 1: Simple, everyday instance of ${topic}\n`;
            content += `• Example 2: Another common example students can relate to\n`;
            content += `• Example 3: Fun or interesting example to engage students\n`;
            content += `\nThink About It:\n`;
            content += `Can you think of other examples of ${topic} in your life?`;
            break;
            
        default:
            content += `Practical Applications:\n`;
            content += `• Example 1: Academic or professional application\n`;
            content += `• Example 2: Real-world scenario demonstrating ${topic}\n`;
            content += `• Example 3: Complex example showing advanced concepts\n`;
            content += `\nAnalysis:\n`;
            content += `Consider how these examples illustrate the key principles of ${topic}.`;
    }
    
    return content;
}

function generatePracticeSlide(topic, complexity) {
    let content = `Practice with ${topic}\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `Let's Try It!\n`;
            content += `Activity: Hands-on practice with ${topic}\n`;
            content += `Instructions:\n`;
            content += `1. Work with a partner or in small groups\n`;
            content += `2. Use the materials provided\n`;
            content += `3. Follow the steps to explore ${topic}\n`;
            content += `4. Share what you discover with the class\n\n`;
            content += `Materials Needed:\n`;
            content += `• Basic supplies for hands-on learning\n`;
            content += `• Worksheets or activity sheets\n`;
            content += `• Any special materials for ${topic}`;
            break;
            
        default:
            content += `Application Exercise\n`;
            content += `Challenge: Apply your knowledge of ${topic}\n`;
            content += `Instructions:\n`;
            content += `1. Analyze the given scenario\n`;
            content += `2. Apply the principles of ${topic}\n`;
            content += `3. Develop a solution or explanation\n`;
            content += `4. Present your findings to the class\n\n`;
            content += `Resources:\n`;
            content += `• Reference materials\n`;
            content += `• Collaboration with peers\n`;
            content += `• Additional research as needed`;
    }
    
    return content;
}

function generateSummarySlide(topic, complexity) {
    let content = `Summary: What We Learned About ${topic}\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `Today We Discovered:\n`;
            content += `• What ${topic} means and why it's important\n`;
            content += `• Examples of ${topic} in our daily lives\n`;
            content += `• How to recognize ${topic} when we see it\n`;
            content += `• Fun facts about ${topic}\n\n`;
            content += `Remember:\n`;
            content += `${topic} is all around us and helps us understand our world better!\n\n`;
            content += `Next Steps:\n`;
            content += `• Look for examples of ${topic} at home\n`;
            content += `• Practice what we learned today\n`;
            content += `• Get ready for our next exciting lesson!`;
            break;
            
        default:
            content += `Key Takeaways:\n`;
            content += `• Fundamental principles of ${topic}\n`;
            content += `• Important applications and examples\n`;
            content += `• Connections to other concepts\n`;
            content += `• Practical implications\n\n`;
            content += `Looking Forward:\n`;
            content += `• Continue exploring advanced aspects of ${topic}\n`;
            content += `• Apply these concepts in new contexts\n`;
            content += `• Prepare for more complex related topics`;
    }
    
    return content;
}

function generateAdditionalContentSlide(topic, complexity, slideNumber) {
    let content = `${topic} - Additional Insights (Slide ${slideNumber})\n\n`;
    
    switch (complexity) {
        case 'elementary':
            content += `More About ${topic}:\n`;
            content += `• Another interesting aspect of ${topic}\n`;
            content += `• A different way to think about ${topic}\n`;
            content += `• How ${topic} connects to other things we know\n`;
            content += `• A fun activity or game related to ${topic}`;
            break;
            
        default:
            content += `Extended Learning:\n`;
            content += `• Advanced concepts in ${topic}\n`;
            content += `• Current research and developments\n`;
            content += `• Cross-disciplinary connections\n`;
            content += `• Critical thinking challenges`;
    }
    
    return content;
}

/*
STEP 4: DISPLAY THE PRESENTATION
================================
This function takes the generated slides and displays them
in the requested text format on the webpage.
*/
function displayPresentation(slides) {
    const container = document.getElementById('presentationContainer');
    
    // Join all slides with double line breaks for clear separation
    const presentationText = slides.join('\n\n');
    
    // Display the text with proper formatting
    container.innerHTML = `<pre>${presentationText}</pre>`;
}

/*
STEP 5: DOWNLOAD FUNCTIONALITY
==============================
These functions allow users to export their presentations
in different formats while maintaining the slide structure.
*/

function downloadPDF() {
    const button = document.getElementById('downloadPdfBtn');
    button.textContent = 'Generating PDF...';
    
    try {
        // Create new PDF document
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        
        // Add each slide to the PDF
        generatedSlides.forEach((slide, index) => {
            if (index > 0) {
                pdf.addPage();
            }
            
            // Split slide content into lines for proper formatting
            const lines = pdf.splitTextToSize(slide, 180);
            pdf.text(lines, 20, 20);
        });
        
        // Save the PDF
        pdf.save(`${presentationData.topic || 'presentation'}.pdf`);
        
    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Error generating PDF. Please try again.');
    } finally {
        button.textContent = 'Download PDF';
    }
}

function downloadPowerPoint() {
    const button = document.getElementById('downloadPptxBtn');
    button.textContent = 'Generating PowerPoint...';
    
    try {
        // Create new PowerPoint presentation
        const pptx = new PptxGenJS();
        
        // Add each slide to the presentation
        generatedSlides.forEach((slideText, index) => {
            const slide = pptx.addSlide();
            
            // Extract slide title and content
            const lines = slideText.split('\n');
            const title = lines[0]; // First line is the slide title
            const content = lines.slice(1).join('\n').trim();
            
            // Add title
            slide.addText(title, {
                x: 0.5,
                y: 0.5,
                w: 9,
                h: 1,
                fontSize: 24,
                bold: true,
                color: '363636'
            });
            
            // Add content
            if (content) {
                slide.addText(content, {
                    x: 0.5,
                    y: 1.8,
                    w: 9,
                    h: 5,
                    fontSize: 14,
                    color: '363636',
                    valign: 'top'
                });
            }
        });
        
        // Save the PowerPoint file
        pptx.writeFile({ fileName: `${presentationData.topic || 'presentation'}.pptx` });
        
    } catch (error) {
        console.error('PowerPoint generation error:', error);
        alert('Error generating PowerPoint. Please try again.');
    } finally {
        button.textContent = 'Download PowerPoint';
    }
}

/*
STEP 6: INITIALIZATION
======================
This code runs when the page loads to generate and display
the presentation based on the data from page 1.
*/
document.addEventListener('DOMContentLoaded', function() {
    // Get the presentation data from URL parameters
    presentationData = getPresentationData();
    
    if (presentationData) {
        // Generate the text-based presentation
        generatedSlides = generateTextPresentation(presentationData);
        
        // Display the presentation
        displayPresentation(generatedSlides);
        
        console.log('Presentation generated successfully');
        console.log('Data:', presentationData);
        console.log('Generated slides:', generatedSlides);
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