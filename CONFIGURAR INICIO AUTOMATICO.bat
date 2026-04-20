@echo off
title Configurando inicio automatico...
echo ========================================
echo   Configurando inicio automatico...
echo ========================================
echo.

SET PATH=C:\Program Files\nodejs\;%PATH%

cd /d "%~dp0"

echo Parando instancias anteriores...
pm2 delete financas-investimentos 2>nul

echo Iniciando app com PM2...
pm2 start ecosystem.config.cjs

echo Configurando inicio com o Windows...
pm2-startup install
pm2 save

echo.
echo ========================================
echo   PRONTO! Configuracao concluida!
echo   O app vai iniciar automaticamente
echo   toda vez que o Windows ligar.
echo.
echo   Acesse: http://localhost:5173
echo ========================================
echo.
pause
