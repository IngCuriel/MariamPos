#!/bin/bash

echo "========================================"
echo "  Configuración de Servidor MariamPOS"
echo "========================================"
echo ""
echo "Este script configurará el servidor con la sucursal y caja."
echo ""

read -p "Nombre de sucursal: " SUCURSAL
read -p "Número de caja (ej: Caja 1): " CAJA

echo ""
echo "Creando config.json..."

# Obtener la ruta del script (donde está ejecutándose)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detectar si estamos en dist/ o public/
CONFIG_PATH=""
if [ -f "${SCRIPT_DIR}/index.html" ]; then
    # Estamos en dist/ (producción instalada)
    CONFIG_PATH="${SCRIPT_DIR}/config.json"
    echo "📍 Detectado: Modo PRODUCCIÓN (carpeta dist)"
elif [ -f "${SCRIPT_DIR}/../dist/index.html" ]; then
    # Estamos en public/, crear en dist también
    CONFIG_PATH="${SCRIPT_DIR}/../dist/config.json"
    echo "📍 Detectado: Modo DESARROLLO (carpeta public)"
    # También crear en public para desarrollo
    cat > "${SCRIPT_DIR}/config.json" << EOF
{
  "mode": "server",
  "apiUrl": "http://127.0.0.1:3001/api",
  "sucursal": "${SUCURSAL}",
  "caja": "${CAJA}",
  "autoDetect": true
}
EOF
    echo "Archivo creado en: public/config.json"
else
    # Asumir que estamos en dist/ (fallback)
    CONFIG_PATH="${SCRIPT_DIR}/config.json"
    echo "📍 Detectado: Modo PRODUCCIÓN (asumido)"
fi

# Crear el archivo config.json en la ubicación detectada
cat > "${CONFIG_PATH}" << EOF
{
  "mode": "server",
  "apiUrl": "http://127.0.0.1:3001/api",
  "sucursal": "${SUCURSAL}",
  "caja": "${CAJA}",
  "autoDetect": true
}
EOF

echo "Archivo creado en: ${CONFIG_PATH}"
echo ""
echo "✅ Configuración completada!"
echo ""
echo "Configuración:"
echo "  - Modo: Servidor"
echo "  - API URL: http://127.0.0.1:3001/api"
echo "  - Sucursal: ${SUCURSAL}"
echo "  - Caja: ${CAJA}"
echo ""
echo "⚠️  IMPORTANTE: Reinicia la aplicación para que cargue la nueva configuración."
echo ""


















