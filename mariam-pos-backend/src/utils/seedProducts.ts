import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const categoryId = 'c863df45-e186-4a53-9f26-2c7876b2d9c5';

  const frutasProducts = [
    {
      code: 'MAN001',
      name: 'Manzana Roja 1kg',
      price: 30.0,
      cost: 20.0,
      description: 'Manzanas rojas frescas, 1 kilogramo',
      icon: '🍎',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'MAN002',
      name: 'Manzana Verde 1kg',
      price: 28.0,
      cost: 18.0,
      description: 'Manzanas verdes frescas, 1 kilogramo',
      icon: '🍏',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'PLAT001',
      name: 'Plátano 1kg',
      price: 20.0,
      cost: 12.0,
      description: 'Plátanos frescos, 1 kilogramo',
      icon: '🍌',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'NAR001',
      name: 'Naranja 1kg',
      price: 25.0,
      cost: 15.0,
      description: 'Naranjas frescas, 1 kilogramo',
      icon: '🍊',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'PER001',
      name: 'Pera 1kg',
      price: 32.0,
      cost: 22.0,
      description: 'Peras frescas, 1 kilogramo',
      icon: '🍐',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'UVA001',
      name: 'Uvas 500g',
      price: 35.0,
      cost: 25.0,
      description: 'Uvas frescas, 500 gramos',
      icon: '🍇',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'MEL001',
      name: 'Melón 1kg',
      price: 18.0,
      cost: 12.0,
      description: 'Melón fresco, 1 kilogramo',
      icon: '🍈',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'SAND001',
      name: 'Sandía 1kg',
      price: 15.0,
      cost: 10.0,
      description: 'Sandía fresca, 1 kilogramo',
      icon: '🍉',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'KIWI001',
      name: 'Kiwi 500g',
      price: 28.0,
      cost: 18.0,
      description: 'Kiwis frescos, 500 gramos',
      icon: '🥝',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
    {
      code: 'CIT001',
      name: 'Limón 500g',
      price: 12.0,
      cost: 8.0,
      description: 'Limones frescos, 500 gramos',
      icon: '🍋',
      categoryId: '4d63b750-40bd-4604-9a0b-f379c0f436ea',
      createdAt: new Date(),
    },
  ];

  await prisma.product.createMany({ data: frutasProducts });
  console.log('✅ Productos insertados correctamente');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());

  // Ejecutar npx tsx src/utils/seedProducts.ts 