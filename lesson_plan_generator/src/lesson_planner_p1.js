/**
 * LESSON PLANNER - PAGE 1 (INPUT FORM) JAVASCRIPT
 * This file contains all the JavaScript functionality for the first page
 * of the Lesson Planner application, which handles the input form.
 * 
 * Collects user inputs that will be used to generate AI-powered lesson plans.
 */

// Global variable to track which field is currently being used for file upload
let currentUploadField = '';

/**
 * Shows the file upload menu when an upload button is clicked
 * @param {string} field - The ID of the textarea field to upload to
 * @param {Event} event - The click event
 */
function showFileUploadMenu(field, event) {
    currentUploadField = field;
    const menu = document.getElementById('fileUploadMenu');
    const button = event.target;
    const rect = button.getBoundingClientRect();
    
    // Position the menu below the button that was clicked
    menu.style.display = 'block';
    menu.style.top = `${rect.bottom}px`;
    menu.style.left = `${rect.left}px`;
}

/**
 * Handles file upload based on the selected file type
 * @param {string} type - The type of file being uploaded (pdf, csv, etc.)
 */
function uploadFile(type) {
    const input = document.createElement('input');
    input.type = 'file';
    
    // Set accepted file types based on the selected option
    input.accept = type === 'pdf' ? '.pdf,.doc,.docx,.pptx' : 
                type === 'csv' ? '.csv' : 
                type === 'youtube' ? 'video/*' : '*/*';
    
    // Handle the file selection
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                document.getElementById(currentUploadField).value = `File uploaded: ${file.name}`;
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

/**
 * Handles URL input for external resources
 * @param {string} type - The type of URL being entered
 */
function handleUrlInput(type) {
    const url = prompt(`Enter the ${type} URL:`);
    if (url) {
        const field = document.getElementById(currentUploadField);
        // If the field already has content, add a new line before the URL
        if (field.value && field.value.trim() !== '') {
            field.value += '\n' + url;
        } else {
            field.value = url;
        }
    }
    document.getElementById('fileUploadMenu').style.display = 'none';
}

/**
 * Initializes the Google Translate element for page translation
 */
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,fr,de,zh-CN,ja,ar,pt,ru,hi',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    }, 'google_translate_element');
}

/**
 * Changes the page language using Google Translate
 * Note: This function is not currently used in the visible UI
 */
function changeLanguage() {
    const language = document.getElementById('languageSelect').value;
    const googleFrame = document.getElementsByClassName('goog-te-menu-frame')[0];
    if (googleFrame) {
        const googleFrameDoc = googleFrame.contentDocument || googleFrame.contentWindow.document;
        const googleFrameBody = googleFrameDoc.getElementsByTagName('body')[0];
        const googleFrameItems = googleFrameBody.getElementsByClassName('goog-te-menu2-item');

        for (let i = 0; i < googleFrameItems.length; i++) {
            if (googleFrameItems[i].innerHTML.includes(language)) {
                googleFrameItems[i].click();
                return;
            }
        }
    }
}

/**
 * Main function to generate the lesson plan
 * Collects form data and redirects to page 2 with the data
 */
function generateLessonPlan() {
    const generateBtn = document.getElementById('generateBtn');
    const originalBtnText = generateBtn.textContent;
    
    // Update button state to show loading
    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;

    try {
        // Collect all form data into an object
        const formData = {
            gradeLevel: document.getElementById('gradeLevel').value,
            language: document.getElementById('language').value,
            topic: document.getElementById('topic').value,
            standards: document.getElementById('standards').value,
            customization: document.getElementById('customization').value
        };

        // Redirect to page 2 with the form data as a URL parameter
        window.location.href = `lesson_planner_p2.html?lessonPlan=${encodeURIComponent(JSON.stringify(formData))}`;
    } catch (error) {
        console.error('Error:', error);
        alert('An unexpected error occurred. Please try again.');
    } finally {
        // Reset button state (though this won't execute if redirect is successful)
        generateBtn.textContent = originalBtnText;
        generateBtn.disabled = false;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Event listener for form submission
    document.getElementById('lessonPlanForm').addEventListener('submit', function(e) {
        e.preventDefault();
        generateLessonPlan();
    });

    // Event listener for the hidden file input element
    document.getElementById('fileInput').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.getElementById(currentUploadField).value += e.target.result + '\n';
            };
            reader.readAsText(file);
        }
        document.getElementById('fileUploadMenu').style.display = 'none';
    });

    // Event listener to close the file upload menu when clicking outside of it
    document.addEventListener('click', function(event) {
        const menu = document.getElementById('fileUploadMenu');
        if (!event.target.closest('.upload-btn') && !event.target.closest('.file-upload-menu')) {
            menu.style.display = 'none';
        }
    });
});