/**
 * Debug del sync de presentaciones.
 * Imprime el payload EXACTO que mandaría el sync al bulk de la API,
 * incluyendo las presentaciones — con y sin el filtro de syncStatus.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const main = async () => {
  const pendingCount = await prisma.product.count({ where: { syncStatus: 'pendiente' } });
  console.log(`\n=== PRODUCTOS PENDIENTES DE SYNC: ${pendingCount} ===`);

  if (pendingCount === 0) {
    console.log('⚠️  No hay productos pendientes. Marcá uno con: node mark-pending.mjs');
    return;
  }

  // Traer igual que el sync real: SIN filtro en presentations (el fix)
  const pending = await prisma.product.findMany({
    where: { syncStatus: 'pendiente' },
    include: {
      presentations: true,           // SIN filtro — así queda tras el fix
      priceTiers: true,
      unit: true,
      category: { select: { id: true, name: true } },
    },
    take: 3,
    orderBy: { createdAt: 'desc' },
  });

  for (const p of pending) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Producto : "${p.name}"`);
    console.log(`code     : ${p.code}    id: ${p.id}    syncStatus: ${p.syncStatus}`);

    // --- Presentaciones SIN filtro (el fix) ---
    console.log(`\n[SIN filtro — DESPUÉS del fix] ${p.presentations.length} presentaciones:`);
    for (const pr of p.presentations) {
      console.log(`  id=${pr.id} | "${pr.name}" | qty=${pr.quantity} | price=${pr.unitPrice} | syncStatus=${pr.syncStatus}`);
    }

    // --- Presentaciones CON filtro (cómo era ANTES) ---
    const conFiltro = p.presentations.filter(pr => pr.syncStatus === 'pendiente');
    console.log(`\n[CON filtro syncStatus='pendiente' — ANTES del fix] ${conFiltro.length} presentaciones:`);
    for (const pr of conFiltro) {
      console.log(`  id=${pr.id} | "${pr.name}" | qty=${pr.quantity} | price=${pr.unitPrice}`);
    }
    if (conFiltro.length === 0) console.log('  (vacío → la API borraría las presentaciones existentes)');

    // --- Payload exacto que iría al bulk ---
    const payloadPresentations = p.presentations.map(pr => ({
      id: pr.id,
      name: pr.name,
      quantity: pr.quantity,
      unitPrice: pr.unitPrice,
      isDefault: pr.isDefault,
      branch: pr.branch || p.branch || 'Sucursal Default',
    }));
    console.log(`\n[PAYLOAD presentations que se enviaría al /api/products/bulk]:`);
    console.log(JSON.stringify(payloadPresentations, null, 2));
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log('CONCLUSIÓN:');
  const alguno = pending.find(p => p.presentations.length > 0 && p.presentations.every(pr => pr.syncStatus === 'enviado'));
  if (alguno) {
    console.log('✅ Fix confirmado necesario: hay presentaciones con syncStatus=enviado que ANTES se perdían.');
  } else if (pending.every(p => p.presentations.length === 0)) {
    console.log('ℹ️  Los productos pendientes no tienen presentaciones — no aplica el fix para este caso.');
  } else {
    console.log('ℹ️  Los productos pendientes tienen todas las presentaciones en pendiente (primer sync).');
  }
};

main()
  .catch((e) => { console.error('ERROR:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
