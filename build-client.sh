#!/bin/bash

echo "========================================"
echo "  Generador de Instalador CLIENTE"
echo "  MariamPOS - Solo Frontend"
echo "========================================"
echo ""

# Verificar que el frontend esté compilado
if [ ! -f "mariam-pos-front/dist/index.html" ]; then
    echo "❌ Error: El frontend no está compilado."
    echo ""
    echo "Por favor, compila el frontend primero:"
    echo "  cd mariam-pos-front"
    echo "  npm run build"
    echo "  cd .."
    echo ""
    exit 1
fi

echo "✅ Frontend compilado encontrado"
echo ""

# Copiar package-client.json a package.json temporalmente
cp package.json package-server.json 2>/dev/null
cp package-client.json package.json 2>/dev/null
cp main.js main-server.js 2>/dev/null
cp main-client.js main.js 2>/dev/null

echo "📦 Generando instalador cliente..."
echo ""

# Generar el instalador
npm run dist

# Restaurar archivos originales
cp package-server.json package.json 2>/dev/null
cp main-server.js main.js 2>/dev/null
rm -f package-server.json main-server.js 2>/dev/null

echo ""
echo "✅ Instalador cliente generado en: dist_client/"
echo ""
echo "📝 IMPORTANTE: Antes de instalar en otra máquina:"
echo "   1. Edita public/config.json con la IP del servidor"
echo "   2. O ejecuta configurar-cliente.sh después de instalar"
echo ""

