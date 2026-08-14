@echo off
cd /d "%~dp0"

echo ============================================================
echo  N.O.V.A  Local Voice Bridge
echo ============================================================
echo.
echo  [*] Engine: Windows SAPI ^(Microsoft voices^)
echo  [*] Starting bridge on http://127.0.0.1:8765 ^(Ctrl+C to stop^)
echo.
python voice_bridge.py
