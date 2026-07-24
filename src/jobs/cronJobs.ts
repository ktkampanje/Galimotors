import { startReservationExpiryJob } from './reservationExpiryJob';
import { startSoldCarsCleanupJob } from './soldCarsCleanupJob';
import { startDatabaseBackupJob } from './databaseBackupJob';

/**
 * Initialize all cron jobs
 * Called once when the server starts
 */
export const initCronJobs = () => {
  console.log('🕐 Initializing cron jobs...');
  
  // Start reservation expiry job (runs every 15 minutes)
  startReservationExpiryJob();
  
  // Start SOLD cars cleanup job (runs daily at 2:00 AM)
  startSoldCarsCleanupJob();

  // Start database backup job (daily at 3:00 AM + on startup)
  startDatabaseBackupJob();

  console.log('✓ All cron jobs initialized successfully');
};
