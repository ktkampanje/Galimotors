const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: 'Verified', emoji: '✓', color: '#FFFFFF', bgColor: '#1E7B4F', rankBoost: 10, sortOrder: 1, description: 'Verified by platform' },
    { name: 'Best Seller', emoji: '🏆', color: '#FFFFFF', bgColor: '#D9A404', rankBoost: 5, sortOrder: 2, description: 'Top performing vehicle' },
    { name: 'New Arrival', emoji: '🆕', color: '#13293D', bgColor: '#E8EEF4', rankBoost: 3, sortOrder: 3, description: 'Recently added' },
    { name: 'Limited Stock', emoji: '⚡', color: '#FFFFFF', bgColor: '#B42318', rankBoost: 7, sortOrder: 4, description: 'Only a few available' },
    { name: 'Urgent Sale', emoji: '🔥', color: '#FFFFFF', bgColor: '#B45309', rankBoost: 2, sortOrder: 5, description: 'Quick sale needed' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.name.toLowerCase().replace(/\s+/g, '-') },
      update: {},
      create: {
        ...cat,
        slug: cat.name.toLowerCase().replace(/\s+/g, '-'),
      },
    });
  }

  console.log('✅ Categories seeded!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
