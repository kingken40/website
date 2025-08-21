// AI Chat Bot v1 - Core Functionality with XSS Security

// XSS Security Functions
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

const isValidImageUrl = (url) => {
    try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'https:' && 
               /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(urlObj.pathname) &&
               urlObj.hostname !== 'localhost' && 
               !urlObj.hostname.match(/^(10|172\.16|192\.168)\./);
    } catch { 
        return false; 
    }
};

const sanitizeResponse = (text) => {
    // First escape all HTML to prevent XSS
    const escaped = escapeHtml(text);
    
    // Then safely apply formatting using escaped content
    return escaped
        .replace(/###\s+(.*)/g, "<h3>$1</h3>")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/^\s*-\s+(.+)/gm, "<li>$1</li>")
        .replace(/^\s*\d+\.\s+(.+)/gm, "<li>$1</li>");
};

const handleMessage = async () => {
const input = document.querySelector("input"),
  button = document.querySelector("button"),
  message = input.value.trim();

// Enhanced input validation
if (!message || message.length > 50) return;

// Securely insert user message with HTML escaping
input.insertAdjacentHTML(
"beforebegin",
`<p data-user="true">${escapeHtml(message)}</p>`
);
input.value = "";

// Update character counter after clearing input
updateCharCount();

try {
const { reply, imageUrl } = await fetch(
    "https://backend.fesinstitute.com/api/public/chat",
    {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, uid: "ULeh2kO9bHWVDunMs0hUw1Zl1rR2" }),
    }
).then((r) => r.json());

// Sanitize server response to prevent XSS
const formattedText = sanitizeResponse(reply || "");

// Validate image URL before insertion
const safeImageUrl = imageUrl && isValidImageUrl(imageUrl) ? imageUrl : null;

input.insertAdjacentHTML(
    "beforebegin",
    `<div>${formattedText}` +
    (safeImageUrl
        ? `<img src="${safeImageUrl}" alt="AI response image"></div>`
        : "</div>")
);
} catch {
input.insertAdjacentHTML(
    "beforebegin",
    `<p>Bot: Something went wrong!</p>`
);
}
};

// Character Counter Functionality
const updateCharCount = () => {
    const input = document.querySelector("input");
    const charCount = document.getElementById("char-count");
    const currentLength = input.value.length;
    
    charCount.textContent = currentLength;
    
    // Change color based on character count
    if (currentLength >= 45) {
        charCount.style.color = "#ff6b6b"; // Red when near limit
    } else if (currentLength >= 35) {
        charCount.style.color = "#ffa500"; // Orange when getting close
    } else {
        charCount.style.color = "#666"; // Gray default
    }
};

// Event Listeners  
document.querySelector("button:not(.back-button)").onclick = handleMessage;

document.querySelector("input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        handleMessage();
    }
});

// Add character counter event listener
document.querySelector("input").addEventListener("input", updateCharCount);

// Initialize character counter on page load
document.addEventListener("DOMContentLoaded", updateCharCount);

// Back button navigation function
function navigateBack() {
    console.log('Back button clicked!'); // Debug log
    
    // Simple direct navigation - most reliable method
    try {
        window.location.href = '../../../Games.html';
        console.log('Navigation attempted'); // Debug log
    } catch (error) {
        console.error('Navigation failed:', error);
        // Alternative method using absolute path
        window.location.href = '/Games.html';
    }
}