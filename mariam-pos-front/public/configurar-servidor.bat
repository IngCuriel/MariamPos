@echo off
chcp 65001 >nul
echo ========================================
echo   Configuración de Servidor MariamPOS
echo ========================================
echo.
echo Este script configurará el servidor con la sucursal y caja.
echo.
set /p SUCURSAL="Nombre de sucursal: "
set /p CAJA="Número de caja (ej: Caja 1): "

echo.
echo Creando config.json...

REM Obtener la ruta del script (donde está ejecutándose)
set "SCRIPT_DIR=%~dp0"
set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Detectar si estamos en dist/ o public/
set "CONFIG_PATH="
if exist "%SCRIPT_DIR%\index.html" (
    REM Estamos en dist/ (producción instalada)
    set "CONFIG_PATH=%SCRIPT_DIR%\config.json"
    echo 📍 Detectado: Modo PRODUCCIÓN (carpeta dist)
) else if exist "%SCRIPT_DIR%\..\dist\index.html" (
    REM Estamos en public/, crear en dist también
    set "CONFIG_PATH=%SCRIPT_DIR%\..\dist\config.json"
    echo 📍 Detectado: Modo DESARROLLO (carpeta public)
    REM También crear en public para desarrollo
    (
    echo {
    echo   "mode": "server",
    echo   "apiUrl": "http://127.0.0.1:3001/api",
    echo   "sucursal": "%SUCURSAL%",
    echo   "caja": "%CAJA%",
    echo   "autoDetect": true
    echo }
    ) > "%SCRIPT_DIR%\config.json"
    echo Archivo creado en: public\config.json
) else (
    REM Asumir que estamos en dist/ (fallback)
    set "CONFIG_PATH=%SCRIPT_DIR%\config.json"
    echo 📍 Detectado: Modo PRODUCCIÓN (asumido)
)

REM Crear el archivo config.json en la ubicación detectada
(
echo {
echo   "mode": "server",
echo   "apiUrl": "http://127.0.0.1:3001/api",
echo   "sucursal": "%SUCURSAL%",
echo   "caja": "%CAJA%",
echo   "autoDetect": true
echo }
) > "%CONFIG_PATH%"

echo Archivo creado en: %CONFIG_PATH%
echo.
echo ✅ Configuración completada!
echo.
echo Configuración:
echo   - Modo: Servidor
echo   - API URL: http://127.0.0.1:3001/api
echo   - Sucursal: %SUCURSAL%
echo   - Caja: %CAJA%
echo.
echo ⚠️  IMPORTANTE: Reinicia la aplicación para que cargue la nueva configuración.
echo.
pause










