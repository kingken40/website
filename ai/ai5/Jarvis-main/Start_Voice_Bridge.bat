@echo off
cd /d "%~dp0"

echo ============================================================
echo  N.O.V.A  Local Voice Bridge
echo ============================================================
echo.

REM ── Check for speaker_sample.wav ─────────────────────────────
if not exist "speaker_sample.wav" (
    echo  [!] speaker_sample.wav not found.
    echo      Record or place a 6-30 second WAV of the voice you
    echo      want to clone as:
    echo        %~dp0speaker_sample.wav
    echo.
    echo      To use Windows SAPI voices instead, open voice_bridge.py
    echo      and set:  USE_XTTS = False
    echo.
    pause
    exit /b 1
)

REM ── Install Coqui TTS if not already present ─────────────────
python -c "import TTS" 2>nul
if errorlevel 1 (
    echo  [*] Installing Coqui TTS (one-time, may take a few minutes)...
    pip install TTS torch torchaudio --quiet
    if errorlevel 1 (
        echo  [!] Install failed. Check your Python/pip setup.
        pause
        exit /b 1
    )
    echo  [+] Coqui TTS installed.
    echo.
)

echo  [*] Starting bridge on http://127.0.0.1:8765  (Ctrl+C to stop)
echo.
python voice_bridge.py
