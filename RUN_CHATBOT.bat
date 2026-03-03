@echo off
set ROOT_DIR=%~dp0
title AI Chatbot Launcher
echo ==========================================
echo       Starting your AI Chatbot...
echo ==========================================
echo.
echo PROJECT_ROOT: %ROOT_DIR%
echo.

:: Start Backend
echo Launching Backend (The Engine)...
start "Chatbot Backend" /D "%ROOT_DIR%" cmd /k ".\backend\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8080"

:: Wait a moment for backend to initialize
timeout /t 5 /nobreak > nul

:: Start Frontend
echo Launching Frontend (The Interface)...
:: Using full path to next binary to be safe
start "Chatbot Frontend" /D "%ROOT_DIR%\frontend" cmd /k ".\node_modules\.bin\next.cmd dev -p 3030"

echo.
echo ==========================================
echo SUCCESS! 
echo.
echo 1. Wait until you see "Ready" in the Frontend window.
echo 2. Open your browser and go to: http://localhost:3030
echo ==========================================
echo (You can close this launcher window now)
pause
