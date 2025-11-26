@echo off
chcp 65001 >nul
echo ========================================
echo   Generador de Instalador CLIENTE
echo   MariamPOS - Solo Frontend
echo ========================================
echo.

REM Verificar que el frontend esté compilado
if not exist "mariam-pos-front\dist\index.html" (
    echo ❌ Error: El frontend no está compilado.
    echo.
    echo Por favor, compila el frontend primero:
    echo   cd mariam-pos-front
    echo   npm run build
    echo   cd ..
    echo.
    pause
    exit /b 1
)

echo ✅ Frontend compilado encontrado
echo.

REM Copiar package-client.json a package.json temporalmente
copy package.json package-server.json >nul 2>&1
copy package-client.json package.json >nul 2>&1
copy main.js main-server.js >nul 2>&1
copy main-client.js main.js >nul 2>&1

echo 📦 Generando instalador cliente...
echo.

REM Generar el instalador
call npm run dist

REM Restaurar archivos originales
copy package-server.json package.json >nul 2>&1
copy main-server.js main.js >nul 2>&1
del package-server.json >nul 2>&1
del main-server.js >nul 2>&1

echo.
echo ✅ Instalador cliente generado en: dist_client\
echo.
echo 📝 IMPORTANTE: Antes de instalar en otra máquina:
echo    1. Edita public\config.json con la IP del servidor
echo    2. O ejecuta configurar-cliente.bat después de instalar
echo.
pause

