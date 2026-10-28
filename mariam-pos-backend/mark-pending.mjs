import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Uso:
//   node mark-pending.mjs            -> re-encola SOLO el producto PAP-CUA-002 (prueba)
//   node mark-pending.mjs --all      -> re-encola TODOS los productos (re-sync completo)
//
// Marca Product.syncStatus = 'pendiente' para que el loop de sincronización
// vuelva a subir el/los producto(s) a la tienda online CON los campos nuevos
// (promo, pricingMode, priceTiers, unidad). Solo cambia el flag; no borra nada.

const ALL = process.argv.includes('--all');
const CODE = 'PAP-CUA-002';

const main = async () => {
  if (ALL) {
    const res = await prisma.product.updateMany({
      data: { syncStatus: 'pendiente' },
    });
    console.log(`✅ ${res.count} producto(s) marcados como 'pendiente' (re-sync completo).`);
  } else {
    const res = await prisma.product.updateMany({
      where: { code: CODE },
      data: { syncStatus: 'pendiente' },
    });
    console.log(`✅ ${res.count} producto(s) con code ${CODE} marcado(s) como 'pendiente'.`);
    console.log('   (Para re-encolar TODO el catálogo: node mark-pending.mjs --all)');
  }
};

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
