/**
 * PRESENTATION GENERATOR - PAGE 1 (INPUT FORM) JAVASCRIPT
 * ========================================================
 * This file contains all the JavaScript functionality for the first page
 * of the Presentation Generator application, which handles the input form.
 * 
 * KEY FUNCTIONALITIES:
 * 1. Form validation and data collection
 * 2. File upload handling (multiple formats)
 * 3. URL input for external resources
 * 4. Data preparation for AI presentation generation
 * 5. User interface interactions and feedback
 * 
 * EDUCATIONAL PURPOSE:
 * Collects educator inputs that will be used to generate AI-powered,
 * standards-aligned presentations tailored to specific grade levels and topics.
 */

// Global variable to track which field is currently being used for file upload
let currentUploadField = '';

/**
 * FUNCTION: showFileUploadMenu
 * ============================
 * PURPOSE: Displays the file upload menu when an upload button is clicked
 * 
 * WHY THIS IS IMPORTANT:
 * - Provides multiple upload options (documents, data, links)
 * - Positions menu contextually near the clicked button
 * - Supports various educational file formats
 * - Enhances user experience with visual feedback
 * 
 * @param {string} field - The ID of the textarea field to upload to
 * @param {Event} event - The click event to position the menu
 */
function showFileUploadMenu(field, event) {
    currentUploadField = field;
    const menu = document.getElementById('fileUploadMenu');
    const button = event.target;
    const rect = button.getBoundingClientRect();
    
    // Position the menu below the button that was clicked for better UX
    menu.style.display = 'block';
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;
}

/**
 * FUNCTION: uploadFile
 * ====================
 * PURPOSE: Handles file upload based on the selected file type
 * 
 * EDUCATIONAL BENEFITS:
 * - Supports standard educational document formats (PDF, DOC, DOCX, PPTX)
 * - Allows CSV uploads for data integration (student rosters, assessment data)
 * - Processes file content for AI analysis and integration
 * - Provides immediate feedback to educator about successful upload
 * 
 * FILE TYPE RATIONALE:
 * - PDF: Common for standards documents, articles, research
 * - DOC/DOCX: Lesson plans, curriculum guides, educational resources
 * - PPTX: Existing presentations to reference or build upon
 * - CSV: Student data, assessment results, statistical information
 * 
 * @param {string} type - The type of file being uploaded (pdf, csv, etc.)
 */
function uploadFile(type) {
    const input = document.createElement('input');
    input.type = 'file';
    
    // Set accepted file types based on the selected option
    // Each type serves specific educational purposes
    input.accept = type === 'pdf' ? '.pdf,.doc,.docx,.pptx' : 
                type === 'csv' ? '.csv' : 
                type === 'youtube' ? 'video/*' : '*/*';
    
    // Handle the file selection and processing
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                // Update the corresponding field with file information
                // This provides immediate feedback to the educator
                const currentField = document.getElementById(currentUploadField);
                if (currentField.value && currentField.value.trim() !== '') {
                    currentField.value += `\n\nFile uploaded: ${file.name}`;
                } else {
                    currentField.value = `File uploaded: ${file.name}`;
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
    
    // Hide the menu after selection
    document.getElementById('fileUploadMenu').style.display = 'none';
}

/**
 * FUNCTION: handleUrlInput
 * ========================
 * PURPOSE: Handles URL input for external educational resources
 * 
 * EDUCATIONAL VALUE:
 * - Integrates multimedia resources (YouTube educational videos)
 * - Links to online educational tools and websites
 * - Connects to collaborative platforms (Google Sheets)
 * - Expands presentation resources beyond static content
 * 
 * RESOURCE TYPES SUPPORTED:
 * - Google Sheets: Collaborative data, assessment rubrics, planning documents
 * - YouTube: Educational videos, tutorials, demonstrations
 * - Websites: Online articles, educational tools, interactive resources
 * 
 * @param {string} type - The type of URL being entered
 */
function handleUrlInput(type) {
    const url = prompt(`Enter the ${type} URL:`);
    if (url && url.trim() !== '') {
        const field = document.getElementById(currentUploadField);
        // If the field already has content, add the URL on a new line
        if (field.value && field.value.trim() !== '') {
            field.value += '\n' + url;
        } else {
            field.value = url;
        }
    }
    // Hide the file upload menu
    document.getElementById('fileUploadMenu').style.display = 'none';
}

/**
 * FUNCTION: validateFormData
 * ==========================
 * PURPOSE: Validates all required form fields before submission
 * 
 * VALIDATION IMPORTANCE:
 * - Ensures all critical data is provided for quality presentation generation
 * - Prevents AI generation with incomplete information
 * - Provides clear feedback to educators about missing requirements
 * - Maintains educational standards and quality control
 * 
 * @returns {boolean} - True if all required fields are valid, false otherwise
 */
function validateFormData() {
    const gradeLevel = document.getElementById('gradeLevel').value;
    const numSlides = document.getElementById('numSlides').value;
    const topic = document.getElementById('topic').value.trim();
    
    // Check required fields
    if (!gradeLevel) {
        alert('Please select a grade level. This is essential for determining appropriate content complexity.');
        return false;
    }
    
    if (!numSlides) {
        alert('Please select the number of slides. This determines the presentation structure and content distribution.');
        return false;
    }
    
    if (!topic) {
        alert('Please enter a topic. This is the core subject matter for your presentation.');
        return false;
    }
    
    return true;
}

/**
 * FUNCTION: generatePresentation
 * ==============================
 * PURPOSE: Main function to collect form data and initiate presentation generation
 * 
 * EDUCATIONAL WORKFLOW:
 * 1. Validates all input data for completeness
 * 2. Collects grade level for appropriate content complexity
 * 3. Gathers number of slides for structure planning
 * 4. Captures topic for content focus
 * 5. Includes standards for educational alignment
 * 6. Incorporates customization for personalization
 * 7. Passes data to AI generation system (page 2)
 * 
 * DATA PROCESSING:
 * - Grade Level: Determines vocabulary, complexity, engagement strategies
 * - Number of Slides: Controls content distribution and presentation length
 * - Topic: Drives all content selection and organization
 * - Standards: Ensures curriculum alignment and learning objectives
 * - Customization: Personalizes for specific classroom needs
 */
function generatePresentation() {
    // Validate form data before proceeding
    if (!validateFormData()) {
        return;
    }
    
    const generateBtn = document.getElementById('generateBtn');
    const originalBtnText = generateBtn.textContent;
    
    // Update button state to show processing - important UX feedback
    generateBtn.textContent = 'Generating Presentation...';
    generateBtn.disabled = true;

    try {
        // Collect all form data into a structured object
        // This data will be used by the AI to generate educational content
        const formData = {
            gradeLevel: document.getElementById('gradeLevel').value,
            numSlides: parseInt(document.getElementById('numSlides').value), // Convert to number for processing
            topic: document.getElementById('topic').value.trim(),
            standards: document.getElementById('standards').value.trim(),
            customization: document.getElementById('customization').value.trim()
        };

        // Add timestamp for tracking and debugging
        formData.timestamp = new Date().toISOString();
        
        // Log data for debugging (can be removed in production)
        console.log('Presentation Generation Data:', formData);

        // Redirect to page 2 with the form data as a URL parameter
        // This maintains the educational workflow and data persistence
        window.location.href = `pg_p2.html?presentationData=${encodeURIComponent(JSON.stringify(formData))}`;
        
    } catch (error) {
        console.error('Error in presentation generation:', error);
        alert('An unexpected error occurred while preparing your presentation. Please check your inputs and try again.');
    } finally {
        // Reset button state (though this won't execute if redirect is successful)
        generateBtn.textContent = originalBtnText;
        generateBtn.disabled = false;
    }
}

/**
 * FUNCTION: googleTranslateElementInit
 * ====================================
 * PURPOSE: Initializes Google Translate for multilingual support
 * 
 * EDUCATIONAL ACCESSIBILITY:
 * - Supports ESL educators and diverse teaching environments
 * - Enables international education collaboration
 * - Provides accessibility for non-English speaking educators
 * - Enhances global educational resource sharing
 */
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,fr,de,zh-CN,ja,ar,pt,ru,hi',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
}

/**
 * EVENT LISTENERS AND INITIALIZATION
 * ==================================
 * This section sets up all the interactive functionality when the page loads
 */
document.addEventListener('DOMContentLoaded', function() {
    
    /**
     * FORM SUBMISSION HANDLER
     * =======================
     * Prevents default form submission and triggers presentation generation
     * This ensures data is processed correctly for AI generation
     */
    document.getElementById('presentationForm').addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent default form submission
        generatePresentation();
    });

    /**
     * FILE INPUT HANDLER
     * ==================
     * Handles the hidden file input element for file uploads
     * Processes uploaded files and integrates content into form fields
     */
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const currentField = document.getElementById(currentUploadField);
                if (currentField.value && currentField.value.trim() !== '') {
                    currentField.value += '\n\n' + e.target.result;
                } else {
                    currentField.value = e.target.result;
                }
            };
            reader.readAsText(file);
        }
        // Hide the file upload menu after processing
        document.getElementById('fileUploadMenu').style.display = 'none';
    });

    /**
     * CLICK-OUTSIDE HANDLER
     * =====================
     * Closes the file upload menu when user clicks outside of it
     * Improves user experience and interface cleanliness
     */
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('fileUploadMenu');
        // Only close if click is not on upload button or menu itself
        if (!event.target.closest('.upload-btn') && !event.target.closest('.file-upload-menu')) {
            menu.style.display = 'none';
        }
    });

    /**
     * FORM FIELD ENHANCEMENTS
     * =======================
     * Add helpful tooltips and validation feedback
     */
    
    // Add helpful tooltips on hover for better UX
    const gradeSelect = document.getElementById('gradeLevel');
    gradeSelect.addEventListener('change', function() {
        if (this.value) {
            this.style.borderColor = '#6c63ff'; // Visual feedback for selection
        }
    });
    
    const slideSelect = document.getElementById('numSlides');
    slideSelect.addEventListener('change', function() {
        if (this.value) {
            this.style.borderColor = '#6c63ff'; // Visual feedback for selection
        }
    });
    
    const topicInput = document.getElementById('topic');
    topicInput.addEventListener('input', function() {
        if (this.value.trim()) {
            this.style.borderColor = '#6c63ff'; // Visual feedback for input
        } else {
            this.style.borderColor = '#555'; // Reset if empty
        }
    });
});