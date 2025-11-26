// build-client.js - Script Node.js para generar instalador cliente
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('========================================');
console.log('  Generador de Instalador CLIENTE');
console.log('  MariamPOS - Solo Frontend');
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

// Backup de archivos originales
const packageJson = 'package.json';
const mainJs = 'main.js';
const packageBackup = 'package-server.json';
const mainBackup = 'main-server.js';

try {
  // Hacer backup
  if (fs.existsSync(packageJson)) {
    fs.copyFileSync(packageJson, packageBackup);
  }
  if (fs.existsSync(mainJs)) {
    fs.copyFileSync(mainJs, mainBackup);
  }

  // Copiar archivos cliente
  fs.copyFileSync('package-client.json', packageJson);
  fs.copyFileSync('main-client.js', mainJs);

  console.log('📦 Generando instalador cliente...\n');

  // Ejecutar electron-builder
  execSync('npm run dist', { stdio: 'inherit' });

  // Restaurar archivos originales
  if (fs.existsSync(packageBackup)) {
    fs.copyFileSync(packageBackup, packageJson);
    fs.unlinkSync(packageBackup);
  }
  if (fs.existsSync(mainBackup)) {
    fs.copyFileSync(mainBackup, mainJs);
    fs.unlinkSync(mainBackup);
  }

  console.log('\n✅ Instalador cliente generado en: dist_client/');
  console.log('\n📝 IMPORTANTE: Antes de instalar en otra máquina:');
  console.log('   1. Edita public/config.json con la IP del servidor');
  console.log('   2. O ejecuta configurar-cliente.bat después de instalar\n');

} catch (error) {
  console.error('\n❌ Error al generar instalador:', error.message);
  
  // Restaurar archivos en caso de error
  if (fs.existsSync(packageBackup)) {
    fs.copyFileSync(packageBackup, packageJson);
    fs.unlinkSync(packageBackup);
  }
  if (fs.existsSync(mainBackup)) {
    fs.copyFileSync(mainBackup, mainJs);
    fs.unlinkSync(mainBackup);
  }
  
  process.exit(1);
}

