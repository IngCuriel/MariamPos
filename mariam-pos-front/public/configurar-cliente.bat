@echo off
chcp 65001 >nul
echo ========================================
echo   Configuración de Cliente MariamPOS
echo ========================================
echo.
echo Este script configurará el cliente para conectarse al servidor.
echo.
set /p SERVER_IP="Ingresa la IP del servidor (ej: 192.168.1.100): "
set /p CAJA="Número de caja (ej: Caja 1): "
set /p SUCURSAL="Nombre de sucursal: "

echo.
echo Creando config.json...
(
echo {
echo   "mode": "client",
echo   "apiUrl": "http://127.0.0.1:3001/api",
echo   "serverUrl": "http://%SERVER_IP%:3001/api",
echo   "sucursal": "%SUCURSAL%",
echo   "caja": "%CAJA%",
echo   "autoDetect": true
echo }
) > public\config.json

echo.
echo ✅ Configuración completada!
echo.
echo Archivo creado en: public\config.json
echo.
echo Configuración:
echo   - Modo: Cliente
echo   - Servidor: http://%SERVER_IP%:3001/api
echo   - Sucursal: %SUCURSAL%
echo   - Caja: %CAJA%
echo.
pause

