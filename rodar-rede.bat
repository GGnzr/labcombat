@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LabCombat - Dev Server (rede local)

where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo  [ERRO] Node.js nao encontrado! Instale em https://nodejs.org/
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo Instalando dependencias (somente na primeira vez)...
    npm install
)

rem --host 0.0.0.0 libera acesso de outros computadores/celulares na rede.
rem O Vite mostra o endereco "Network: http://<seu-ip>:5173" na tela.
rem Na 1a vez o Firewall do Windows vai pedir permissao - clique em "Permitir".
npm run dev -- --host
pause
