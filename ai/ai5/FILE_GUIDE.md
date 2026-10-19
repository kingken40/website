# ai5 file guide

This folder contains the N.O.V.A / JARVIS voice assistant project. It is split into browser UI pages, modular JS runtime files, Python voice services, and asset packs.

## `public/AI_v5_nova.html`

- Main N.O.V.A browser interface.
- Loads `styles/nova_styles.css`, Font Awesome, and `pdf.js`.
- The top half builds the mobile phone-call UI.
- The header builds the arc-reactor style desktop branding.
- The voice section contains the microphone button and visualizer.
- Later sections (not shown in the header) wire in chat, settings, and the modular scripts.

## `public/AI_v5_JARVIS.html`

- JARVIS-branded browser interface.
- Same general structure as the N.O.V.A page, but tuned for the JARVIS presentation.
- Serves as the main development UI for the voice assistant experience.

## `public/AI_v5_JARVIS_CLEAN.html`

- Cleaned-down JARVIS page variant.
- Used when you want a simpler version of the interface without the heavier debug or experimental layout.

## `voice_checker.html`

- Standalone browser tool for inspecting available speech synthesis voices.
- Loads voices from the Web Speech API.
- Categorizes voices into British, premium, and N.O.V.A-suitable groups.
- Provides test buttons and "set as voice" actions.

## `styles/nova_styles.css`

- Full visual theme for the assistant UI.
- Covers the background grid, arc reactor, voice rings, status text, and responsive layout.
- Also styles the chat, control buttons, and mobile call view.

## `scripts/nova_main.js`

- Core browser app logic.
- Routes LLM requests through the server-side Perplexity Router integration.
- Never reads API keys from browser storage.
- Detects task type and chooses a model/token budget.
- Manages cached Perplexity Router catalog models and the model selector UI.
- Stores the current conversation, novelty memory, and file attachment state.
- Loads the style phrases and personality presets.
- Builds the knowledge base context and persistent material store.
- Initializes the assistant and chat flow.

## `scripts/nova_conversation_flow.js`

- Handles personality selection and message rendering.
- Updates active mode cards and the header text.
- Adds user and assistant messages to chat history.
- Detects mode questions and novelty-driven requests.

## `scripts/nova_integration.js`

- Bridges the voice layer and the main UI.
- Normalizes speech text before speaking.
- Recreates missing `speakText` support if needed.
- Coordinates listening state so speech does not loop back into recognition.

## `scripts/nova_kb_store.js`

- Stores and manages the knowledge base.
- Normalizes text and group names.
- Loads and saves groups and persistent material from `localStorage`.
- Adds and removes knowledge base entries.

## `scripts/nova_page_mobile_call.js`

- Mobile-only call interface controller.
- Syncs desktop chat messages into the mobile transcript.
- Handles mute, continue, chat, and settings controls.
- Updates the mobile call state text and avatar styling.

## `scripts/nova_page_ui.js`

- Page-level UI helpers pulled out of the HTML.
- Manages the file menu toggle and hide behavior.
- Defines personality presets and startup wiring.
- Binds settings, chat, and file-upload event listeners.

## `scripts/nova_page_voice_fix.js`

- Voice integration recovery helpers.
- Forces voice initialization if the voice system loads out of order.
- Provides fallback `speakText`.
- Adds a simplified voice command path for broken or incomplete setups.

## `scripts/nova_runtime_ai.js`

- Builds outgoing chat messages, including file attachment text.
- Formats web-context prompts.
- Sends chat requests through the server proxy.
- Handles response validation and web-search fallback behavior.

## `scripts/nova_runtime_chat.js`

- Chat history and export logic.
- Replays messages with voice.
- Shows and hides the loading overlay.
- Saves chats to `localStorage` and keeps the chat list in sync.

## `scripts/nova_runtime_vision.js`

- AI Vision: the camera toggle (`aiVisionBtn` / `mobileAiVisionBtn`).
- While on, shows a small mirrored camera preview and attaches the latest webcam frame to each AI request.
- Runs a low-frequency proactive check that speaks only when something useful is visible (confusion, a held item, poor posture), otherwise stays silent.
- Camera frames go to the selected AI model; the camera stops when toggled off or the page closes.

## `scripts/nova_runtime_files.js`

- File-upload wiring and file processing.
- Audio: speaker-aware transcription (`gpt-4o-transcribe-diarize`, falling back to `whisper-1` with timestamps), automatic splitting of long recordings, merged speaker turns and `[pause Ns]` markers.
- Lecture mode: the audio packet carries a `LECTURE MODE PROTOCOL` (segment summaries, key concepts, instructor examples, flagged unclear explanations, emphasis cues, study guide). It activates automatically for lecture-like audio or when the user says "this is a lecture".
- Validates file size limits.
- Routes text, image, PDF, code, and audio uploads to the right handlers.
- Builds the attachment chip shown beside the message box.

## `scripts/nova_runtime_ui_events.js`

- Binds the main UI buttons and keyboard behavior.
- Connects mode cards, send, continue, clear, export, and settings controls.
- Handles modal dismissal and quick-action clicks.
- Starts the page-level event flow.

## `scripts/nova_runtime_ui_voice.js`

- Updates the voice UI indicators.
- Animates the voice visualizer and status text.
- Auto-resizes the text area.
- Fills the voice selection dropdown with available browser voices.

## `scripts/nova_runtime_voice_tools.js`

- Voice diagnostics and testing utilities.
- Lists available voices.
- Filters for British and N.O.V.A-suitable voices.
- Provides test routines for speaking sample lines.

## `scripts/nova_voice.js`

- Main voice engine.
- Manages speech recognition, wake-word state, and speech synthesis.
- Supports the local voice bridge and JARVIS audio packs.
- Tracks the current voice settings and bridge URL.
- Handles listening, speaking, and response playback coordination.

## `scripts/nova_voice_before_interrupt.js`

- Earlier voice-engine snapshot kept for reference.
- Useful as a fallback or comparison point for interrupt-handling changes.

## `Jarvis-main/jarvis.py`

- Full local desktop JARVIS assistant.
- Starts with config for wake word, TTS engine, and LLM backends.
- Defines the system prompt and style rules.
- Runs the wake-word loop, STT, LLM response generation, and TTS output.
- Manages audio playback, RGB effects, and follow-up turns.

## `Jarvis-main/voice_bridge.py`

- Local Flask bridge for Windows SAPI voices.
- Provides `/health`, `/voices`, and `/speak`.
- Converts speech settings into SAPI-friendly rate and volume values.
- Writes temporary WAV output and returns it to the browser.

## `Jarvis-main/README.md`

- High-level architecture and setup guide for the JARVIS assistant.
- Explains the pipeline, dependencies, and configuration steps.

## `Jarvis-main/memory.md`

- Seed memory notes for the assistant prompt.
- Meant to be replaced or expanded with the user's real preferences and setup.

## `Jarvis-main/phrases.txt`

- Quote and phrase bank used by the prompt/style system.
- Helps shape the assistant's voice and response style.

## `ai5 files/CLAUDE.md`

- Repo-specific operating instructions for this workspace.
- Captures how the assistant should treat the project.

## `ai5 files/JARVIS_Voice_Setup_Guide.md`

- Voice-installation guide for JARVIS.
- Covers testing voices, adding British voices, and recommended choices.

## `ai5 files/public/README.md`

- Notes for the public-facing HTML pages.
- Explains how the browser entry points are intended to be used.

## `JARVIS/` asset folders

- Audio/image packs used by the voice system.
- The `.wav`, `.bmp`, `.jpg`, and related files are media assets, not source code.
- The JS runtime references these folders when loading voice-pack content.
