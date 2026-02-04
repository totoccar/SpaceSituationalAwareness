@echo off
echo ========================================
echo   SSA Dashboard - Iniciando servicios
echo ========================================
echo.

:: Ir al directorio raíz del proyecto
cd /d "%~dp0"

:: Iniciar Backend (FastAPI) en una nueva ventana
echo [1/2] Iniciando Backend (FastAPI en puerto 8000)...
start "SSA Backend" cmd /k "cd backend && python -m uvicorn main:app --reload --port 8000"

:: Esperar 2 segundos para que el backend arranque
timeout /t 2 /nobreak > nul

:: Iniciar Frontend (Next.js) en una nueva ventana
echo [2/2] Iniciando Frontend (Next.js en puerto 3000)...
start "SSA Frontend" cmd /k "cd ssa-dashboard && npm run dev"

echo.
echo ========================================
echo   Servicios iniciados!
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo   Frontend: http://localhost:3000
echo.
echo   Para detener, cierra las ventanas de comandos.
echo ========================================
pause
