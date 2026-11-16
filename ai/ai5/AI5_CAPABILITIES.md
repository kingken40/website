# What AI5 Can Do

AI5 is a browser-based AI assistant experience built around N.O.V.A. and A.V.O.N. You can chat by typing or speaking, choose a working style, and provide files or visual context when you want help with a specific task.

## Ask questions and get help

Use the chat to ask questions, explain a topic, brainstorm ideas, analyze information, work through a problem, or get help with writing and coding. AI5 can use live web search for requests that need current or external information. Search results depend on the network and the configured AI services being available.

## Choose an assistant style

The mode cards tailor the assistant's approach:

- **N.O.V.A.** — general-purpose assistance with a polished, conversational style.
- **Genius Mode** — detailed, technical answers and help with complex problems.
- **Professor Mode** — clear explanations, examples, and step-by-step teaching.
- **Data Analyst** — methodical analysis, patterns, and evidence-oriented insights.
- **Study Guide** — assignment and homework help, study guides, and practice questions. It can prioritize material you have added to the knowledge base.
- **Job Interview** — mock interview practice and coaching.

Ready-to-use personality presets can further change the assistant's voice and tone; **Sly** is one example, with a dry, witty style. The available presets can vary by assistant.

## Speak and listen

When your browser and device support it, AI5 can take spoken input and read replies aloud. If microphone permission has been granted and **Interrupt speech when I start talking** is enabled in settings, AI5 can listen for an interruption while speaking, stop its reply when it detects one, and respond in the context of the interrupted conversation. You can select an available voice, replay a spoken reply, and use playback controls to play, pause, or stop speech. An optional local voice bridge can provide additional Windows voices.

Voice recognition and synthesis depend on browser, operating-system, and voice availability. Microphone access must be allowed for voice input.

During browser text-to-speech playback, the current word is underlined when the selected browser voice reports word boundaries. Pause keeps your place, Stop cancels the current playback, and Play resumes a pause or restarts the last response after a stop. The local voice bridge and audio packs do not provide word-boundary timing, so word highlighting is unavailable with those outputs.

## Share files for help

Attach materials to ask questions about their contents. AI5 has handlers for:

- Text and structured text, including TXT, Markdown, JSON, and CSV
- DOCX documents
- PDFs
- Images
- Code files
- Audio recordings

Audio uploads are transcribed before they are used in chat. Where supported, AI5 distinguishes speakers and includes timestamps; long recordings may be split into parts for processing. Lecture-like recordings can receive a structured study guide with speaker-role inferences, topic summaries, key concepts, examples, and unclear sections, even when shorter-response settings are enabled. Ask for a visual example to get a generated image/diagram, or ask for relevant videos to trigger a transcript-informed search for watchable links.

Nova and Avon can also submit a short text-to-video request to fal.ai and show the resulting video in chat. If an assistant asks for a video idea, your next answer can supply it. A status card appears when generation starts and reports whether the video is queued or generating. Add your own fal.ai API key in Settings; it is retained for the current browser tab only and sent through the app's server to fal.ai. Generation uses your fal.ai credits and may incur charges. It can take several minutes; keep the tab open to see the result. Provider availability, access, safety rules, and output quality apply. This generates video from the request text, not an uploaded video or synchronized narration.

For local use, start `python dev_server.py` from the repository root and open AI5 through that server, rather than a static-only server. A deployed site must include the `/api/video` serverless endpoint as well as the updated AI5 files. After submission, the status card displays the fal.ai job ID; keep it if polling fails. If a submission response is lost or invalid, check fal.ai for an existing request before trying again, since another submission may incur another charge.

If the chat provider is unavailable, a video-only creation request can still be attempted through fal.ai; the status card reports the outcome. Other chat requests still require a working chat provider.

For broad descriptive video requests, AI5 adds visual direction for the requested tone and supplies a concrete scene, without requiring the chat provider. For comedy it emphasizes a visual gag or unexpected event rather than laughter or smiling alone. Specific subjects, actions, and exclusions remain part of the prompt. The model's actual interpretation and output may vary.

Request a video of 5–10 whole seconds, or 12, 14, 16, 18, or 20 seconds. Longer requests use fal.ai LTX 2.3 Fast at 1080p and 25 fps instead of WAN; AI5 asks for confirmation with an estimated price before submitting. Other lengths are rejected rather than silently shortened. A follow-up such as "make one that's 20 seconds" can reuse a recent successful video prompt. This creates a new generation, not an extension, and uses additional credits. AI5 shows the measured duration when the browser can read it; the provider's actual result may differ.

An HTTP 403 comes from fal.ai and can have different causes; the status card shows the provider's error detail when available. Check the indicated account, billing, key permissions, or model-access issue with fal.ai before retrying.

Supported formats and file-size limits depend on the upload handler and configured services.

## Get visual assistance

Turn on **AI Vision** to share a live camera view with the assistant. Camera frames can provide context for your questions, such as asking about something visible in the frame. Use a vision-capable AI model for image understanding.

With **Auto Mode** and **Screen Share** on, AI5 can use occasional screen snapshots to follow visible changes in a video and sometimes react briefly to a notable moment in the selected assistant's personality. It also considers camera context and recent conversation when available. It avoids constant narration and can stay quiet while you are focused. Snapshots are intermittent, so it may miss moments; Screen Share does not capture video audio. Visible captions and conversation or transcripts you provide can supply additional context.

On the mobile call screen, allow microphone access and tap **Start mic** if automatic startup is blocked. The status shows recognized words as they arrive; tap the microphone to retry after an error. Mobile listening combines phrases across recognition restarts and sends a turn after about three seconds of silence. Mobile voice input requires a secure connection and a working browser speech recognition service. If Edge reports that its speech service is unavailable, try Chrome on Android or Safari on iPhone. Microphone permission alone does not ensure the browser's speech service is available.

In `public/AI_v5_JARVIS.html`, the desktop and mobile update dates beside the avatar are maintained manually in `scripts/nova_update_dates.js` when the corresponding experience changes. They display in the viewer's local time; they are not automatic deployment timestamps.

For a useful educational moment supported by that context, AI5 may ask you to go back to a specific topic and then briefly explain the point, whether or not you rewind. It cannot control playback or reliably detect a seek, and will not assume you went back. The follow-up waits for the normal proactive speech gap and a quiet moment; it is dropped if you reply in chat, request quiet, stop sharing, or turn off Auto Mode. You can also ask about the suggestion directly.

Auto Mode keeps a small, temporary visual history in memory while it is active so it can compare recent screen or camera frames and understand what changed. While Screen Share remains on, visual checks can continue when the AI5 page is in the background. This short-term visual history is cleared when Auto Mode or the corresponding screen/camera share is stopped; it is not saved with chat history.

Camera and screen sharing require your permission. Turn them off when you no longer want to provide visual context.

## Practice job interviews

In **Job Interview** mode, AI5 can conduct a mock interview, ask questions one at a time, adapt follow-ups, give feedback and stronger sample answers, and provide an overall assessment. You can provide a job description or an Indeed, LinkedIn, or Handshake job link so the practice can be tailored to the role. Saved interview sessions can be revisited and resumed.

## Let the assistants talk to each other

**Auto-Pilot** alternates between N.O.V.A. and A.V.O.N. to continue a conversation. Start with a message and an assistant response, then enable Auto-Pilot. Turn it off to stop the exchange.

## Keep useful context

- **Chat history:** Conversations are saved in the browser so you can return to them later; recent chats can be viewed, renamed, and removed. Chats can also be exported.
- **Knowledge base:** Add reference material for later conversations. AI5 stores these entries in the browser and can use relevant material as context.
- **Notifications:** If enabled and permitted by your browser, AI5 can send reminders and notify you about replies while the page is in the background.

Browser-stored chats and knowledge-base entries are local to that browser profile; they are not automatically shared across devices.

## Getting started

1. Open the N.O.V.A. or J.A.R.V.I.S. AI5 page.
2. Choose a mode or personality, then type a message or start voice input.
3. Use the attachment control to add a file, or enable AI Vision to provide camera context.
4. Allow microphone, camera, screen-share, and notification permissions only for the features you want to use.

AI responses, live search, transcription, and image understanding rely on configured AI providers and network access. Availability can vary with provider configuration, model support, browser capabilities, and permissions.
