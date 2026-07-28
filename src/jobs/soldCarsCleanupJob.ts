import cron from 'node-cron';
import prisma from '../lib/prisma';
import { deleteCloudinaryImages } from '../services/cloudinaryService';
import { invalidateFilterStatsCache } from '../services/filterStatsCacheService';

/**
 * SOLD-car lifecycle — conserves the free Cloudinary tier, which is the
 * system's only image store:
 *
 * 1. soldAt + 2 days  -> archive (status HIDDEN, off the public site)
 * 2. soldAt + 7 days  -> delete every NON-PRIMARY photo (Cloudinary + DB).
 *    A week's grace covers sales that fall through and get relisted.
 * 3. soldAt + 30 days -> soft delete the car (deletedAt).
 *
 * The PRIMARY photo is kept forever (~300KB per sold car): the admin's sold
 * history and customers' old quotes/viewings keep a real thumbnail instead
 * of a placeholder.
 */
export const runSoldCarsCleanup = async () => {
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ── Step 1: archive SOLD cars after 2 days ─────────────────────────
  const carsToArchive = await prisma.car.findMany({
    where: {
      status: 'SOLD',
      soldAt: { lte: twoDaysAgo },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (carsToArchive.length > 0) {
    await prisma.car.updateMany({
      where: { id: { in: carsToArchive.map(c => c.id) } },
      data: { status: 'HIDDEN' },
    });
    console.log(`   ✅ Archived ${carsToArchive.length} SOLD cars (2+ days old)`);
    invalidateFilterStatsCache();
  } else {
    console.log('   ℹ️  No SOLD cars to archive');
  }

  // ── Step 2: purge non-primary photos 7 days after the sale ─────────
  // Matches both SOLD and already-archived (HIDDEN) cars, so the purge
  // works regardless of which stage the car is in.
  const carsToPurge = await prisma.car.findMany({
    where: {
      status: { in: ['SOLD', 'HIDDEN'] },
      soldAt: { lte: sevenDaysAgo },
      deletedAt: null,
    },
    include: { images: true },
  });

  let purgedCars = 0;
  let purgedImages = 0;
  for (const car of carsToPurge) {
    if (car.images.length <= 1) continue;

    // Keep the flagged primary; if none is flagged, keep the first.
    const keeper = car.images.find(img => img.isPrimary) || car.images[0];
    const extras = car.images.filter(img => img.id !== keeper.id);
    if (extras.length === 0) continue;

    await prisma.image.deleteMany({
      where: { id: { in: extras.map(img => img.id) } },
    });
    deleteCloudinaryImages(extras.map(img => img.url)).catch(error => {
      console.error(`   ❌ Cloudinary purge failed for car ${car.id}:`, error);
    });

    purgedCars++;
    purgedImages += extras.length;
  }
  if (purgedCars > 0) {
    console.log(`   ✅ Purged ${purgedImages} extra photos from ${purgedCars} sold cars (primary kept)`);
  } else {
    console.log('   ℹ️  No sold-car photos to purge');
  }

  // ── Step 3: soft delete archived cars after 30 days ────────────────
  // The primary photo is deliberately NOT deleted here — it stays forever
  // so history views keep a real thumbnail.
  const carsToDelete = await prisma.car.findMany({
    where: {
      status: 'HIDDEN',
      soldAt: { lte: thirtyDaysAgo },
      deletedAt: null,
    },
    include: { images: true },
  });

  if (carsToDelete.length > 0) {
    await prisma.car.updateMany({
      where: { id: { in: carsToDelete.map(c => c.id) } },
      data: { deletedAt: now },
    });
    console.log(`   ✅ Soft deleted ${carsToDelete.length} archived cars (30+ days old)`);

    // Safety net: remove any non-primary stragglers step 2 missed.
    for (const car of carsToDelete) {
      const keeper = car.images.find(img => img.isPrimary) || car.images[0];
      const extras = car.images.filter(img => keeper && img.id !== keeper.id);
      if (extras.length === 0) continue;
      await prisma.image.deleteMany({ where: { id: { in: extras.map(i => i.id) } } });
      deleteCloudinaryImages(extras.map(img => img.url)).catch(error => {
        console.error(`   ❌ Failed to delete images for car ${car.id}:`, error);
      });
    }

    invalidateFilterStatsCache();
  } else {
    console.log('   ℹ️  No archived cars to delete');
  }
};

/**
 * Empty the trash — the ONLY place a car row is permanently destroyed.
 * Runs from the daily cron; cars sit in the Trash (deletedAt set) for
 * TRASH_RETENTION_DAYS first, restorable by any admin the whole time.
 *
 * Cloudinary guard: a photo file is only deleted when NO other car still
 * references the same URL. Test listings shared pooled URLs with real
 * cars once, and purging one car's files silently broke the others' —
 * never again.
 */
export const TRASH_RETENTION_DAYS = 7;

export const runTrashPurge = async () => {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const cars = await prisma.car.findMany({
    where: { deletedAt: { lte: cutoff } },
    include: { images: true },
  });

  let purged = 0;
  for (const car of cars) {
    const urls = [...new Set(car.images.map(img => img.url))];
    const stillUsed = urls.length
      ? await prisma.image.findMany({
          where: { url: { in: urls }, carId: { not: car.id } },
          select: { url: true },
        })
      : [];
    const usedElsewhere = new Set(stillUsed.map(row => row.url));
    const deletable = urls.filter(url => !usedElsewhere.has(url));

    await prisma.car.delete({ where: { id: car.id } });
    purged++;

    if (deletable.length > 0) {
      deleteCloudinaryImages(deletable).catch(error => {
        console.error(`   ❌ Cloudinary purge failed for trashed car ${car.id}:`, error);
      });
    }
    if (usedElsewhere.size > 0) {
      console.log(`   ℹ️  Kept ${usedElsewhere.size} shared photo file(s) still used by other cars`);
    }
  }

  if (purged > 0) {
    console.log(`   ✅ Purged ${purged} trashed cars (${TRASH_RETENTION_DAYS}+ days in trash)`);
    invalidateFilterStatsCache();
  } else {
    console.log('   ℹ️  Trash is empty (nothing older than the retention window)');
  }
  return { purged };
};

export const startSoldCarsCleanupJob = () => {
  // Run every day at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('🕐 [CRON] Running SOLD cars cleanup job...');
      await runSoldCarsCleanup();
      console.log('✅ [CRON] SOLD cars cleanup completed');
    } catch (error) {
      console.error('❌ [CRON] SOLD cars cleanup failed:', error);
    }
  });

  console.log('✓ SOLD cars cleanup job scheduled (runs daily at 2:00 AM)');
};
