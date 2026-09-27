@echo off
title Sistema de Proveidos y Elevaciones - UNHEVAL EPG
chcp 65001 > nul
cls
echo =====================================================================
echo   UNIVERSIDAD NACIONAL HERMILIO VALDIZAN - ESCUELA DE POSGRADO
echo   SISTEMA DE GESTION DE PROVEIDOS Y ELEVACIONES
echo =====================================================================
echo.
echo Iniciando servidor local...
echo.

:: Verificar si python esta instalado
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] No se encontro Python en el sistema.
    echo Por favor instale Python 3.10 o superior para ejecutar el sistema.
    pause
    exit /b
)

:: Abrir navegador despues de 2 segundos
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000"

:: Ejecutar aplicacion Flask
python app.py

pause
