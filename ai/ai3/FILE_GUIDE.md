# ai3 file guide

This folder is the Flask-based AI chatbot project. The notes below explain each file and its main content blocks.

## `app.py`

- Imports Flask, CORS, dotenv, requests, and OS helpers.
- Loads environment variables from `.env`.
- Creates the Flask app and enables CORS.
- Reads `OPENAI_API_KEY` from the environment.
- Exposes `POST /api/chat` as a proxy to OpenAI's chat completions API.
- Returns a 500 if the key is missing.
- Wraps the request in timeout/error handling.
- Runs the backend on port `5001` when launched directly.

## `AI_v3.html`

- Main browser page for the ai3 chatbot.
- Loads the stylesheet from `styles/ai_v3_styles.css`.
- Loads the JS runtime from `scripts/ai_v3_main.js`.
- Shows the chat controls at the top.
- Defines the personality picker block.
- Provides the message container and composer area.
- Includes the file upload menu and hidden file input.
- Includes the chat history modal.
- Includes the personality help modal.
- Contains a small inline script block that documents the backend URL behavior.

## `public/AI_v3.html`

- Browser-facing copy of the chatbot UI.
- Uses the same personality controls, chat controls, and message composer.
- Keeps the page simple for direct opening in a browser.
- Loads the shared JS runtime from `scripts/ai_v3_main.js`.

## `scripts/ai_v3_main.js`

- Main client-side chatbot logic.
- Stores and loads API keys from `localStorage`.
- Chooses between API providers and models.
- Detects task type so the app can choose speed vs reasoning vs long-form settings.
- Caches model catalogs and user model preferences.
- Controls model dropdown text and response model labels.
- Implements file-size limits for uploads.
- Holds the personality definitions and chat state.
- Builds message history and chat exports.
- Handles chat initialization and UI setup.

## `styles/ai_v3_styles.css`

- All ai3 page styling.
- Covers layout, chat bubbles, buttons, modals, upload menu, and personality cards.
- Defines the visual look of the desktop chatbot.

## `requirements.txt`

- Lists the Python packages needed for the Flask backend.
- Includes Flask, CORS support, dotenv loading, and `requests`.

## `DEPLOYMENT.md`

- Step-by-step local run instructions.
- Vercel deployment notes.
- Environment variable setup guidance.
- Troubleshooting and curl test examples.

## `AI_v3_ORGANIZED_BACKUP.html`

- Backup copy of the ai3 HTML.
- Preserves an older organized version of the page for reference.

## `.env`

- Local environment file for secrets like `OPENAI_API_KEY`.
- Should stay uncommitted.

