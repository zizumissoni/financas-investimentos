@echo off
title Financas e Investimentos - Servidor
echo ========================================
echo   Iniciando Financas e Investimentos...
echo ========================================
echo.
echo Aguarde cerca de 10 segundos...
echo NAO feche esta janela enquanto usar o app!
echo.

SET PATH=C:\Program Files\nodejs\;%PATH%

cd /d "%~dp0"

start cmd /k "SET PATH=C:\Program Files\nodejs\;%%PATH%% && cd /d "%~dp0" && npm run dev"

timeout /t 8 /nobreak > nul

start "" http://localhost:5173

echo.
echo App aberto no navegador!
echo Esta janela pode ser fechada.
echo Mas NAO feche a outra janela preta (servidor).
echo.
pause
