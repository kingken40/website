from __future__ import annotations

import os
import tempfile
import threading
from io import BytesIO
from flask import Flask, jsonify, request, send_file
import pythoncom
import win32com.client


app = Flask(__name__)
_sapi_lock = threading.Lock()


def _sapi_rate_from_float(rate: float) -> int:
    clamped = min(2.0, max(0.5, float(rate)))
    return int(round((clamped - 1.0) * 10))


def _sapi_volume_from_float(volume: float) -> int:
    clamped = min(1.0, max(0.0, float(volume)))
    return int(round(clamped * 100))


def _pick_voice_token(voice_collection, preferred_name: str | None):
    if not preferred_name:
        return None

    preferred_lower = preferred_name.strip().lower()
    if not preferred_lower:
        return None

    for idx in range(voice_collection.Count):
        token = voice_collection.Item(idx)
        description = token.GetDescription() or ""
        if preferred_lower in description.lower():
            return token

    return None


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "service": "jarvis-main-voice-bridge"})


@app.route("/voices", methods=["GET"])
def voices():
    with _sapi_lock:
        pythoncom.CoInitialize()
        try:
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            available = speaker.GetVoices()
            result = []
            for idx in range(available.Count):
                token = available.Item(idx)
                result.append(token.GetDescription())
            return jsonify({"voices": result})
        finally:
            pythoncom.CoUninitialize()


@app.route("/speak", methods=["POST", "OPTIONS"])
def speak():
    if request.method == "OPTIONS":
        return ("", 204)

    payload = request.get_json(silent=True) or {}
    text = (payload.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Missing text"}), 400

    preferred_voice = payload.get("voice_name")
    rate = payload.get("rate", 0.9)
    volume = payload.get("volume", 0.85)

    with _sapi_lock:
        pythoncom.CoInitialize()
        tmp_path = None
        try:
            speaker = win32com.client.Dispatch("SAPI.SpVoice")
            stream = win32com.client.Dispatch("SAPI.SpFileStream")
            available = speaker.GetVoices()

            token = _pick_voice_token(available, preferred_voice)
            if token is not None:
                speaker.Voice = token

            speaker.Rate = _sapi_rate_from_float(rate)
            speaker.Volume = _sapi_volume_from_float(volume)

            fd, tmp_path = tempfile.mkstemp(prefix="jarvis_bridge_", suffix=".wav")
            os.close(fd)

            SSFM_CREATE_FOR_WRITE = 3
            stream.Open(tmp_path, SSFM_CREATE_FOR_WRITE, False)
            speaker.AudioOutputStream = stream
            speaker.Speak(text)
            stream.Close()

            with open(tmp_path, "rb") as wav_file:
                audio_bytes = wav_file.read()

            return send_file(
                BytesIO(audio_bytes),
                mimetype="audio/wav",
                as_attachment=False,
                download_name="jarvis_bridge.wav"
            )
        finally:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.remove(tmp_path)
                except OSError:
                    pass
            pythoncom.CoUninitialize()


if __name__ == "__main__":
    print("Starting Jarvis-main local voice bridge on http://127.0.0.1:8765")
    app.run(host="127.0.0.1", port=8765, debug=False)
