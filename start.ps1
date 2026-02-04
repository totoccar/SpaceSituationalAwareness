# SSA Dashboard - Start Script (PowerShell)
# Ejecutar: .\start.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SSA Dashboard - Iniciando servicios" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Iniciar Backend
Write-Host "[1/2] Iniciando Backend (FastAPI en puerto 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend'; python -m uvicorn main:app --reload --port 8000"

Start-Sleep -Seconds 2

# Iniciar Frontend
Write-Host "[2/2] Iniciando Frontend (Next.js en puerto 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\ssa-dashboard'; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Servicios iniciados!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "  Para detener, cierra las ventanas." -ForegroundColor Gray
Write-Host ""
