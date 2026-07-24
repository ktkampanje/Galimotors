require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🚗 --- Initializing GaliMotors Clean Database --- 🚗');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.lead.deleteMany({});
  await prisma.recentlyViewed.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.image.deleteMany({});
  await prisma.carFeature.deleteMany({});
  await prisma.car.deleteMany({});
  await prisma.model.deleteMany({});
  await prisma.maker.deleteMany({});
  await prisma.bodyType.deleteMany({});
  await prisma.feature.deleteMany({});
  await prisma.seller.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.globalSettings.deleteMany({});
  await prisma.activityLog.deleteMany({});

  // 1. Admin user — created ONLY from environment variables.
  // This used to hardcode admin@galimotors.com / admin123, which shipped a
  // publicly-known SUPER_ADMIN login into every database the seed touched.
  const bcrypt = require('bcryptjs');
  const seedEmail = process.env.SEED_ADMIN_EMAIL;
  const seedPassword = process.env.SEED_ADMIN_PASSWORD;

  if (seedEmail && seedPassword) {
    console.log('👤 Creating admin user from SEED_ADMIN_* env vars...');
    await prisma.user.create({
      data: {
        email: String(seedEmail).toLowerCase().trim(),
        password: await bcrypt.hash(seedPassword, 12),
        name: process.env.SEED_ADMIN_NAME || 'Administrator',
        role: 'SUPER_ADMIN',
      },
    });
  } else {
    console.log('👤 No SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD set — skipping admin creation.');
    console.log('   Create one with:  npm run admin -- create <email> "<Name>" SUPER_ADMIN "<password>"');
  }

  // 2. Create Global Settings
  console.log('⚙️ Creating global settings...');
  await prisma.globalSettings.create({
    data: {
      id: 'SETTINGS_SINGLETON',
      driverAllowance: 15000,
      accommodationFee: 25000,
    },
  });

  // 3. Create Makers
  console.log('🏭 Creating makers...');
  await prisma.maker.create({ data: { name: 'Toyota', logoUrl: 'https://cdn.worldvectorlogo.com/logos/toyota-1.svg' } });
  await prisma.maker.create({ data: { name: 'Nissan', logoUrl: 'https://cdn.worldvectorlogo.com/logos/nissan-6.svg' } });
  await prisma.maker.create({ data: { name: 'Honda', logoUrl: 'https://cdn.worldvectorlogo.com/logos/honda-2.svg' } });
  await prisma.maker.create({ data: { name: 'Mazda', logoUrl: 'https://cdn.worldvectorlogo.com/logos/mazda-2.svg' } });
  await prisma.maker.create({ data: { name: 'Ford', logoUrl: 'https://cdn.worldvectorlogo.com/logos/ford-6.svg' } });
  await prisma.maker.create({ data: { name: 'BMW', logoUrl: 'https://cdn.worldvectorlogo.com/logos/bmw-2.svg' } });
  await prisma.maker.create({ data: { name: 'Mercedes-Benz', logoUrl: 'https://cdn.worldvectorlogo.com/logos/mercedes-benz-9.svg' } });
  await prisma.maker.create({ data: { name: 'Volkswagen', logoUrl: 'https://cdn.worldvectorlogo.com/logos/volkswagen-logo.svg' } });
  await prisma.maker.create({ data: { name: 'Mitsubishi', logoUrl: 'https://cdn.worldvectorlogo.com/logos/mitsubishi-motors.svg' } });
  await prisma.maker.create({ data: { name: 'Land Rover', logoUrl: 'https://cdn.worldvectorlogo.com/logos/land-rover-2.svg' } });
  await prisma.maker.create({ data: { name: 'Suzuki', logoUrl: 'https://cdn.worldvectorlogo.com/logos/suzuki-logo.svg' } });

  // 4. Create Models
  console.log('🚙 Creating models...');
  const makers = await prisma.maker.findMany();
  const toyota = makers.find(m => m.name === 'Toyota');
  const nissan = makers.find(m => m.name === 'Nissan');
  const honda = makers.find(m => m.name === 'Honda');
  const mazda = makers.find(m => m.name === 'Mazda');
  const ford = makers.find(m => m.name === 'Ford');
  const bmw = makers.find(m => m.name === 'BMW');
  const mercedes = makers.find(m => m.name === 'Mercedes-Benz');
  const vw = makers.find(m => m.name === 'Volkswagen');
  const mitsubishi = makers.find(m => m.name === 'Mitsubishi');
  const landrover = makers.find(m => m.name === 'Land Rover');
  const suzuki = makers.find(m => m.name === 'Suzuki');

  await prisma.model.create({ data: { name: 'Hilux', makerId: toyota.id } });
  await prisma.model.create({ data: { name: 'Land Cruiser', makerId: toyota.id } });
  await prisma.model.create({ data: { name: 'Corolla', makerId: toyota.id } });
  await prisma.model.create({ data: { name: 'RAV4', makerId: toyota.id } });
  await prisma.model.create({ data: { name: 'X-Trail', makerId: nissan.id } });
  await prisma.model.create({ data: { name: 'Patrol', makerId: nissan.id } });
  await prisma.model.create({ data: { name: 'Civic', makerId: honda.id } });
  await prisma.model.create({ data: { name: 'Fit', makerId: honda.id } });
  await prisma.model.create({ data: { name: 'CX-5', makerId: mazda.id } });
  await prisma.model.create({ data: { name: 'Demio', makerId: mazda.id } });
  await prisma.model.create({ data: { name: 'Ranger', makerId: ford.id } });
  await prisma.model.create({ data: { name: 'X5', makerId: bmw.id } });
  await prisma.model.create({ data: { name: 'C-Class', makerId: mercedes.id } });
  await prisma.model.create({ data: { name: 'GLE', makerId: mercedes.id } });
  await prisma.model.create({ data: { name: 'Golf', makerId: vw.id } });
  await prisma.model.create({ data: { name: 'Tiguan', makerId: vw.id } });
  await prisma.model.create({ data: { name: 'Pajero', makerId: mitsubishi.id } });
  await prisma.model.create({ data: { name: 'L200', makerId: mitsubishi.id } });
  await prisma.model.create({ data: { name: 'Defender', makerId: landrover.id } });
  await prisma.model.create({ data: { name: 'Jimny', makerId: suzuki.id } });

  // 5. Create Body Types
  console.log('🏗️ Creating body types...');
  await prisma.bodyType.create({ data: { name: 'SUV' } });
  await prisma.bodyType.create({ data: { name: 'Pickup Truck' } });
  await prisma.bodyType.create({ data: { name: 'Sedan' } });
  await prisma.bodyType.create({ data: { name: 'Hatchback' } });

  // 6. Create Features
  console.log('✨ Creating features...');
  await prisma.feature.create({ data: { name: 'Air Conditioning' } });
  await prisma.feature.create({ data: { name: 'Leather Seats' } });
  await prisma.feature.create({ data: { name: 'Sunroof' } });
  await prisma.feature.create({ data: { name: 'Bluetooth' } });
  await prisma.feature.create({ data: { name: 'Reverse Camera' } });
  await prisma.feature.create({ data: { name: 'Alloy Wheels' } });

  // 7. Create Default Seller
  console.log('🏢 Creating default seller...');
  await prisma.seller.create({
    data: {
      name: 'GaliMotors Official',
      phone: '0990000000',
      email: 'sales@galimotors.com',
      sellerType: 'DEALER',
      location: 'Lilongwe',
      verifiedByPlatform: true,
      sellerStatus: 'APPROVED',
    },
  });

  console.log('✅ --- Clean Database Setup Complete --- ✅');
  console.log('� Database is ready for production data.');
  console.log('👤 Admin accounts: manage with `npm run admin -- list`');
  console.log('🏭 Makers: 11 | Models: 20 | Body Types: 4 | Features: 6');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
