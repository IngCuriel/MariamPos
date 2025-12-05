// build-server.js - Script Node.js para generar instalador servidor
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('========================================');
console.log('  Generador de Instalador SERVIDOR');
console.log('  MariamPOS - Frontend + Backend');
console.log('========================================\n');

// Verificar que el frontend esté compilado
const frontendDist = path.join('mariam-pos-front', 'dist', 'index.html');
if (!fs.existsSync(frontendDist)) {
  console.error('❌ Error: El frontend no está compilado.');
  console.error('\nPor favor, compila el frontend primero:');
  console.error('  cd mariam-pos-front');
  console.error('  npm run build');
  console.error('  cd ..\n');
  process.exit(1);
}

console.log('✅ Frontend compilado encontrado\n');

// Limpiar base de datos antes de generar el instalador
console.log('🧹 Limpiando base de datos para el instalador...\n');
try {
  const cleanScriptPath = path.join(__dirname, 'mariam-pos-backend', 'src', 'utils', 'cleanDatabaseForBuild.mjs');
  
  if (!fs.existsSync(cleanScriptPath)) {
    console.warn('⚠️  Script de limpieza no encontrado, continuando sin limpiar...\n');
  } else {
    // Verificar que Prisma Client esté generado
    const prismaClientPath = path.join(__dirname, 'mariam-pos-backend', 'node_modules', '.prisma', 'client');
    if (!fs.existsSync(prismaClientPath)) {
      console.log('📦 Generando Prisma Client...');
      execSync('npx prisma generate', { 
        stdio: 'inherit',
        cwd: path.join(__dirname, 'mariam-pos-backend')
      });
    }

    // Ejecutar el script de limpieza
    const nodePath = process.execPath;
    execSync(`"${nodePath}" "${cleanScriptPath}"`, { 
      stdio: 'inherit',
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'production' }
    });
    console.log('');
  }
} catch (error) {
  console.error('❌ Error al limpiar la base de datos:', error.message);
  console.error('⚠️  Continuando con la generación del instalador...\n');
}

// Copiar scripts de configuración a dist/ para que estén disponibles después de la instalación
const configScripts = [
  { from: 'mariam-pos-front/public/configurar-cliente.bat', to: 'mariam-pos-front/dist/configurar-cliente.bat' },
  { from: 'mariam-pos-front/public/configurar-cliente.sh', to: 'mariam-pos-front/dist/configurar-cliente.sh' },
  { from: 'mariam-pos-front/public/configurar-servidor.bat', to: 'mariam-pos-front/dist/configurar-servidor.bat' },
  { from: 'mariam-pos-front/public/configurar-servidor.sh', to: 'mariam-pos-front/dist/configurar-servidor.sh' }
];

console.log('📋 Copiando scripts de configuración a dist/...');
configScripts.forEach(({ from, to }) => {
  if (fs.existsSync(from)) {
    const toDir = path.dirname(to);
    if (!fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }
    fs.copyFileSync(from, to);
    console.log(`   ✅ ${path.basename(from)} → ${to}`);
  }
});
console.log('');

console.log('📦 Generando instalador servidor...\n');

try {
  // Ejecutar electron-builder
  execSync('npm run dist', { stdio: 'inherit' });

  console.log('\n✅ Instalador servidor generado en: dist_electron/');
  console.log('\n📝 IMPORTANTE: Después de instalar:');
  console.log('   1. Ejecuta configurar-servidor.bat para configurar sucursal y caja');
  console.log('   2. O edita manualmente el config.json en la carpeta de instalación\n');

} catch (error) {
  console.error('\n❌ Error al generar instalador:', error.message);
  process.exit(1);
}







