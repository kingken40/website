// AI Chat Bot v1 - Core Functionality

const handleMessage = async () => {
const input = document.querySelector("input"),
  button = document.querySelector("button"),
  message = input.value.trim();

if (!message) return;

input.insertAdjacentHTML(
"beforebegin",
`<p data-user="true">${message}</p>`
);
input.value = "";

try {
const { reply, imageUrl } = await fetch(
    "https://backend.fesinstitute.com/api/public/chat",
    {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, uid: "ULeh2kO9bHWVDunMs0hUw1Zl1rR2" }),
    }
).then((r) => r.json());

const formattedText = reply
    .replace(/###\s+(.*)/g, "<h3>$1</h3>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/^\s*-\s+(.+)/gm, "<li>$1</li>")
    .replace(/^\s*\d+\.\s+(.+)/gm, "<li>$1</li>");

input.insertAdjacentHTML(
    "beforebegin",
    `<div>${formattedText}` +
    (imageUrl
        ? `<img src="${imageUrl}"></div>`
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
document.querySelector("button").onclick = handleMessage;

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
    // Try multiple methods to ensure navigation works
    try {
        // Method 1: Use history if available
        if (window.history.length > 1) {
            window.history.back();
        } else {
            // Method 2: Direct navigation
            window.location.href = '../../../Games.html';
        }
    } catch (error) {
        // Method 3: Fallback direct navigation
        window.location.href = '../../../Games.html';
    }
}