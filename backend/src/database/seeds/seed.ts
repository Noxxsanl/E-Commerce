import * as mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { seedUsers } from './users.seed';
import { seedCategories } from './categories.seed';
import { seedProducts } from './products.seed';
import { seedBanners } from './banners.seed';
import { seedCoupons } from './coupons.seed';

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in .env');
  }

  console.log('[Seed] Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('[Seed] Connected to MongoDB');

  const connection = mongoose.connection;

  try {
    console.log('\n[Seed] === Seeding Users ===');
    await seedUsers(connection);

    console.log('\n[Seed] === Seeding Categories ===');
    const categorySlugToId = await seedCategories(connection);

    console.log('\n[Seed] === Seeding Products ===');
    await seedProducts(connection, categorySlugToId);

    console.log('\n[Seed] === Seeding Banners ===');
    await seedBanners(connection);

    console.log('\n[Seed] === Seeding Coupons ===');
    await seedCoupons(connection);

    console.log('\n[Seed] ✅ All seed data inserted successfully!');
  } catch (err) {
    console.error('[Seed] ❌ Error during seeding:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('[Seed] Disconnected from MongoDB');
  }
}

main().catch((err) => {
  console.error('[Seed] Fatal error:', err);
  process.exit(1);
});
