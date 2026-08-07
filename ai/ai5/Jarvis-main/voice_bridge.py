from __future__ import annotations

import os
import tempfile
import threading
from io import BytesIO
from flask import Flask, jsonify, request, send_file

# ── TTS ENGINE SWITCH ────────────────────────────────────────────────────────
# Set USE_XTTS = True  to use Coqui XTTS v2 (cloned voice, requires GPU/CPU)
# Set USE_XTTS = False to use Windows SAPI (Microsoft voices, no extra install)
USE_XTTS = True

# Path to a WAV voice sample for XTTS cloning.
# Needs to be 6–30 s of clear speech from the voice you want to clone.
# Record your own, or use any clear spoken-word WAV you have.
# Example: r"..\JARVIS\my_voice_sample.wav"
XTTS_SPEAKER_WAV = os.path.join(os.path.dirname(__file__), "speaker_sample.wav")

# XTTS language code (en, es, fr, de, it, pt, pl, tr, ru, nl, cs, ar, zh-cn, hu, ko, ja, hi)
XTTS_LANGUAGE = "en"
# ─────────────────────────────────────────────────────────────────────────────

# ── XTTS IMPORTS ─────────────────────────────────────────────────────────────
if USE_XTTS:
    from TTS.api import TTS as CoquiTTS
    import torch

    _xtts_lock = threading.Lock()
    _xtts_model = None

    def _get_xtts():
        global _xtts_model
        if _xtts_model is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[XTTS] Loading model on {device} ...")
            _xtts_model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
            print("[XTTS] Model ready.")
        return _xtts_model
# ─────────────────────────────────────────────────────────────────────────────

# ── WINDOWS SAPI IMPORTS (kept for easy switch-back) ─────────────────────────
# import pythoncom
# import win32com.client
# ─────────────────────────────────────────────────────────────────────────────

app = Flask(__name__)

# _sapi_lock = threading.Lock()   # used by SAPI path


# ── SAPI HELPERS (kept, unused when USE_XTTS=True) ───────────────────────────
# def _sapi_rate_from_float(rate: float) -> int:
#     clamped = min(2.0, max(0.5, float(rate)))
#     return int(round((clamped - 1.0) * 10))
#
#
# def _sapi_volume_from_float(volume: float) -> int:
#     clamped = min(1.0, max(0.0, float(volume)))
#     return int(round(clamped * 100))
#
#
# def _pick_voice_token(voice_collection, preferred_name: str | None):
#     if not preferred_name:
#         return None
#     preferred_lower = preferred_name.strip().lower()
#     if not preferred_lower:
#         return None
#     for idx in range(voice_collection.Count):
#         token = voice_collection.Item(idx)
#         description = token.GetDescription() or ""
#         if preferred_lower in description.lower():
#             return token
#     return None
# ─────────────────────────────────────────────────────────────────────────────


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/health", methods=["GET"])
def health():
    engine = "xtts_v2" if USE_XTTS else "sapi"
    return jsonify({"ok": True, "service": "jarvis-main-voice-bridge", "engine": engine})


@app.route("/voices", methods=["GET"])
def voices():
    if USE_XTTS:
        # XTTS is single-voice (cloned from XTTS_SPEAKER_WAV); report the sample path
        return jsonify({"engine": "xtts_v2", "speaker_wav": XTTS_SPEAKER_WAV, "voices": ["xtts-cloned"]})

    # ── SAPI voice list (restore when USE_XTTS=False) ────────────────────────
    # with _sapi_lock:
    #     pythoncom.CoInitialize()
    #     try:
    #         speaker = win32com.client.Dispatch("SAPI.SpVoice")
    #         available = speaker.GetVoices()
    #         result = []
    #         for idx in range(available.Count):
    #             token = available.Item(idx)
    #             result.append(token.GetDescription())
    #         return jsonify({"voices": result})
    #     finally:
    #         pythoncom.CoUninitialize()
    # ─────────────────────────────────────────────────────────────────────────


@app.route("/speak", methods=["POST", "OPTIONS"])
def speak():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Missing text"}), 400

    # rate/volume accepted for API compat; XTTS speed is fixed (adjust XTTS_LANGUAGE/model settings for tuning)
    # preferred_voice = payload.get("voice_name")   # used by SAPI path
    # rate   = payload.get("rate", 0.9)              # used by SAPI path
    # volume = payload.get("volume", 0.85)           # used by SAPI path

    if USE_XTTS:
        # ── XTTS path ────────────────────────────────────────────────────────
        if not os.path.isfile(XTTS_SPEAKER_WAV):
            return jsonify({
                "error": f"Speaker sample not found: {XTTS_SPEAKER_WAV}. "
                         "Record or place a 6–30 s WAV of the voice you want to clone there."
            }), 500

        tmp_path = None
        with _xtts_lock:
            try:
                model = _get_xtts()
                fd, tmp_path = tempfile.mkstemp(prefix="xtts_bridge_", suffix=".wav")
                os.close(fd)

                model.tts_to_file(
                    text=text,
                    speaker_wav=XTTS_SPEAKER_WAV,
                    language=XTTS_LANGUAGE,
                    file_path=tmp_path
                )

                with open(tmp_path, "rb") as f:
                    audio_bytes = f.read()

                return send_file(
                    BytesIO(audio_bytes),
                    mimetype="audio/wav",
                    as_attachment=False,
                    download_name="xtts_bridge.wav"
                )
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except OSError:
                        pass
        # ─────────────────────────────────────────────────────────────────────

    # ── SAPI path (restore when USE_XTTS=False) ──────────────────────────────
    # preferred_voice = payload.get("voice_name")
    # rate   = payload.get("rate", 0.9)
    # volume = payload.get("volume", 0.85)
    #
    # with _sapi_lock:
    #     pythoncom.CoInitialize()
    #     tmp_path = None
    #     try:
    #         speaker = win32com.client.Dispatch("SAPI.SpVoice")
    #         stream  = win32com.client.Dispatch("SAPI.SpFileStream")
    #         available = speaker.GetVoices()
    #
    #         token = _pick_voice_token(available, preferred_voice)
    #         if token is not None:
    #             speaker.Voice = token
    #
    #         speaker.Rate   = _sapi_rate_from_float(rate)
    #         speaker.Volume = _sapi_volume_from_float(volume)
    #
    #         fd, tmp_path = tempfile.mkstemp(prefix="jarvis_bridge_", suffix=".wav")
    #         os.close(fd)
    #
    #         SSFM_CREATE_FOR_WRITE = 3
    #         stream.Open(tmp_path, SSFM_CREATE_FOR_WRITE, False)
    #         speaker.AudioOutputStream = stream
    #         speaker.Speak(text)
    #         stream.Close()
    #
    #         with open(tmp_path, "rb") as wav_file:
    #             audio_bytes = wav_file.read()
    #
    #         return send_file(
    #             BytesIO(audio_bytes),
    #             mimetype="audio/wav",
    #             as_attachment=False,
    #             download_name="jarvis_bridge.wav"
    #         )
    #     finally:
    #         if tmp_path and os.path.exists(tmp_path):
    #             try:
    #                 os.remove(tmp_path)
    #             except OSError:
    #                 pass
    #         pythoncom.CoUninitialize()
    # ─────────────────────────────────────────────────────────────────────────


if __name__ == "__main__":
    print("Starting Jarvis-main local voice bridge on http://127.0.0.1:8765")
    print(f"Engine: {'Coqui XTTS v2' if USE_XTTS else 'Windows SAPI (Microsoft voices)'}")
    app.run(host="127.0.0.1", port=8765, debug=False)
