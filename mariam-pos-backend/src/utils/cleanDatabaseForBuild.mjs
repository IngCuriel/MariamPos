// cleanDatabaseForBuild.mjs
// Script para limpiar la base de datos antes de generar el ejecutable servidor
// Preserva: Product, ProductPresentation, Category (con todos sus datos)
// Preserva: Client solo con "Público en General"

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta a la base de datos en el proyecto
const dbPath = path.join(__dirname, '../../prisma/database.db');

// Configurar DATABASE_URL si no está definida
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${dbPath}`;
}

const prisma = new PrismaClient();

async function cleanDatabase() {
  try {
    console.log('🧹 Iniciando limpieza de base de datos...\n');

    // 1. Preservar datos de Product, ProductPresentation y Category
    console.log('📦 Preservando Product, ProductPresentation y Category...');
    
    // Obtener todos los productos con sus relaciones
    const products = await prisma.product.findMany({
      include: {
        presentations: true,
        category: true,
      },
    });

    const categories = await prisma.category.findMany();
    
    console.log(`   ✅ ${products.length} productos preservados`);
    console.log(`   ✅ ${categories.length} categorías preservadas`);

    // 2. Preservar o crear "Público en General"
    console.log('\n👤 Preservando/creando cliente "Público en General"...');
    
    // Buscar cliente "Público en General" (SQLite no soporta case-insensitive directamente)
    let publicClient = await prisma.client.findFirst({
      where: {
        OR: [
          { name: 'Público en General' },
          { name: 'Publico en General' },
          { name: 'PÚBLICO EN GENERAL' },
          { name: 'PUBLICO EN GENERAL' },
        ],
      },
    });

    const publicClientId = publicClient?.id;

    // 3. Eliminar todas las tablas excepto las que queremos preservar
    console.log('\n🗑️  Eliminando datos no deseados...');

    // Eliminar en orden para respetar las foreign keys
    await prisma.creditPayment.deleteMany({});
    console.log('   ✅ CreditPayment eliminado');

    await prisma.clientCredit.deleteMany({});
    console.log('   ✅ ClientCredit eliminado');

    await prisma.clientContainerDeposit.deleteMany({});
    console.log('   ✅ ClientContainerDeposit eliminado');

    await prisma.cashMovement.deleteMany({});
    console.log('   ✅ CashMovement eliminado');

    await prisma.cashRegisterShift.deleteMany({});
    console.log('   ✅ CashRegisterShift eliminado');

    await prisma.pendingSaleDetail.deleteMany({});
    console.log('   ✅ PendingSaleDetail eliminado');

    await prisma.pendingSale.deleteMany({});
    console.log('   ✅ PendingSale eliminado');

    await prisma.saleDetail.deleteMany({});
    console.log('   ✅ SaleDetail eliminado');

    await prisma.sale.deleteMany({});
    console.log('   ✅ Sale eliminado');

    await prisma.accountPayable.deleteMany({});
    console.log('   ✅ AccountPayable eliminado');

    await prisma.purchaseDetail.deleteMany({});
    console.log('   ✅ PurchaseDetail eliminado');

    await prisma.purchase.deleteMany({});
    console.log('   ✅ Purchase eliminado');

    await prisma.supplier.deleteMany({});
    console.log('   ✅ Supplier eliminado');

    await prisma.inventoryMovement.deleteMany({});
    console.log('   ✅ InventoryMovement eliminado');

    await prisma.inventory.deleteMany({});
    console.log('   ✅ Inventory eliminado');

    await prisma.container.deleteMany({});
    console.log('   ✅ Container eliminado');

    await prisma.kitItem.deleteMany({});
    console.log('   ✅ KitItem eliminado');

    await prisma.printer.deleteMany({});
    console.log('   ✅ Printer eliminado');

    await prisma.user.deleteMany({});
    console.log('   ✅ User eliminado');

    // Eliminar todos los clientes excepto "Público en General"
    if (publicClientId) {
      await prisma.client.deleteMany({
        where: {
          id: {
            not: publicClientId,
          },
        },
      });
      console.log('   ✅ Clientes eliminados (excepto "Público en General")');
    } else {
      // Si no existe, eliminar todos y crear uno nuevo
      await prisma.client.deleteMany({});
      console.log('   ✅ Todos los clientes eliminados');
      
      publicClient = await prisma.client.create({
        data: {
          name: 'Público en General',
          allowCredit: false,
          creditLimit: 0,
        },
      });
      console.log('   ✅ Cliente "Público en General" creado');
    }

    console.log('\n✅ Limpieza de base de datos completada exitosamente!');
    console.log(`\n📊 Resumen:`);
    console.log(`   - Productos: ${products.length}`);
    console.log(`   - Categorías: ${categories.length}`);
    console.log(`   - Cliente: "Público en General"`);

  } catch (error) {
    console.error('❌ Error al limpiar la base de datos:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si se llama directamente desde la línea de comandos
// Verificar si el archivo actual es el que se está ejecutando
const isDirectExecution = process.argv[1] && (
  process.argv[1].includes('cleanDatabaseForBuild.mjs') ||
  process.argv[1].endsWith('cleanDatabaseForBuild.mjs')
);

if (isDirectExecution) {
  cleanDatabase()
    .then(() => {
      console.log('\n✅ Proceso completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export default cleanDatabase;

