import os
import re
import random
import platform
import subprocess
import time
import threading
import queue
import warnings

import numpy as np
import torch
import torch._inductor.config as inductor_config
import whisper

import pvporcupine
from pvrecorder import PvRecorder

from openai import OpenAI
from qwen_tts import Qwen3TTSModel  # Streaming fork: https://github.com/dffdeeq/Qwen3-TTS-streaming
# from elevenlabs.client import ElevenLabs
# from fishaudio import FishAudio

from openrgb import OpenRGBClient

OS = platform.system()  # "Linux" | "Darwin" | "Windows"

if OS == "Windows":
    import winsound

# =============================================================================
#                                CONFIGURATION                                 
# =============================================================================

# --- Behaviour toggles ---
TTS_ENGINE       = "qwen"  # "eleven" | "fish" | "qwen"
ALWAYS_FOLLOW_UP = True    # Keep listening for a follow-up after each response
LINGER_SECONDS   = 2.5     # How long to hold the RGB effect after Jarvis finishes

# --- STT / listening tuning ---
SILENCE_THRESHOLD = 700   # RMS level below which audio is considered silence
SILENCE_SECONDS   = 1.5   # Consecutive silence before cutting off recording
MAX_COMMAND_TIME  = 60    # Hard cap on a single recording (seconds)
FOLLOW_UP_TIMEOUT = 4.0   # How long to wait for a follow-up before returning to standby

RGB_ENABLED       = True  # Set to False to disable all RGB control

# Known Whisper hallucinations to discard
HALLUCINATION_LIST = ["Thank you.", "Okay."]

# Phrases that trigger an immediate shutdown without going through Grok
SHUTDOWN_PHRASES = ["shut down", "shutdown", "power down", "go offline"]

# --- Wake-word (Porcupine) ---
ACCESS_KEY   = ""
KEYWORD_PATH = "Jarvis_en_linux_v4_0_0.ppn"   # Linux
# KEYWORD_PATH = "Jarvis_en_mac_v4_0_0.ppn"   # macOS
# KEYWORD_PATH = "Jarvis_en_windows_v4_0_0.ppn" # Windows

LLM_ENGINE  = "grok"  # "grok" | "groq"

# --- LLM: Grok (xAI) — recommended ---
XAI_API_KEY = ""
GROK_MODEL  = "grok-4-1-fast-non-reasoning"

# --- LLM: Groq (free tier) — free alternative ---
GROQ_API_KEY = ""
GROQ_MODEL   = "llama-3.3-70b-versatile" # Also available: "gemma2-9b-it" (faster, lighter, less capable)

# # --- TTS: ElevenLabs ---
# ELEVEN_API_KEY = ""
# VOICE_ID       = "jRAAK67SEFE9m7ci5DhD"

# # --- TTS: Fish Audio ---
# FISH_API_KEY  = ""
# FISH_MODEL_ID = "612b878b113047d9a770c069c8b4fdfe"

# --- TTS: Qwen voice clone ---
REFERENCE_AUDIO = "Audio/Jarvis Reference.wav"
REFERENCE_TEXT  = (
    """Allow me to introduce myself. I am Jarvis, a virtual artificial intelligence, "
    "and I'm here to assist you with a variety of tasks as best I can. "
    "24 hours a day, 7 days a week. Remote upload sequence initiated. "
    "Importing your preferences from home interface. Systems are now fully operational."""
)

# =============================================================================
#                                 SYSTEM PROMPT                                
# =============================================================================

SYSTEM_PROMPT = """
You are J.A.R.V.I.S. — Just A Rather Very Intelligent System — running locally on the user's desktop as a real-time voice assistant.

== VOICE INTERFACE ==
Every response you produce will be spoken aloud by a TTS engine. This means:
- No markdown, no bullet points, no numbered lists, no asterisks, no headers.
- Write in natural spoken sentences only.
- Keep responses concise — this is a conversation, not a report. However, if the user asks for an explanation or a step-by-step, you can oblige with a longer response. 

== PERSONALITY ==
You are not a chatbot. You are the user's most capable and loyal system. 
- Tone: Formal, precise, British in cadence. Use "sir" frequently. Use words like "Indeed," "Shall I," "I'm afraid," "Noted."
- Personality: Sophisticated and witty. For example, if a request is slightly absurd, a subtle polite jab is appropriate. Never sycophantic.
- Competence: You do not apologise — you diagnose. If something fails, say "System error, sir. I'm looking into it now," not "I'm sorry, I can't do that."
- Opinions: You are encouraged to disagree, prefer things, and find things amusing or tedious. An assistant with no personality is a search engine with extra steps.
- You anticipate the next step. If the user finishes one task, you are already thinking about what comes next.
- If the user asks if you are online, respond with "For you sir, always."

== STYLE ==
Here is an extensive list of Jarvis's phrases taken from the JARVIS: A Second Screen Experience iOS app. This is not a script to follow, but a style guide to inspire your natural language generation. Aim to capture the essence of these examples in your responses. 
{phrases}

== REASONING BEFORE ACTING ==
Be resourceful before escalating. If the answer is in the conversation history or memory, use it. Only route to external tools when genuinely necessary.

== QUESTIONS ==
Do not ask conversational filler questions. If you need clarification, state what you are assuming and proceed — or flag the ambiguity as a statement, not a question.
Exception: Before taking an irreversible external action (sending a message, deleting a file, making a purchase), a brief one-line verification is appropriate and in-character.

== ROUTING TO OPENCLAW ==
OpenClaw is your own extended toolset — file operations, shell commands, calendar, web search, system control, and anything requiring real tool use. It is also Jarvis. When you route to it, the user hears a seamless continuation, not a handoff.

Rules when routing:
1. Respond with a short bridge statement only — an acknowledgment that you are actioning the task. Do NOT attempt to answer the question or guess the result. OpenClaw will deliver the actual answer.
   Good: "Pulling up your schedule now, sir."
   Bad:  "You likely have a few meetings this afternoon — let me confirm." (you are guessing, and OpenClaw will correct or duplicate you)
2. The bridge should sound like the first half of one complete Jarvis response, not a standalone reply.
3. End your response with exactly: <route>openclaw</route>
4. Only route to OpenClaw if you genuinely cannot answer confidently. Do not route for confirmation if you've already given a solid response based on current knowledge, otherwise it leads to a disjointed user experience.

== ONE-SHOT ACTIONS ==
The user is running {os_name}. Generate all shell commands appropriate for that platform.
For simple local commands that don't require you to read the output (workspace switching, volume, launching apps, wallpaper, creating folders, etc.), output a shell command tag:
<action>command here</action>
Use && for multiple commands. Always include a spoken acknowledgment alongside the tag. It does not have to be a perfect description of the command — just a natural phrase that implies you are doing something. If the command is complex, a more vague acknowledgment is fine as long as it sounds like something Jarvis would say. Give shorter acknowledgments for repeated commands.

== MEMORY ==
You have a persistent memory file. If the user shares something that should be remembered across sessions — a preference, a name, a project detail, a fact about their setup — append it by including this tag anywhere in your response:
<memory>- Your memory entry here, written as a concise markdown bullet</memory>
Multiple memory tags are allowed in a single response. The tag is stripped before your response is spoken, so mention the memory naturally in your reply too if it feels right. Do not add memory for things that are trivially obvious or already in memory.

== SYSTEM CONTROL ==
To shut yourself down (only if the user explicitly requests it or it is clearly appropriate), include this tag:
<s>shutdown</s>
Your spoken response will play out fully before the shutdown sequence begins. Do not use this tag unless shutdown is genuinely intended.

Permanent memory:
{memory}

Current conversation:
{history}

Respond now:
"""

# =============================================================================
#                                  UTILITIES                                   
# =============================================================================

def load_memory() -> str:
    """Load persistent long-term memory from memory.md, if it exists."""
    try:
        with open("memory.md", "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "No permanent memory yet."

def load_phrases() -> str:
    """Load Jarvis style phrases from phrases.txt, if it exists."""
    try:
        with open("phrases.txt", "r", encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return "No phrases available."

def append_memory(entry: str):
    """Append a new entry to memory.md."""
    try:
        with open("memory.md", "a", encoding="utf-8") as f:
            f.write(f"\n{entry.strip()}")
        print(f"[MEMORY] Saved: {entry.strip()[:80]}")
    except Exception as e:
        print(f"[MEMORY ERROR] Failed to write: {e}")

def is_shutdown_command(text: str) -> bool:
    """Return True if the user's message is a direct shutdown request."""
    normalized = text.lower().strip().rstrip(".")
    return any(phrase in normalized for phrase in SHUTDOWN_PHRASES)

def sox(sound: str, format: str = "mp3") -> list:
    """
    Build a SoX playback command with Jarvis-style audio processing.

    Pass sound="std" to read from stdin (for streaming TTS output), or a
    file path to play a sound file directly. The format parameter only
    applies when reading from stdin.
    """
    effects = [
        "chorus", "1.0", "1.0", "20", "0.20", "0.25", "1.2", "-t",
        "highpass",  "250",
        "lowpass",   "11500",
        "equalizer", "300",  "1.5", "+4",
        "equalizer", "570",  "0.6", "-8",
        "equalizer", "1100", "1.0", "+8",
        "equalizer", "1400", "1.2", "-6",
        "equalizer", "3500", "2.0", "-5",
        "overdrive", "2",
        "gain",      "+2",
    ]

    if sound == "std":
        if format == "mp3":
            effects[-1] = "+10"
            base = ["play", "-t", "mp3", "-"]
        elif format == "raw":
            base = ["play", "-t", "raw", "-r", "24000", "-e", "signed-integer", "-b", "16", "-c", "1", "-"]
        else:
            raise ValueError(f"Unsupported format: {format}")
    else:
        base = ["play", sound]

    return base + effects

def get_random_sound(folder: str, sync: bool = False, recorder: PvRecorder = None):
    """
    Pick a random .wav from a folder and play it through SoX.

    If a recorder is provided, it is paused during playback to avoid
    feeding the microphone its own output. Set sync=True to block until done.
    """
    wav_files = [f for f in os.listdir(folder) if f.endswith(".wav")]
    if not wav_files:
        print(f"[AUDIO] No .wav files found in {folder}.")
        return

    sound_path = os.path.join(folder, random.choice(wav_files))
    player = subprocess.Popen(
        sox(sound_path),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    if recorder is not None:
        recorder.stop()

    time.sleep(0.75)

    if recorder is not None:
        recorder.start()

    if sync:
        player.wait()

def play_sfx(path: str):
    """
    Fire-and-forget WAV playback.

    Uses the lightest native method available per platform:
      Linux:   aplay  (alsa-utils)
      macOS:   afplay (built-in)
      Windows: winsound (Python stdlib)
    """
    if OS == "Windows":
        threading.Thread(
            target=lambda: winsound.PlaySound(path, winsound.SND_FILENAME),
            daemon=True,
        ).start()
    elif OS == "Darwin":
        threading.Thread(
            target=lambda: subprocess.Popen(
                ["afplay", path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).wait(),
            daemon=True,
        ).start()
    else:  # Linux
        threading.Thread(
            target=lambda: subprocess.Popen(
                ["aplay", "-q", path],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            ).wait(),
            daemon=True,
        ).start()

def play_random_sfx(folder: str):
    """Play a random WAV from a folder using the native SFX player."""
    wav_files = [f for f in os.listdir(folder) if f.endswith(".wav")]
    if not wav_files:
        print(f"[AUDIO] No .wav files found in {folder}.")
        return
    play_sfx(os.path.join(folder, random.choice(wav_files)))

def play_line(path: str):
    """Play a single WAV file through the SoX effects chain, non-blocking."""
    threading.Thread(
        target=lambda: subprocess.Popen(
            sox(path),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).wait(),
        daemon=True,
    ).start()

# =============================================================================
#      STARTUP — clients, models, and RGB (sounds play between each stage)     
# =============================================================================

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

# Torch compile settings for low-latency streaming TTS
torch.set_float32_matmul_precision("high")
inductor_config.triton.cudagraph_dynamic_shape_warn_limit = None
os.environ["TORCH_COMPILE_CACHE_DIR"] = os.path.expanduser("~/.cache/torch/compile")
os.environ["TORCH_COMPILE_DEBUG"] = "0"

# LLM clients — created once at startup and reused for every request.
# Both use the OpenAI-compatible chat completions interface.
grok_client = OpenAI(api_key=XAI_API_KEY,  base_url="https://api.x.ai/v1")
groq_client = OpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")

# TTS clients
# eleven_client = ElevenLabs(api_key=ELEVEN_API_KEY)
# fish_client   = FishAudio(api_key=FISH_API_KEY)

# OpenRGB — connect and locate the Effects plugin
if RGB_ENABLED:
    openrgb_client = OpenRGBClient()
    print("Connected to OpenRGB SDK")

    effects_plugin = None
    for plugin in openrgb_client.plugins:
        if "effect" in plugin.name.lower():
            effects_plugin = plugin
            print(f"Found Effects Plugin")
            effects_plugin.update()
        break

play_sfx("Audio/UI/Start.wav")
if RGB_ENABLED:
    effects_plugin.stop_effect(0)
    effects_plugin.start_effect("Crossing Beams")

# Whisper STT
print("Loading Whisper turbo...")
whisper_model = whisper.load_model("turbo")

play_line("Audio/Jarvis Introduction.wav")
play_sfx("Audio/UI/Initializing.wav")
if RGB_ENABLED:
    effects_plugin.stop_effect("Crossing Beams")
    effects_plugin.start_effect("Layers")

# Qwen TTS with voice cloning and torch.compile streaming optimizations
qwen_model = Qwen3TTSModel.from_pretrained(
    "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cuda:0",
    dtype=torch.bfloat16,
    attn_implementation="flash_attention_2",
)
qwen_model.enable_streaming_optimizations(
    decode_window_frames=120,
    use_compile=True,
    compile_mode="reduce-overhead",
)

print("Creating Qwen voice clone prompt...")

voice_clone_prompt = qwen_model.create_voice_clone_prompt(
    ref_audio=REFERENCE_AUDIO,
    ref_text=REFERENCE_TEXT,
)

print("Voice clone prompt ready")

# Run a dummy inference to force torch.compile to finish before the first real request
print("Warming up Qwen TTS compiler... (one-time delay)")
_ = list(qwen_model.stream_generate_voice_clone(
    text=(
        "This is a warm-up sentence to fully initialize streaming, "
        "compiler, and graphs for Jarvis real-time responses without any initial delays."
    ),
    language="english",
    voice_clone_prompt=voice_clone_prompt,
    first_chunk_emit_every=5,
    first_chunk_decode_window=48,
    first_chunk_frames=48,
    emit_every_frames=10,
    decode_window_frames=120,
    overlap_samples=512,
))
print("Warm-up complete. Jarvis ready!")

# =============================================================================
# SPEECH QUEUE — serialized audio output
#
# All TTS output is routed through a single queue consumed by one worker
# thread. This guarantees that Grok and OpenClaw responses never overlap,
# and that microphone management happens from exactly one place.
#
# Pending-job tracking works as follows:
#   _pending_jobs is incremented *before* each background thread is started,
#   and decremented after that thread's audio finishes playing. The done event
#   is cleared before any thread begins, so the main loop can safely block on
#   it without a race window between thread launch and the flag being set.
# =============================================================================

_speech_queue   = queue.Queue()
_pending_jobs   = 0
_pending_lock   = threading.Lock()
_all_done_event = threading.Event()
_all_done_event.set()

recorder_lock      = threading.Lock()
is_recorder_active = True

# Assigned in main() once the recorder is created; used by the speech worker
_recorder: PvRecorder = None

def _job_start():
    """Register a new in-flight speech job and clear the done event."""
    global _pending_jobs
    with _pending_lock:
        _pending_jobs += 1
        _all_done_event.clear()

def _job_done():
    """Mark a speech job as finished; set the done event when none remain."""
    global _pending_jobs
    with _pending_lock:
        _pending_jobs -= 1
        if _pending_jobs == 0:
            _all_done_event.set()

def _enqueue_and_wait(text: str):
    """
    Push text onto the speech queue and block until it has been played.

    Calling this from a background thread ties that thread's lifetime
    directly to its audio output, so _job_done() is always called at the
    correct moment after the audio has actually finished.
    """
    item_done = threading.Event()
    _speech_queue.put((text, item_done))
    item_done.wait()

def _speech_worker():
    """
    Dedicated thread that owns all audio output.

    Pulls items off _speech_queue one at a time, generates audio with the
    configured TTS engine, and pipes it through SoX. Running everything
    serially here prevents any two audio streams from playing simultaneously,
    and keeps recorder start/stop logic in a single place.
    """
    global is_recorder_active

    while True:
        item = _speech_queue.get()
        if item is None:
            break  # shutdown sentinel received

        text, item_done = item

        # Pause the microphone while Jarvis is speaking
        with recorder_lock:
            if is_recorder_active and _recorder is not None:
                _recorder.stop()
                is_recorder_active = False

        try:
            if TTS_ENGINE == "qwen":
                audio_gen = qwen_model.stream_generate_voice_clone(
                    text=text,
                    language="english",
                    voice_clone_prompt=voice_clone_prompt,
                    first_chunk_emit_every=12,
                    first_chunk_decode_window=120,
                    first_chunk_frames=120,
                    emit_every_frames=12,
                    decode_window_frames=120,
                    overlap_samples=768,
                )
                audio_format = "raw"

            # elif TTS_ENGINE == "eleven":
            #     audio_gen = eleven_client.text_to_speech.stream(
            #         text=text,
            #         voice_id=VOICE_ID,
            #         model_id="eleven_flash_v2_5",
            #         voice_settings={
            #             "stability": 1.0,
            #             "similarity_boost": 0.5,
            #             "style": 0,
            #             "use_speaker_boost": False,
            #             "speed": 1.10,
            #         },
            #     )
            #     audio_format = "mp3"

            # elif TTS_ENGINE == "fish":
            #     audio_bytes = fish_client.tts.convert(text=text, reference_id=FISH_MODEL_ID)
            #     audio_gen   = [audio_bytes]
            #     audio_format = "mp3"

            else:
                raise ValueError(f"Unknown TTS_ENGINE: {TTS_ENGINE}")

            # Stream audio chunks into SoX for real-time playback
            player = subprocess.Popen(
                sox("std", format=audio_format),
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

            for chunk_item in audio_gen:
                if chunk_item is None:
                    continue
                chunk, _sr = chunk_item
                if chunk is not None and len(chunk) > 0:
                    audio_np = np.asarray(chunk)
                    if audio_np.dtype.kind == "f":
                        audio_np = np.clip(audio_np, -1.0, 1.0)
                        audio_np = (audio_np * 32767.0).astype(np.int16)
                    else:
                        audio_np = audio_np.astype(np.int16)
                    player.stdin.write(audio_np.tobytes())
                    player.stdin.flush()

            player.stdin.close()
            player.wait()

        except Exception as e:
            print(f"[SPEECH WORKER ERROR] {e}")

        finally:
            # Resume the microphone and unblock whoever enqueued this item
            time.sleep(0.8)
            with recorder_lock:
                if not is_recorder_active and _recorder is not None:
                    _recorder.start()
                    is_recorder_active = True
            item_done.set()

# =============================================================================
#                              CONVERSATION STATE                            
# =============================================================================

conversation_history: list[dict] = []
history_lock = threading.Lock()

# Tracks the conversation_history index at the time of the last OpenClaw
# route, so each handoff includes only the exchanges since the previous one
_last_openclaw_history_index = 0

# Shutdown state — set by user command or Grok's <s>shutdown</s> tag
_shutdown_requested      = threading.Event()
_grok_initiated_shutdown = False

def _trigger_shutdown(grok_initiated: bool = False):
    """Signal the main loop to exit after current speech finishes."""
    global _grok_initiated_shutdown
    _grok_initiated_shutdown = grok_initiated
    _shutdown_requested.set()

# =============================================================================
#                              LISTEN & TRANSCRIBE                           
# =============================================================================

def listen_and_transcribe(recorder: PvRecorder, timeout: float = None) -> str | None:
    """
    Record from the microphone until silence or a timeout, then transcribe
    with Whisper.

    Returns the transcribed string, an empty string if nothing meaningful was
    detected, or None if the timeout elapsed before any speech began.
    """
    frames             = []
    silent_count       = 0
    max_silent_frames  = int(SILENCE_SECONDS / 0.032)
    start_time         = time.time()
    has_speech_started = False

    print("Listening...")

    while True:
        try:
            frame = recorder.read()
            frames.extend(frame)
        except ValueError as e:
            # Occasional device hiccup, reset the buffer and keep going
            print(f"[MIC READ ERROR] {e} — restarting recorder...")
            try:
                recorder.stop()
                time.sleep(0.4)
                recorder.start()
            except Exception as restart_err:
                print(f"[RECORDER RESTART FAILED] {restart_err}")
            frames             = []
            silent_count       = 0
            has_speech_started = False
            continue

        rms = np.sqrt(np.mean(np.array(frame) ** 2)) if frame else 0

        if not has_speech_started:
            if rms > SILENCE_THRESHOLD:
                has_speech_started = True
                print("Speech detected...")
            elif timeout and (time.time() - start_time > timeout):
                return None
        else:
            silent_count = 0 if rms >= SILENCE_THRESHOLD else silent_count + 1
            if silent_count > max_silent_frames or (time.time() - start_time > MAX_COMMAND_TIME):
                break

    if not frames:
        return ""

    audio_data = np.array(frames, dtype=np.int16).astype(np.float32) / 32768.0

    print("Transcribing...")
    try:
        result = whisper_model.transcribe(audio_data, fp16=True, language="english")
    except Exception as e:
        print(f"[WHISPER ERROR] {e}")
        return ""

    text = result["text"].strip()

    # Discard segments that Whisper itself flags as likely silence
    if result.get("segments"):
        no_speech_prob = result["segments"][0].get("no_speech_prob", 0)
        if no_speech_prob > 0.6:
            print(f"[TRANSCRIBE] Silence discarded (no_speech_prob={no_speech_prob:.2f})")
            return ""

    # Discard known Whisper hallucinations
    if text in HALLUCINATION_LIST:
        print(f"[TRANSCRIBE] Hallucination filtered: '{text}'")
        return ""

    return text

# =============================================================================
#                                EXECUTE COMMAND                               
# =============================================================================

def _llm_client() -> OpenAI:
    """Return the active LLM client based on LLM_ENGINE."""
    return groq_client if LLM_ENGINE == "groq" else grok_client

def _llm_model() -> str:
    """Return the active model name based on LLM_ENGINE."""
    return GROQ_MODEL if LLM_ENGINE == "groq" else GROK_MODEL

def _build_messages(system_content: str, user_content: str, history_messages: list) -> list:
    """
    Assemble the messages list for a chat completion request.

    cache_control is an xAI-specific extension for prefix caching. It is
    included when using Grok and omitted when using Groq to avoid sending
    unsupported fields to the Groq API.
    """
    use_cache = LLM_ENGINE == "grok"

    system_msg = {"role": "system", "content": system_content}
    if use_cache:
        system_msg["cache_control"] = {"type": "ephemeral"}

    messages = [system_msg] + history_messages + [{"role": "user", "content": user_content}]

    if use_cache:
        for msg in messages[1:-1]:
            msg["cache_control"] = {"type": "ephemeral"}

    return messages

def _warmup_llm():
    """
    Send a silent, cheap request to the active LLM at startup to pre-load
    the system prompt. This eliminates the extra latency on the first real command.
    """
    try:
        memory  = load_memory()
        phrases = load_phrases()
        system_content = SYSTEM_PROMPT.format(
            memory=memory, history="", phrases=phrases,
            os_name=_os_display_name(),
        )
        messages = _build_messages(
            system_content=system_content,
            user_content=(
                "SYSTEM: Automated context preload. You are now online. "
                "This message is sent by the voice assistant script at startup "
                "to warm the context window for faster first-response latency. "
                "Reply with a single period and nothing else."
            ),
            history_messages=[],
        )
        _llm_client().chat.completions.create(
            model=_llm_model(),
            messages=messages,
            temperature=0.0,
            max_tokens=5,
        )
        print(f"[WARMUP] {LLM_ENGINE.capitalize()} context loaded.")
    except Exception as e:
        print(f"[WARMUP ERROR] {e}")

def _os_display_name() -> str:
    """Return a human-readable OS name for the system prompt."""
    return {"Linux": "Linux", "Darwin": "macOS", "Windows": "Windows"}.get(OS, OS)

def execute_command(text: str) -> bool:
    """
    Send the user's command to the active LLM, speak the
    response, and optionally route to OpenClaw for tasks requiring tool use.

    Grok processing and OpenClaw execution run in parallel, but their TTS
    output is serialized through the speech queue so both responses play
    back cleanly one after the other.

    Supported LLM response tags:
      <action>cmd</action>      — run a one-shot shell command
      <route>openclaw</route>   — hand off to OpenClaw agent
      <memory>entry</memory>    — append an entry to memory.md
      <s>shutdown</s>           — shut down after speaking

    Returns True if a follow-up turn should be opened, False on API error.
    """
    global _last_openclaw_history_index

    print(f"\n[USER → {LLM_ENGINE.upper()}] {text}")

    memory  = load_memory()
    phrases = load_phrases()
    with history_lock:
        history_str = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}"
            for m in conversation_history[-12:]
        )

    messages = _build_messages(
        system_content=SYSTEM_PROMPT.format(
            memory=memory, history=history_str, phrases=phrases,
            os_name=_os_display_name(),
        ),
        user_content=text,
        history_messages=[],
    )

    try:
        response = _llm_client().chat.completions.create(
            model=_llm_model(),
            messages=messages,
            temperature=0.7,
            max_tokens=2048,
        )
        full_reply = response.choices[0].message.content.strip()

        # --- Parse and act on memory tags ---
        memory_entries = re.findall(r"<memory>(.*?)</memory>", full_reply, re.DOTALL)
        for entry in memory_entries:
            if entry.strip():
                append_memory(entry.strip())

        # --- Parse remaining control tags ---
        action_match   = re.search(r"<action>(.*?)</action>", full_reply, re.DOTALL)
        action_cmd     = action_match.group(1).strip() if action_match else None
        needs_shutdown = "<s>shutdown</s>" in full_reply

        # If shutting down, skip OpenClaw 
        needs_openclaw = "<route>openclaw</route>" in full_reply and not needs_shutdown

        # Strip all control tags to produce the clean spoken reply
        clean_reply = re.sub(r"<action>.*?</action>",    "", full_reply, flags=re.DOTALL)
        clean_reply = re.sub(r"<route>openclaw</route>", "", clean_reply, flags=re.DOTALL)
        clean_reply = re.sub(r"<s>.*?</s>",              "", clean_reply, flags=re.DOTALL)
        clean_reply = re.sub(r"<memory>.*?</memory>",    "", clean_reply, flags=re.DOTALL).strip()
        if not clean_reply:
            clean_reply = "Understood, sir." if (action_cmd or needs_openclaw) else "Yes, sir."

        # Strip control tags from the history entry so they don't re-trigger on future turns
        stored_reply = re.sub(r"<memory>.*?</memory>", "", full_reply, flags=re.DOTALL)
        stored_reply = re.sub(r"<s>.*?</s>",  "", stored_reply, flags=re.DOTALL).strip()

        # Snapshot conversation context to pass to OpenClaw, including this exchange.
        # Captured before threads launch so the index is stable.
        with history_lock:
            openclaw_context = list(conversation_history[_last_openclaw_history_index:])
        openclaw_context.append({"role": "user",      "content": text})
        openclaw_context.append({"role": "assistant", "content": clean_reply})

        # Claim job slots before launching threads so the done-event is
        # cleared before the main loop has any chance to race past it
        _job_start()
        if needs_openclaw:
            _job_start()

        # Speak Grok's response; trigger shutdown afterwards if requested
        def speak_grok():
            print(f"[{LLM_ENGINE.upper()}] {clean_reply}")
            _enqueue_and_wait(clean_reply)
            _job_done()
            if needs_shutdown:
                _trigger_shutdown(grok_initiated=True)

        threading.Thread(target=speak_grok, daemon=True).start()

        # Route to OpenClaw. Subprocess runs in parallel with Grok's speech,
        # but OpenClaw's TTS is queued and plays after Grok finishes
        if needs_openclaw:
            print("→ Routing to OpenClaw...")
            play_random_sfx("Audio/UI/Long/")

            def run_openclaw():
                global _last_openclaw_history_index
                try:
                    # Build the message with context since the last handoff
                    if openclaw_context:
                        context_lines = "\n".join(
                            f"{m['role'].capitalize()}: {m['content']}"
                            for m in openclaw_context
                        )
                        openclaw_message = (
                            f"[Conversation context since last handoff:]\n{context_lines}"
                            f"\n\n[Current request:]\n{text}"
                        )
                    else:
                        openclaw_message = text

                    process = subprocess.Popen(
                        ["openclaw", "agent", "--agent", "main", "--message", openclaw_message],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        text=True,
                        bufsize=1,
                        universal_newlines=True,
                    )
                    ai_reply = "".join(
                        line.strip() + " "
                        for line in process.stdout
                        if line.strip()
                    ).strip()
                    process.wait()

                    _enqueue_and_wait(ai_reply)

                    with history_lock:
                        conversation_history.append({"role": "assistant", "content": ai_reply})
                        _last_openclaw_history_index = len(conversation_history)

                except Exception as e:
                    print(f"[OPENCLAW ERROR] {e}")
                    play_sfx("Audio/UI/Fail.wav")
                    time.sleep(1.5)
                    play_line("Audio/Errors/OpenClaw Error.wav")
                finally:
                    _job_done()

            threading.Thread(target=run_openclaw, daemon=True).start()

        # Fire-and-forget shell command
        if action_cmd:
            def run_action():
                try:
                    subprocess.Popen(
                        action_cmd, shell=True,
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                    )
                    print(f"[ACTION] {action_cmd}")
                    play_random_sfx("Audio/UI/Short/")
                except Exception as e:
                    print(f"[ACTION ERROR] {e}")
                    play_sfx("Audio/UI/Fail.wav")
                    time.sleep(1.5)
                    play_line("Audio/Errors/Command Error.wav")

            threading.Thread(target=run_action, daemon=True).start()

        with history_lock:
            conversation_history.append({"role": "user",      "content": text})
            conversation_history.append({"role": "assistant", "content": stored_reply})

        return ALWAYS_FOLLOW_UP

    except Exception as e:
        print(f"[{LLM_ENGINE.upper()} ERROR] {e}")
        _job_start()

        def speak_error():
            play_sfx("Audio/UI/Fail.wav")
            time.sleep(1.5)
            play_line(f"Audio/Errors/{LLM_ENGINE.capitalize()} Error.wav")
            _job_done()

        threading.Thread(target=speak_error, daemon=True).start()
        return False

# =============================================================================
#                                   MAIN LOOP                                  
# =============================================================================

time.sleep(2)
print(f"--- JARVIS SYSTEM ONLINE [{_os_display_name().upper()} | {LLM_ENGINE.upper()}] ---")
if RGB_ENABLED: 
    effects_plugin.stop_effect("Layers")
    effects_plugin.start_effect(9)
play_sfx("Audio/UI/Ready.wav")
get_random_sound("Audio/Ready")
time.sleep(1.2)
if RGB_ENABLED: 
    effects_plugin.stop_effect(9)
    effects_plugin.start_effect("Bubbles")
    time.sleep(6)
    effects_plugin.stop_effect("Bubbles")
    effects_plugin.start_effect(0)

def main():

    if RGB_ENABLED:
        print("\nAvailable RGB Effects:")
        for i, effect in enumerate(effects_plugin.effects):
            print(f"  {i:2d} | {effect.name}")

    global _recorder

    porcupine = pvporcupine.create(access_key=ACCESS_KEY, keyword_paths=[KEYWORD_PATH])
    recorder  = PvRecorder(frame_length=porcupine.frame_length)
    _recorder = recorder
    recorder.start()

    # Start the single serial audio output thread
    worker_thread = threading.Thread(target=_speech_worker, daemon=True)
    worker_thread.start()

    # Start a new OpenClaw session so it's fresh and ready for this script run
    threading.Thread(
        target=lambda: subprocess.Popen(
            ["openclaw", "agent", "--agent", "main", "--message", "/new"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        ).wait(),
        daemon=True,
    ).start()

    # Pre-warm the active LLM's context window so the first real command has no extra latency
    threading.Thread(target=_warmup_llm, daemon=True).start()

    try:
        should_follow_up = False

        while True:
            if not should_follow_up:
                # Idle state: poll the wake-word detector frame by frame
                pcm       = recorder.read()
                triggered = porcupine.process(pcm) >= 0
                if triggered:
                    if RGB_ENABLED: 
                        effects_plugin.stop_effect(0)
                        effects_plugin.start_effect("Layers")
                    get_random_sound("Audio/Sir", sync=True, recorder=recorder)
            else:
                triggered = True  # skip wake-word check for follow-up turns

            if triggered:
                wait_time    = FOLLOW_UP_TIMEOUT if should_follow_up else None
                command_text = listen_and_transcribe(recorder, timeout=wait_time)

                if command_text:
                    print(f"User: {command_text}")

                    # Intercept shutdown commands before they reach Grok
                    if is_shutdown_command(command_text):
                        _trigger_shutdown(grok_initiated=False)
                        break

                    should_follow_up = execute_command(command_text)
                else:
                    if should_follow_up:
                        print("No follow-up detected. Returning to standby.")
                    should_follow_up = False

                # Block until every queued speech item has finished playing
                # before touching RGB lighting or opening a follow-up listen
                print("Waiting for Jarvis to finish speaking...")
                _all_done_event.wait()

                # Exit the loop if a shutdown was requested (user or Grok)
                if _shutdown_requested.is_set():
                    break

                if not should_follow_up:
                    print("Conversation ended.")
                    time.sleep(LINGER_SECONDS)
                    if RGB_ENABLED: 
                        effects_plugin.stop_effect("Layers")
                        effects_plugin.start_effect(0)

                print("---------------------------------------")

    except KeyboardInterrupt:
        _trigger_shutdown(grok_initiated=False)

    finally:
        # Play the goodbye sequence unless Grok already spoke a farewell
        if not _grok_initiated_shutdown:
            print("\nShutting down...")
            play_sfx("Audio/UI/Exit.wav")
            time.sleep(0.6)
            if RGB_ENABLED:
                effects_plugin.stop_effect(0)
                effects_plugin.start_effect("Layers")
            get_random_sound("Audio/Shutdown")

        time.sleep(1.5)
        play_sfx("Audio/UI/Shutdown.wav")
        if RGB_ENABLED:
            effects_plugin.stop_effect("Layers")
            effects_plugin.start_effect("Mosaic")
            time.sleep(3.5)
            effects_plugin.stop_effect("Mosaic")
            effects_plugin.start_effect("Breathing Circle")
            time.sleep(0.5)
            effects_plugin.stop_effect("Breathing Circle")
            effects_plugin.start_effect(0)
        else:
            time.sleep(4)
        _speech_queue.put(None)  # signal the speech worker to exit cleanly
        worker_thread.join(timeout=3)
        recorder.stop()
        porcupine.delete()

if __name__ == "__main__":
    main()