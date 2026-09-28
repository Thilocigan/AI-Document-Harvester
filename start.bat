@echo off
echo ========================================================
echo   Starting AI PDF Crawler ^& Synthesizer System
echo ========================================================
echo.

if not exist "backend\venv\Scripts\python.exe" (
    echo [NOTICE] Backend virtual environment not found. Running first-time setup...
    call setup_new_computer.bat
    exit /b 0
)

if not exist "frontend\node_modules" (
    echo [NOTICE] Frontend packages not found. Running first-time setup...
    call setup_new_computer.bat
    exit /b 0
)

start "AI PDF Backend (FastAPI)" cmd /k "cd backend && venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

start "AI PDF Frontend (Vite/React)" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo   Application launched!
echo   Frontend: http://localhost:5173
echo   Backend API: http://127.0.0.1:8000
echo   API Docs: http://127.0.0.1:8000/docs
echo ========================================================
