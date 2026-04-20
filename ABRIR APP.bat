@echo off
echo Iniciando...

:: Mata processo anterior se existir
taskkill /f /im node.exe >nul 2>&1

:: Inicia servidor via PowerShell (sem janela visivel)
PowerShell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0iniciar-servidor.ps1"

:: Aguarda 8 segundos para o servidor subir
timeout /t 8 /nobreak > nul

:: Abre o navegador
start "" http://localhost:5173

exit
