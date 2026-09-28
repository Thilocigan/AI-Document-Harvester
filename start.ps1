# AI PDF Crawler & Synthesizer - PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  Launching AI PDF Crawler & Synthesizer Platform" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 0. Check for prerequisites / first-time setup
$venvPython = "$rootDir\backend\venv\Scripts\python.exe"
$nodeModules = "$rootDir\frontend\node_modules"

if (-not (Test-Path $venvPython) -or -not (Test-Path $nodeModules)) {
    Write-Host "[NOTICE] First-time setup detected. Running setup_new_computer.bat..." -ForegroundColor Yellow
    Start-Process -FilePath "$rootDir\setup_new_computer.bat" -Wait
}

# 1. Start Backend in separate window
Write-Host "[1/2] Starting Backend FastAPI server on http://127.0.0.1:8000 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\backend'; .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

Start-Sleep -Seconds 3

# 2. Start Frontend in separate window
Write-Host "[2/2] Starting Frontend Vite development server on http://localhost:5173 ..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$rootDir\frontend'; npm run dev"

Start-Sleep -Seconds 2

# 3. Open browser automatically
Write-Host "Opening web dashboard in default browser..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host "Application successfully launched!" -ForegroundColor Cyan
