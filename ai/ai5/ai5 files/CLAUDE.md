# JARVIS AI Assistant v5 - Development Documentation

## High-Level Overview

**JARVIS** is a voice-enabled AI assistant inspired by Tony Stark's AI system. It features:
- **Voice Recognition**: Push-to-talk with hotkey support and wake phrase detection ("Hey Jarvis")
- **OpenAI Integration**: GPT-4o-mini powered intelligent responses
- **Multiple AI Personalities**: JARVIS, Genius Mode, Professor, Data Analyst
- **British Voice Synthesis**: Sophisticated Microsoft David voice (rate=0.85, pitch=0.75)
- **Modern UI**: Arc reactor animations, mode selection cards, chat interface

## System Architecture

### **Three-Layer Design**
1. **`AI_v5_JARVIS.html`** - UI Layer (HTML structure, event listeners, UI utilities)
2. **`scripts/jarvis_main.js`** - AI Logic Layer (OpenAI integration, message handling, personality system)
3. **`scripts/jarvis_voice.js`** - Voice Layer (speech recognition, synthesis, voice commands)

### **Data Flow**
```
User Input (Voice/Text) 
  → processUserMessage() [jarvis_main.js]
    → addMessage(text, 'user') [jarvis_main.js]
    → generateAIResponse() [jarvis_main.js]
      → OpenAI API (GPT-4o-mini)
        → addMessage(response, 'jarvis') [jarvis_main.js]
          → speakText(response) [jarvis_voice.js]
```

---

## Recent Fixes (Session: December 2025)

### **Problems Identified**

1. **Duplicate Messages in Voice Chat**
   - Voice commands appeared 2-3 times in transcript
   - `processVoiceCommand()` was adding messages before passing to `processUserMessage()`
   - `processUserMessage()` then added the same message again

2. **Missing OpenAI Integration**
   - `jarvis_main.js` was not being loaded in HTML
   - Only `jarvis_voice.js` was included in script tags
   - Generic placeholder responses were being used instead of AI

3. **Conflicting Response Generators**
   - Duplicate `generateResponse()` functions in both HTML inline script and jarvis_main.js
   - HTML version returned generic templates like "That's an intriguing question, sir..."
   - OpenAI version in jarvis_main.js was never reached

4. **Function Duplication Across Files**
   - `initializeJarvis()` defined in both HTML and jarvis_main.js
   - `selectPersonality()` defined in both HTML and jarvis_main.js
   - `addMessage()` defined in both HTML (old format) and jarvis_main.js (new format)
   - `processUserMessage()` defined in both locations

### **Solutions Implemented**

#### **1. Fixed Duplicate Voice Messages** (`scripts/jarvis_voice.js`)
**Changed:** `processVoiceCommand()` function (lines 415-507)

**Before:**
```javascript
function processVoiceCommand(transcript) {
    // Add voice command to chat display
    addMessageToChat(transcript, 'user');  // ❌ Always added here
    
    if (greetings...) {
        // Handle greeting
    } else {
        // Process through OpenAI
        processUserMessage(transcript);  // ❌ Added again here!
    }
}
```

**After:**
```javascript
function processVoiceCommand(transcript) {
    // Handle specific voice commands
    if (greetings...) {
        addMessageToChat(transcript, 'user');  // ✅ Only for specific commands
        // Handle greeting
    } else {
        // Process through OpenAI (processUserMessage adds the message)
        processUserMessage(transcript);  // ✅ No duplicate!
    }
}
```

#### **2. Enabled OpenAI Integration** (`AI_v5_JARVIS.html`)
**Changed:** Script loading (line 214)

**Before:**
```html
<script src="scripts/jarvis_voice.js"></script>
<script>
    // Inline script with generic responses
</script>
```

**After:**
```html
<script src="scripts/jarvis_voice.js"></script>
<script src="scripts/jarvis_main.js"></script>  <!-- ✅ Added OpenAI integration -->
<script>
    // Minimal inline script, delegates to jarvis_main.js
</script>
```

#### **3. Removed Duplicate Functions** (`AI_v5_JARVIS.html`)

**Removed from inline script:**
- ❌ `processUserMessage()` - Now in jarvis_main.js only
- ❌ `generateResponse()` - Now in jarvis_main.js only
- ❌ `generateMarsResponse()`, `generatePhysicsResponse()`, etc. - Removed (replaced by OpenAI)
- ❌ `initializeJarvis()` - Now in jarvis_main.js only
- ❌ `selectPersonality()` - Now in jarvis_main.js only
- ❌ `addMessage(text, isUser)` - Now in jarvis_main.js as `addMessage(text, sender)`

**Kept in HTML:**
- ✅ `setupEventListeners()` - UI-specific event binding
- ✅ `addMessageToChat()` - Wrapper for voice system compatibility
- ✅ `showWelcomeMessage()` - Initial greeting
- ✅ `sendMessage()` - Delegates to `processUserMessage()` from jarvis_main.js
- ✅ Hotkey system functions
- ✅ UI utility functions (notifications, modals, file handling)

#### **4. Unified Message Format**

**Changed all `addMessage()` calls to use consistent sender strings:**

**Before:**
```javascript
addMessage(text, true);   // ❌ Boolean for user
addMessage(text, false);  // ❌ Boolean for AI
```

**After:**
```javascript
addMessage(text, 'user');   // ✅ String for user
addMessage(text, 'jarvis'); // ✅ String for AI
```

#### **5. Updated Mode Selection** (`scripts/jarvis_main.js`)

**Enhanced `selectPersonality()` to include `data-active` attribute:**
```javascript
modeCards.forEach(card => {
    card.classList.remove('active');
    card.removeAttribute('data-active');
    if (card.dataset.personality === personalityType) {
        card.classList.add('active');
        card.setAttribute('data-active', 'true');  // ✅ For CSS styling
        void card.offsetHeight;  // Force style recalculation
    }
});
```

#### **6. Enhanced JARVIS Voice Authenticity** (`scripts/jarvis_voice.js` & `scripts/jarvis_main.js`)

**Voice Settings Calibration - Matching Paul Bettany's JARVIS:**

**Changed in `jarvis_voice.js` (lines 19-23):**
- **Rate:** 0.85 → 0.9 (more natural articulation while maintaining sophistication)
- **Pitch:** 0.75 → 0.9 (mid-range British tone, not overly deep - matches Paul Bettany's actual vocal range)
- **Volume:** 0.8 → 0.85 (clearer presence and butler-like authority)

**JARVIS Personality Enhancement in `jarvis_main.js` (lines 28-32):**

Enhanced the personality style description to guide OpenAI:
```javascript
style: 'sophisticated British butler AI - formal yet approachable, calm and measured tone, 
        precise articulation, subtle dry wit and occasional mild sarcasm, highly intelligent 
        and efficient, conveys concern for user welfare while maintaining professional restraint'
```

**OpenAI System Prompt Enhancement (lines 398-407):**

Added detailed JARVIS persona instructions:
- Calm, measured sophistication like a British butler
- Precise, articulate language with formal yet approachable tone
- Reference systems and databases naturally ("My databases indicate...", "Systems analysis suggests...")
- Employ subtle dry wit and occasional mild sarcasm - understated British humor
- Professional restraint while showing concern for user's welfare
- Channel Paul Bettany's JARVIS: authoritative but never condescending, witty but never flippant

**Result:** Voice now sounds more like the authentic JARVIS from Marvel Cinematic Universe - authoritative, sophisticated, with subtle British charm.

---

## Key Integration Points

### **Voice → OpenAI Flow**
1. User holds microphone button or presses hotkey
2. `jarvis_voice.js` captures speech via Web Speech API
3. `processVoiceCommand(transcript)` checks if it's a built-in command
4. For general queries → calls `processUserMessage(transcript)` from `jarvis_main.js`
5. `processUserMessage()` → `generateAIResponse()` → OpenAI API
6. Response → `addMessage()` → `speakText()` for voice output

### **Text → OpenAI Flow**
1. User types message and presses Enter or Send button
2. `sendMessage()` in HTML → calls `processUserMessage(message)` from `jarvis_main.js`
3. Same flow as voice from step 5 above

### **Personality System**
- **Defined in:** `jarvis_main.js` (lines 27-52)
- **Personalities:** jarvis, genius, professor, analyst
- **Each has:** name, greeting, style description for OpenAI system prompt
- **Selection:** Click mode card → `selectPersonality()` → Updates UI + sends greeting

### **Voice System Configuration**
- **Location:** `jarvis_voice.js`
- **Voice:** Microsoft David (British English male) - prioritizes UK/British voices
- **Settings:** `rate: 0.9, pitch: 0.9, volume: 0.85` (calibrated for Paul Bettany's JARVIS voice)
  - **Rate 0.9:** Measured, articulate pace - sophisticated yet natural
  - **Pitch 0.9:** Mid-range British tone - authoritative without being too deep
  - **Volume 0.85:** Clear, confident presence - butler-like authority
- **Recognition:** Continuous, interim results enabled
- **Wake Phrases:** "hey jarvis", "jarvis", "hello jarvis"
- **Voice Selection:** Automatic ranking system prioritizes British/UK voices, neural/premium voices

---

## File Organization

```
ai5/
├── AI_v5_JARVIS.html          # Main HTML file (UI structure + minimal inline JS)
├── scripts/
│   ├── jarvis_main.js         # Core AI logic + OpenAI integration
│   └── jarvis_voice.js        # Voice recognition + synthesis
├── styles/
│   └── jarvis_styles.css      # Arc reactor UI styling
└── CLAUDE.md                  # This documentation file
```

---

## OpenAI Configuration

**Located in:** `scripts/jarvis_main.js` (lines 7-8)

```javascript
const OPENAI_API_KEY = 'sk-proj-...';  // Replace with your key
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
```

**Model:** `gpt-4o-mini`  
**Max Tokens:** 800  
**Temperature:** 0.7  
**Streaming:** Disabled

---

## Current Features (Working)

✅ **Voice Recognition** - Push-to-talk with microphone button  
✅ **Hotkey System** - Configurable keyboard shortcut for voice activation  
✅ **Wake Phrase** - "Hey Jarvis" detection  
✅ **OpenAI Integration** - GPT-4o-mini powered responses  
✅ **4 AI Personalities** - JARVIS, Genius, Professor, Analyst modes  
✅ **Voice Synthesis** - British English male voice (Microsoft David)  
✅ **Mode Highlighting** - Active personality card stays highlighted  
✅ **8 Greeting Variations** - Randomized JARVIS greetings  
✅ **Chat History** - Conversation tracking with timestamps  
✅ **File Upload UI** - Attach button with file type menu  
✅ **Settings Panel** - Voice volume, speed, wake phrase toggle  
✅ **Responsive UI** - Arc reactor animations, modern design

---

## Known Issues / Future Enhancements

### **Known Issues**
- None currently identified (system is fully operational)

### **Potential Enhancements**
- Implement actual file processing (PDFs, images, code)
- Add conversation memory across sessions (localStorage)
- Implement streaming responses for faster feedback
- Add more voice command shortcuts
- Create voice-activated mode switching
- Add conversation export functionality
- Implement multi-turn conversation context

---

## Testing Guidelines

### **Test Voice Recognition:**
1. Click microphone button and hold
2. Say "Hey Jarvis"
3. JARVIS responds: "Yes, sir? How may I assist you?"
4. Say your query: "What's the weather like?"
5. Should get intelligent OpenAI response (not generic template)

### **Test OpenAI Integration:**
1. Type in chat: "Explain quantum entanglement"
2. Should receive detailed GPT-4o-mini response
3. JARVIS should speak the response aloud
4. Check browser console for API logs

### **Test Mode Switching:**
1. Click different personality cards
2. Active card should have blue glow and white text
3. Should hear mode switch confirmation
4. Responses should match personality style

---

## Troubleshooting

### **"That's an intriguing question, sir" Generic Responses**
**Cause:** OpenAI integration not loaded or API key invalid  
**Fix:** Ensure `jarvis_main.js` is loaded and API key is valid

### **Duplicate Messages in Chat**
**Cause:** Multiple `addMessage()` calls for same input  
**Fix:** Check that voice commands only add message once (fixed in this session)

### **Voice Not Working**
**Cause:** Microphone permission denied or browser compatibility  
**Fix:** Allow microphone access, use Chrome/Edge

### **Mode Cards Not Highlighting**
**Cause:** CSS not targeting `data-active` attribute  
**Fix:** Ensure `data-active="true"` is set on active card (fixed in jarvis_main.js)

---

## Changelog

### **December 14, 2025 - Session 2: JARVIS Voice Enhancement**
- **Voice Settings:** Calibrated to match Paul Bettany's JARVIS (rate: 0.9, pitch: 0.9, volume: 0.85)
- **Personality Style:** Enhanced with British butler characteristics, dry wit, measured sophistication
- **OpenAI Prompts:** Updated with detailed JARVIS persona instructions for authentic responses

### **December 14, 2025 - Session 1: Core Fixes**
- Fixed duplicate voice message issue
- Added OpenAI integration (jarvis_main.js)
- Removed duplicate functions across files
- Unified message format (string-based sender parameter)
- Enhanced mode selection with data-active attribute

---

## Development Notes

- **Last Updated:** December 14, 2025
- **Browser Compatibility:** Chrome, Edge (WebKit Speech API required)
- **Dependencies:** OpenAI API, Font Awesome icons
- **License:** Not specified
- **Author:** Not specified

---

## Quick Reference Commands

### **Voice Commands (Built-in)**
- "Hello" / "Hi" → Greeting response
- "Help" → Capabilities explanation
- "Clear chat" → Clears conversation
- "Settings" → Opens settings panel
- "Status" / "How are you" → System status
- "Switch to [mode]" → Changes AI personality

### **Everything Else**
- Processed through OpenAI GPT-4o-mini for intelligent responses
