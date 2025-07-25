/**
 * LESSON PLANNER - PAGE 2 (DISPLAY & EXPORT) JAVASCRIPT
 * This file contains all the JavaScript functionality for the second page
 * of the Lesson Planner application, which handles displaying the generated
 * lesson plan and exporting it to PDF and DOCX formats.
 * 
 * The AI-generated content is processed and formatted for display and export.
 */

/**
 * DOCX LIBRARY LOADING
 * Handles loading the docx library for DOCX document generation
 */

/**
 * Loads the docx library from various CDN sources with fallback options
 * @returns {Promise} Resolves with the docx library object when loaded successfully
 */
function loadDocxBrowser() {
  return new Promise((resolve, reject) => {
    // Check if docx is already loaded
    if (window.docx) {
      console.log('docx library already loaded');
      resolve(window.docx);
      return;
    }
    
    // Try multiple CDN sources for better reliability
    const sources = [
      'https://unpkg.com/docx@7.1.0/build/index.js',
      'https://cdn.jsdelivr.net/npm/docx@7.1.0/build/index.js',
      'https://cdnjs.cloudflare.com/ajax/libs/docx/7.1.0/index.js'
    ];
    
    let loadAttempts = 0;
    
    // Function to try loading from each source until successful
    function tryNextSource(index) {
      if (index >= sources.length) {
        reject(new Error(`Failed to load docx library after trying ${sources.length} sources`));
        return;
      }
      
      loadAttempts++;
      console.log(`Attempting to load docx library (attempt ${loadAttempts}/${sources.length})`);
      
      const script = document.createElement('script');
      script.src = sources[index];
      
      script.onload = () => {
        // Verify the library is properly loaded
        if (window.docx && typeof window.docx.Document === 'function') {
          console.log('docx library loaded successfully from', sources[index]);
          resolve(window.docx);
        } else {
          console.warn('Script loaded but docx not properly initialized, trying next source');
          tryNextSource(index + 1);
        }
      };
      
      script.onerror = () => {
        console.warn('Failed to load from', sources[index]);
        tryNextSource(index + 1);
      };
      
      document.head.appendChild(script);
    }
    
    // Start loading from the first source
    tryNextSource(0);
  });
}

/**
 * LESSON PLAN GENERATION
 * Handles parsing URL parameters and generating the lesson plan content
 */

// Parse the lesson plan data from URL
const params = new URLSearchParams(window.location.search);
const lessonPlanData = JSON.parse(decodeURIComponent(params.get("lessonPlan") || "{}"));
const { gradeLevel = "", topic = "", standards = "", customization = "", language = "en" } = lessonPlanData;

/**
 * Main function to generate the lesson plan and insert it into the page
 * @returns {Promise} Resolves with the generated HTML content
 */
async function generateLessonPlan() {
    try {
        // Make sure we're using the data extracted from the URL
        const lessonPlan = generateLessonPlanContent({
            gradeLevel,
            topic,
            standards,
            customization,
            language
        });
        document.getElementById("lessonContainer").innerHTML = lessonPlan;
        return lessonPlan;
    } catch (error) {
        console.error('Error generating lesson plan:', error);
        throw error;
    }
}

/**
 * Generates the HTML content for the lesson plan based on the provided data
 * @param {Object} data - The lesson plan data from page 1
 * @returns {string} HTML content for the lesson plan
 */
function generateLessonPlanContent({gradeLevel, topic, standards, customization}) {
    const defaultTopic = 'the topic';
    
    // Extract file name if standards contains a file upload
    let uploadedFileName = '';
    let isFileUploaded = false;
    
    if (standards && standards.includes('File uploaded:')) {
        isFileUploaded = true;
        // Extract the file name from the standards text
        const fileMatch = standards.match(/File uploaded:\s*([^<\n]+)/);
        if (fileMatch && fileMatch[1]) {
            uploadedFileName = fileMatch[1].trim();
        }
    }
    
    // Process standards into a list
    let standardsList = [];
    
    if (standards) {
        if (isFileUploaded) {
            // If it's a Python-related topic and we have a file upload, use more specific standards
            if (topic && topic.toLowerCase().includes('python')) {
                standardsList = [
                    'ISTE Standard 5.1: Students formulate problem definitions suited for technology-assisted methods such as data analysis, abstract models and algorithmic thinking in exploring and finding solutions.',
                    'ISTE Standard 5.2: Students collect data or identify relevant data sets, use digital tools to analyze them, and represent data in various ways to facilitate problem-solving and decision-making.',
                    'CS2013 (ACM/IEEE): Knowledge Area: Programming Languages - Understanding of variables, data types, expressions, and statements.',
                    'CS2013 (ACM/IEEE): Knowledge Area: Software Development Fundamentals - Fundamental programming concepts.'
                ];
                
                // Add reference to the uploaded file
                if (uploadedFileName) {
                    standardsList.push(`Course-specific objectives from uploaded file: ${uploadedFileName}`);
                }
            } else {
                // Generic standards with reference to uploaded file
                standardsList = [
                    'CCSS.ELA-Literacy.W.9-10.2: Write informative/explanatory texts to examine a topic and convey ideas and information clearly.',
                    'ISTE Standard for Students 5: Computational thinker - Students develop and employ strategies for understanding and solving problems in ways that leverage the power of technological methods to develop and test solutions.'
                ];
                
                // Add reference to the uploaded file
                if (uploadedFileName) {
                    standardsList.push(`Additional standards from uploaded file: ${uploadedFileName}`);
                }
            }
        } else {
            // Otherwise use the provided standards
            standardsList = standards.split('\n')
                .map(standard => standard.trim())
                .filter(Boolean);
        }
    } else {
        standardsList = ['Standards not specified'];
    }

    // Create HTML for standards section
    const standardsHtml = `
        <h2>Standards Addressed:</h2>
        <ul>
            ${standardsList.map(standard => `<li>${standard}</li>`).join('')}
        </ul>
    `;

    // Adapt content based on grade level
    let gradeLevelContent = '';
    if (gradeLevel) {
        // Determine appropriate language and complexity based on grade level
        if (gradeLevel.includes('Pre-K') || gradeLevel.includes('Kindergarten') || 
            gradeLevel.includes('1st') || gradeLevel.includes('2nd')) {
            gradeLevelContent = `
                <p>This lesson is designed with age-appropriate activities for young learners, focusing on:
                <ul>
                    <li>Hands-on exploration and discovery</li>
                    <li>Visual aids and concrete examples</li>
                    <li>Short, engaging activities with frequent transitions</li>
                    <li>Opportunities for movement and interactive learning</li>
                </ul>
                </p>
            `;
        } else if (gradeLevel.includes('3rd') || gradeLevel.includes('4th') || 
                  gradeLevel.includes('5th') || gradeLevel.includes('6th')) {
            gradeLevelContent = `
                <p>This lesson is tailored for elementary/middle grade students with:
                <ul>
                    <li>A balance of concrete examples and abstract concepts</li>
                    <li>Collaborative learning opportunities</li>
                    <li>Scaffolded instruction with gradual release of responsibility</li>
                    <li>Multiple representations of key concepts</li>
                </ul>
                </p>
            `;
        } else if (gradeLevel.includes('7th') || gradeLevel.includes('8th') || 
                  gradeLevel.includes('9th') || gradeLevel.includes('10th')) {
            gradeLevelContent = `
                <p>This lesson is designed for middle/high school students with:
                <ul>
                    <li>Critical thinking and analytical skills development</li>
                    <li>Connections to real-world applications</li>
                    <li>Opportunities for independent and collaborative problem-solving</li>
                    <li>Integration of technology and digital literacy skills</li>
                </ul>
                </p>
            `;
        } else {
            gradeLevelContent = `
                <p>This advanced lesson is designed for upper high school/university students with:
                <ul>
                    <li>In-depth analysis and synthesis of complex concepts</li>
                    <li>Research-based learning opportunities</li>
                    <li>Application of concepts to novel situations</li>
                    <li>Preparation for college/career readiness</li>
                </ul>
                </p>
            `;
        }
    }
    
    // Generate topic-specific content
    let topicSpecificContent = '';
    let keyPoints = '';
    let objectives = '';
    let openingActivity = '';
    let assessmentContent = '';
    
    // Customize content based on topic
    if (topic && topic.toLowerCase().includes('python') && topic.toLowerCase().includes('variable')) {
        // Specific content for Python Variables lesson
        objectives = `
            <p>Students will be able to:</p>
            <ul>
                <li>Define variables and explain their purpose in Python programming</li>
                <li>Identify and use different data types in Python (integers, floats, strings, booleans)</li>
                <li>Demonstrate proper variable naming conventions and best practices</li>
                <li>Write code that declares, assigns, and manipulates variables</li>
            </ul>
        `;
        
        keyPoints = `
            <ul>
                <li><strong>Definition of a Variable:</strong> A container for storing data values, such as x = 5</li>
                <li><strong>Data Types:</strong> Common data types in Python include integers (int), floats (float), strings (str), and booleans (bool)</li>
                <li><strong>Variable Naming:</strong> Use descriptive names, follow lowercase conventions, and avoid starting names with numbers or special characters</li>
                <li><strong>Dynamic Typing:</strong> Python variables can change types during execution, unlike statically typed languages</li>
                <li><strong>Assignment Operator:</strong> The equals sign (=) is used to assign values to variables</li>
            </ul>
        `;
        
        openingActivity = `
            <ul>
                <li><strong>Engagement (5-7 minutes):</strong> Begin by asking students: "What do you think happens when you store a value in a box and then change what's inside?" Engage students in a brief discussion about variables in a real-world context (e.g., a box for storing items)</li>
                <li><strong>Prior Knowledge Activation:</strong> Ask students about their experiences with variables in mathematics or other programming languages</li>
                <li><strong>Learning Targets:</strong> Clearly communicate that students will understand how to create and use variables in Python</li>
                <li><strong>Success Criteria:</strong> Explain that students will demonstrate success by writing a program that uses variables of different types</li>
            </ul>
        `;
        
        assessmentContent = `
            <p>Student understanding will be assessed through:</p>
            <ul>
                <li><strong>Formative Assessment:</strong> In-class coding exercises where students create and manipulate variables</li>
                <li><strong>Summative Assessment:</strong> A programming task where students declare variables, assign values to them, and print them in a formatted sentence</li>
                <li><strong>Self-Assessment:</strong> Students will review their code against a provided checklist of best practices</li>
                <li><strong>Peer Assessment:</strong> Students will review each other's code for proper variable naming and usage</li>
            </ul>
        `;
        
        topicSpecificContent = `
            <h2>Introduction to New Material:</h2>
            <ul>
                <li><strong>Direct Instruction (10-15 minutes):</strong> Present the definition of variables with examples: name = "Alice", age = 20</li>
                <li><strong>Data Types Explanation:</strong> Discuss the different data types with examples:
                    <ul>
                        <li>Integers: age = 20</li>
                        <li>Floats: pi = 3.14159</li>
                        <li>Strings: name = "Alice"</li>
                        <li>Booleans: is_student = True</li>
                    </ul>
                </li>
                <li><strong>Common Misconceptions:</strong> Address that variables are not just for numbers; they can store various data types</li>
                <li><strong>Visual Supports:</strong> Use diagrams showing variables as labeled containers holding different types of data</li>
            </ul>
            
            <h2>Guided Practice:</h2>
            <ul>
                <li><strong>Scaffolded Activities (15-20 minutes):</strong> Have students practice by declaring their own variables for name, age, and grade</li>
                <li><strong>Collaborative Work:</strong> In pairs, have students create variables and predict their data types</li>
                <li><strong>Questioning Strategies:</strong> 
                    <ul>
                        <li>Start with: "What is a variable?"</li>
                        <li>Progress to: "Can someone explain the difference between an integer and a float?"</li>
                        <li>Advanced: "What happens if we try to add a string and an integer in Python?"</li>
                    </ul>
                </li>
                <li><strong>Immediate Feedback:</strong> Monitor student work and provide guidance on syntax errors and variable naming</li>
            </ul>
            
            <h2>Independent Practice:</h2>
            <ul>
                <li><strong>Individual Application (15-20 minutes):</strong> Students write a program that:
                    <ul>
                        <li>Declares three variables: name, age, and grade</li>
                        <li>Assigns appropriate values to these variables</li>
                        <li>Prints a sentence using these variables, e.g., "Alice is 20 years old and has a grade of 95."</li>
                    </ul>
                </li>
                <li><strong>Challenge Extensions:</strong> For students who finish early, ask them to modify their program to include a boolean variable and use it in a conditional statement</li>
                <li><strong>Support Structures:</strong> Provide a template with comments for students who need additional guidance</li>
            </ul>
            
            <h2>Closing:</h2>
            <ul>
                <li><strong>Synthesis (5-7 minutes):</strong> Summarize key concepts about Python variables and their importance in programming</li>
                <li><strong>Student Reflection:</strong> Have students share their printed sentences with a partner and discuss the variables they used</li>
                <li><strong>Connection:</strong> Explain how variables will be used in future lessons on control structures and functions</li>
                <li><strong>Exit Assessment:</strong> Students submit their working code before leaving class</li>
            </ul>
            
            <h2>Extensions:</h2>
            <ul>
                <li><strong>Extension Activity:</strong> For students who finish early, ask them to modify their program to include a boolean variable (e.g., is_student) and print a message that includes this additional information.</li>
            </ul>
            
            <h2>Homework:</h2>
            <ul>
                <li><strong>Assignment:</strong> Assign students to research and write a brief paragraph on how variables might be used in a real-world application (e.g., in a game, app development, or data analysis)</li>
            </ul>
            
            <h2>Materials Needed:</h2>
            <ul>
                <li>Python development environment (IDLE, PyCharm, or online environment like Repl.it)</li>
                <li>Sample code snippets demonstrating variable usage</li>
                <li>Handout with variable naming conventions and best practices</li>
                <li>Assessment rubric for the programming task</li>
                ${uploadedFileName ? `<li>Reference materials from: ${uploadedFileName}</li>` : ''}
            </ul>
        `;
    } else {
        // Generic content for other topics
        objectives = `
            <p>By the end of this lesson, students will be able to:</p>
            <ul>
                <li>Understand key concepts related to ${topic || defaultTopic}</li>
                <li>Apply their knowledge of ${topic || defaultTopic} to solve relevant problems</li>
                <li>Analyze and evaluate information about ${topic || defaultTopic}</li>
                <li>Create original work demonstrating mastery of ${topic || defaultTopic}</li>
            </ul>
        `;
        
        keyPoints = `
            <ul>
                <li>Core principles and concepts of ${topic || defaultTopic}</li>
                <li>Essential vocabulary and terminology related to ${topic || defaultTopic}</li>
                <li>Common misconceptions about ${topic || defaultTopic}</li>
                <li>Real-world applications and relevance of ${topic || defaultTopic}</li>
            </ul>
        `;
        
        openingActivity = `
            <ul>
                <li><strong>Engagement (5-7 minutes):</strong> Begin with a compelling hook related to ${topic || defaultTopic} to capture student interest</li>
                <li><strong>Prior Knowledge Activation:</strong> Connect ${topic || defaultTopic} to students' existing knowledge and experiences</li>
                <li><strong>Learning Targets:</strong> Clearly communicate what students will know and be able to do</li>
                <li><strong>Success Criteria:</strong> Share how students will demonstrate their understanding</li>
            </ul>
        `;
        
        assessmentContent = `
            <p>Student understanding will be assessed through:</p>
            <ul>
                <li><strong>Formative Assessment:</strong> Questioning, discussion contributions, exit tickets</li>
                <li><strong>Summative Assessment:</strong> Project completion, written response, performance task</li>
                <li><strong>Self-Assessment:</strong> Reflection on learning, self-evaluation rubric</li>
                <li><strong>Peer Assessment:</strong> Collaborative feedback, peer review</li>
            </ul>
        `;
        
        topicSpecificContent = `
            <h2>Introduction to New Material:</h2>
            <ul>
                <li><strong>Direct Instruction (10-15 minutes):</strong> Present key information about ${topic || defaultTopic}</li>
                <li><strong>Modeling:</strong> Demonstrate processes and thinking related to ${topic || defaultTopic}</li>
                <li><strong>Visual Supports:</strong> Utilize diagrams, charts, or multimedia to illustrate concepts</li>
                <li><strong>Check for Understanding:</strong> Verify student comprehension before moving to practice</li>
            </ul>
            
            <h2>Guided Practice:</h2>
            <ul>
                <li><strong>Scaffolded Activities (15-20 minutes):</strong> Support students as they begin applying knowledge of ${topic || defaultTopic}</li>
                <li><strong>Collaborative Work:</strong> Facilitate partner or small group activities</li>
                <li><strong>Questioning Strategies:</strong> Use targeted questions to deepen understanding</li>
                <li><strong>Immediate Feedback:</strong> Provide correction and guidance as students work</li>
            </ul>
            
            <h2>Independent Practice:</h2>
            <ul>
                <li><strong>Individual Application (15-20 minutes):</strong> Students demonstrate their understanding of ${topic || defaultTopic}</li>
                <li><strong>Differentiated Tasks:</strong> Provide tiered activities based on readiness levels</li>
                <li><strong>Challenge Extensions:</strong> Offer opportunities for advanced application</li>
                <li><strong>Support Structures:</strong> Make available resources for students who need additional help</li>
            </ul>
            
            <h2>Closing:</h2>
            <ul>
                <li><strong>Synthesis (5-7 minutes):</strong> Summarize key learning about ${topic || defaultTopic}</li>
                <li><strong>Student Reflection:</strong> Guide students to articulate what they've learned</li>
                <li><strong>Connection:</strong> Link this lesson to upcoming content or real-world applications</li>
                <li><strong>Exit Assessment:</strong> Quick check for understanding before dismissal</li>
            </ul>
            
            <h2>Extensions:</h2>
            <ul>
                <li><strong>Enrichment:</strong> Additional resources for students seeking deeper understanding</li>
                <li><strong>Remediation:</strong> Support materials for students needing additional practice</li>
            </ul>
            
            <h2>Homework:</h2>
            <ul>
                <li><strong>Assignment:</strong> Meaningful practice or preparation for next lesson</li>
                <li><strong>Family Connection:</strong> Suggestions for home reinforcement of concepts</li>
            </ul>
            
            <h2>Materials Needed:</h2>
            <ul>
                <li>Presentation materials (slides, visuals, manipulatives)</li>
                <li>Student handouts and worksheets</li>
                <li>Assessment tools (rubrics, exit tickets, etc.)</li>
                <li>Technology resources (if applicable)</li>
                ${uploadedFileName ? `<li>Reference materials from: ${uploadedFileName}</li>` : ''}
                ${customization ? `<li>Custom materials: ${customization}</li>` : ''}
            </ul>
        `;
    }

    // Return the complete lesson plan HTML with the specified structured sections
    return `
        <h1>${topic || 'Untitled Lesson'}</h1>
        ${gradeLevel ? `<p><strong>Grade Level:</strong> ${gradeLevel}</p>` : ''}
        ${gradeLevelContent}
        
        <h2>Objective:</h2>
        ${objectives}
        
        <h2>Key Points:</h2>
        ${keyPoints}
        
        <h2>Assessment:</h2>
        ${assessmentContent}
        
        <h2>Opening:</h2>
        ${openingActivity}
        
        ${topicSpecificContent}
        
        ${standardsHtml}
        
        ${customization ? `<h2>Additional Notes:</h2><p>${customization}</p>` : ''}
    `;
}

/**
 * LANGUAGE TRANSLATION
 * Handles Google Translate integration for multi-language support
 */

/**
 * Initializes the Google Translate element for page translation
 */
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,fr,de,zh-CN,ja,ar,pt,ru,hi',
        autoDisplay: false
    }, 'google_translate_element');

    // Automatically select the language from URL parameter
    setTimeout(() => {
        const select = document.querySelector('#google_translate_element select');
        if (select) {
            select.value = language;
            select.dispatchEvent(new Event('change'));
        }
    }, 1000);
}

/**
 * PDF GENERATION
 * Handles converting the lesson plan to PDF format for download
 */

/**
 * Generates and downloads a PDF version of the lesson plan
 */
function generatePDF() {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    // Set margins and initial position
    const marginLeft = 15;
    const marginRight = 15;
    const marginTop = 20;
    let currentY = marginTop;
    const pageWidth = pdf.internal.pageSize.getWidth() - marginLeft - marginRight;
    
    // Set font styles
    const titleFontSize = 19;
    const headingFontSize = 15;
    const bodyFontSize = 12;
    const lineHeight = 1.5;

    /**
     * Adds text to the PDF with automatic page breaks
     * @param {string} text - The text to add
     * @param {number} fontSize - The font size to use
     * @param {boolean} isBold - Whether the text should be bold
     */
    function addText(text, fontSize = bodyFontSize, isBold = false) {
        pdf.setFontSize(fontSize);
        pdf.setFont(undefined, isBold ? 'bold' : 'normal');
        
        const splitText = pdf.splitTextToSize(text, pageWidth);
        for (let i = 0; i < splitText.length; i++) {
            if (currentY > pdf.internal.pageSize.getHeight() - 20) {
                pdf.addPage();
                currentY = marginTop;
            }
            pdf.text(splitText[i], marginLeft, currentY);
            currentY += fontSize * 0.5; // Tight line spacing
        }
    }

    /**
     * Adds a section to the PDF with title and content
     * @param {string} title - The section title
     * @param {string} content - The section content
     */
    function addSection(title, content) {
        addText(title, headingFontSize, true);
        currentY += 2; // Minimal space after heading
        addText(content);
        currentY += 3; // Minimal space between sections
    }

    // Get the lesson plan content
    const lessonHTML = document.getElementById("lessonContainer").innerHTML;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = lessonHTML;
    
    // Extract and format sections
    const sections = [];
    const elements = tempDiv.children;
    
    // Process each element in the lesson plan
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.tagName === 'H1') {
            // Handle the title
            pdf.setFontSize(titleFontSize);
            pdf.setFont(undefined, 'bold');
            addText(el.textContent, titleFontSize, true);
            currentY += 10;
        } 
        else if (el.tagName === 'H2') {
            // Start a new section
            sections.push({
                title: el.textContent,
                content: ''
            });
        }
        else if (sections.length > 0) {
            // Add content to the current section
            const lastSection = sections[sections.length - 1];
            if (el.tagName === 'P') {
                lastSection.content += el.textContent + '\n\n';
            } 
            else if (el.tagName === 'UL') {
                const items = el.getElementsByTagName('li');
                for (let j = 0; j < items.length; j++) {
                    lastSection.content += '• ' + items[j].textContent + '\n';
                }
                lastSection.content += '\n';
            }
        }
    }

    // Add all sections to PDF
    sections.forEach(section => {
        addSection(section.title, section.content);
    });

    // Save the PDF file
    pdf.save("lesson_plan.pdf");
}

/**
 * DOCX GENERATION
 * Handles converting the lesson plan to DOCX format for download
 */

/**
 * Generates and downloads a DOCX version of the lesson plan
 */
async function generateDOCX() {
    const btn = document.getElementById('downloadDocxBtn');
    const originalText = btn.textContent;
    const originalColor = btn.style.backgroundColor;
    
    try {
        // Show loading state
        btn.textContent = 'Generating DOCX...';
        btn.style.backgroundColor = '#ccc';
        btn.style.cursor = 'not-allowed';
        
        // Make sure docx library is loaded
        let docxLib;
        try {
            // First check if it's already available globally
            if (window.docx && typeof window.docx.Document === 'function') {
                docxLib = window.docx;
                console.log('Using globally available docx library');
            } else {
                // Try to load it dynamically
                docxLib = await loadDocxBrowser();
                if (!docxLib) {
                    throw new Error('Document generator library not available');
                }
                // Make it available globally
                window.docx = docxLib;
                console.log('DOCX library loaded dynamically');
            }
            
            // Verify essential components
            if (!docxLib.Document || !docxLib.Paragraph || !docxLib.TextRun || !docxLib.Packer) {
                throw new Error('Required docx components not available');
            }
        } catch (loadError) {
            console.error('Failed to load docx library:', loadError);
            throw new Error(`Document generator library failed to load: ${loadError.message}`);
        }
        
        // Extract the lesson content
        const lessonContainer = document.getElementById("lessonContainer");
        if (!lessonContainer) {
            throw new Error('Lesson container element not found');
        }
        
        if (!lessonContainer.children || lessonContainer.children.length === 0) {
            throw new Error('No lesson content found to export');
        }
        
        // Get the title and content sections
        const titleElement = lessonContainer.querySelector("h1");
        const title = titleElement ? titleElement.textContent : "Lesson Plan";
        
        const sections = lessonContainer.querySelectorAll("h2");
        if (!sections || sections.length === 0) {
            throw new Error('No sections found in lesson content');
        }
        
        console.log(`Found lesson with title "${title}" and ${sections.length} sections`);
        
        // Create document with docx library
        try {
            // Verify docx components are available
            const Document = docxLib.Document;
            const Paragraph = docxLib.Paragraph;
            const TextRun = docxLib.TextRun;
            const Packer = docxLib.Packer;
            // AlignmentType might be nested or have a different structure
            let AlignmentType = docxLib.AlignmentType;
            if (!AlignmentType) {
                // Create a fallback if not available
                AlignmentType = {
                    CENTER: 'center',
                    LEFT: 'left',
                    RIGHT: 'right'
                };
                console.warn('Using fallback AlignmentType');
            }
            
            if (!Document || !Paragraph || !TextRun || !Packer) {
                throw new Error('Required docx components not available');
            }
            
            // Log available components for debugging
            console.log('Available docx components:', Object.keys(docxLib));
            
            // Create paragraphs array
            const paragraphs = [];
            
            // Add title
            paragraphs.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: title,
                            bold: true,
                            size: 36
                        })
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 200 }
                })
            );
            
            // Process each section
            Array.from(sections).forEach((section) => {
                // Add section heading
                paragraphs.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: section.textContent,
                                bold: true,
                                size: 28
                            })
                        ],
                        spacing: { before: 200, after: 100 }
                    })
                );
                
                // Process content elements
                let nextEl = section.nextElementSibling;
                while (nextEl && nextEl.tagName !== 'H2') {
                    if (nextEl.tagName === 'P') {
                        const text = nextEl.textContent.trim();
                        if (text) {
                            paragraphs.push(
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: text,
                                            size: 24
                                        })
                                    ],
                                    spacing: { after: 100 }
                                })
                            );
                        }
                    } 
                    else if (nextEl.tagName === 'UL') {
                        const items = nextEl.querySelectorAll('li');
                        if (items && items.length > 0) {
                            items.forEach(item => {
                                const itemText = item.textContent.trim();
                                if (itemText) {
                                    paragraphs.push(
                                        new Paragraph({
                                            children: [
                                                new TextRun({
                                                    text: "• " + itemText,
                                                    size: 24
                                                })
                                            ],
                                            indent: { left: 400 },
                                            spacing: { after: 50 }
                                        })
                                    );
                                }
                            });
                        }
                    }
                    
                    nextEl = nextEl.nextElementSibling;
                }
            });
            
            console.log(`Created ${paragraphs.length} paragraphs for the document`);
            
            // Create the document
            const doc = new Document({
                sections: [
                    {
                        properties: {},
                        children: paragraphs
                    }
                ]
            });
            
            console.log('Document created successfully');
            
            // Generate and download the document
            console.log('Starting document packing...');
            Packer.toBlob(doc).then(blob => {
                console.log('Document packed successfully, size:', blob.size);
                
                // Use FileSaver if available
                if (window.saveAs) {
                    console.log('Using FileSaver.js for download');
                    window.saveAs(blob, 'lesson_plan.docx');
                } else {
                    // Fallback to manual download
                    console.log('Using manual download approach');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'lesson_plan.docx';
                    document.body.appendChild(a);
                    a.click();
                    
                    // Clean up
                    setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    }, 100);
                }
                
                console.log('Document download initiated');
            }).catch(error => {
                console.error('Error in Packer.toBlob:', error);
                throw new Error(`Failed to generate document: ${error.message}`);
            });
            
        } catch (docxError) {
            console.error('Error creating DOCX document:', docxError);
            throw new Error(`DOCX creation failed: ${docxError.message}`);
        }
        
    } catch (error) {
        console.error('DOCX Generation Error:', error);
        alert(`Failed to generate DOCX: ${error.message}\n\nPlease check the console for details.`);
    } finally {
        // Reset button state
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = originalColor;
            btn.style.cursor = 'pointer';
        }, 1000);
    }
}

// Event Listeners and Initialization
document.addEventListener('DOMContentLoaded', function() {
    // Generate the lesson plan when the page loads
    generateLessonPlan()
        .then(() => {
            console.log('Lesson plan generated successfully');
        })
        .catch(error => {
            console.error('Error generating lesson plan:', error);
            alert('An error occurred while generating the lesson plan. Please try again.');
        });
    
    // Add event listeners for the download buttons
    
    // PDF button is currently commented out in the HTML
    // To restore PDF functionality:
    // 1. Uncomment the button in the HTML file
    // 2. Uncomment the event listener below
    // 3. Restore margin-left style to the DOCX button if needed
    const pdfBtn = document.getElementById('downloadPdfBtn');
    if (pdfBtn) {
        pdfBtn.addEventListener('click', generatePDF);
    }
    
    // DOCX download button
    document.getElementById('downloadDocxBtn').addEventListener('click', generateDOCX);
    
    // Try loading docx library when page loads
    if (window.docx && typeof window.docx.Document === 'function') {
        console.log('docx library already available from direct include');
    } else {
        // Otherwise try to load it dynamically
        loadDocxBrowser()
            .then(docx => {
                console.log('docx library loaded successfully via dynamic loading');
                // Make sure it's available globally
                if (!window.docx) {
                    window.docx = docx;
                }
            })
            .catch(error => {
                console.error('DOCX generator error:', error);
                const btn = document.getElementById('downloadDocxBtn');
                btn.textContent = 'Download DOCX (Unavailable)';
                btn.title = `DOCX download unavailable: ${error.message}\nPossible reasons:\n- Network connectivity issues\n- Content blockers\n- Browser restrictions`;
                btn.classList.add('download-button-error'); // Add red background class
            });
    }
    
    // Load Google Translate script dynamically
    const gtScript = document.createElement('script');
    gtScript.type = 'text/javascript';
    gtScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(gtScript);
});