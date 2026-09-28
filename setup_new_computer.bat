@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo   AI PDF Crawler & Synthesizer - New Computer Setup
echo ========================================================
echo.

:: 1. Check Python
echo [1/4] Checking Python installation...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python was not found in your PATH.
    echo Please install Python 3.10 or higher from: https://www.python.org/downloads/
    echo IMPORTANT: Make sure to check the box "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo [OK] Found %%i

:: 2. Check Node.js
echo [2/4] Checking Node.js installation...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js was not found in your PATH.
    echo Please install Node.js (LTS version) from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo [OK] Found Node.js %%i
npm --version >nul 2>&1
for /f "tokens=*" %%i in ('npm --version') do echo [OK] Found npm %%i

:: 3. Setup Backend Virtual Environment & Dependencies
echo.
echo [3/4] Setting up Backend Python Virtual Environment...
cd backend
if not exist "venv" (
    echo Creating virtual environment at backend\venv...
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

echo Upgrading pip and installing required Python packages...
venv\Scripts\python.exe -m pip install --upgrade pip
venv\Scripts\pip.exe install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install backend dependencies.
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed successfully.
cd ..

:: 4. Setup Frontend Dependencies
echo.
echo [4/4] Setting up Frontend Node.js Dependencies...
cd frontend
if not exist "node_modules" (
    echo Installing frontend packages with npm install...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install frontend npm packages.
        pause
        exit /b 1
    )
) else (
    echo [OK] frontend\node_modules already exists. Running quick audit...
    call npm install
)
echo [OK] Frontend dependencies installed successfully.
cd ..

echo.
echo ========================================================
echo   SETUP COMPLETED SUCCESSFULLY!
echo ========================================================
echo.
echo You can now launch the application at any time by running:
echo   .\start.bat   OR   .\start.ps1
echo.
set /p LAUNCH="Would you like to launch the application now? (y/n): "
if /i "%LAUNCH%"=="y" (
    start.bat
)
