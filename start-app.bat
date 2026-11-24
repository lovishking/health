@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found. Install Python 3.11+ and try again.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo Frontend dependencies are missing. Run "npm install" in the frontend folder first.
  pause
  exit /b 1
)

start "RT-HDSS Backend" cmd /k "cd /d ""%~dp0"" && python -m uvicorn app.main:app --app-dir backend --reload --port 8000"
start "RT-HDSS Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"
start "RT-HDSS Live Data" cmd /k "cd /d ""%~dp0"" ^&^& timeout /t 5 /nobreak ^>nul ^&^& python -m simulator.replay_engine --patient DEMO-001 --source synthetic --scenario stable --speed 1"

echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo Synthetic live stream: DEMO-001 (1 reading/second)
endlocal
