import cron from 'node-cron';
import prisma from '../lib/prisma';
import notificationService from '../services/notificationService';
import { getAdminWhatsApp } from '../lib/businessContact';

/**
 * Reservation Expiry Cron Job
 * Runs every 15 minutes to check for expired reservations
 * Updates car status to AVAILABLE and notifies relevant parties
 */
export const startReservationExpiryJob = () => {
  // Run every 15 minutes: */15 * * * *
  cron.schedule('*/15 * * * *', async () => {
    const now = new Date();
    console.log(`[${now.toISOString()}] Running reservation expiry check...`);
    
    try {
      // Find all cars with expired reservations
      const expiredReservations = await prisma.car.findMany({
        where: {
          status: 'RESERVED',
          reservationExpiry: {
            lt: now
          }
        },
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          },
          maker: {
            select: {
              name: true
            }
          },
          model: {
            select: {
              name: true
            }
          }
        }
      });

      if (expiredReservations.length === 0) {
        console.log('No expired reservations found.');
        return;
      }

      console.log(`Found ${expiredReservations.length} expired reservation(s). Processing...`);

      // Process each expired reservation
      for (const car of expiredReservations) {
        try {
          // Get the lead associated with this reservation
          let lead = null;
          if (car.reservedByLeadId) {
            lead = await prisma.lead.findUnique({
              where: { id: car.reservedByLeadId },
              select: {
                id: true,
                buyerName: true,
                buyerPhone: true,
                buyerEmail: true
              }
            });
          }

          // Update car status to AVAILABLE
          await prisma.car.update({
            where: { id: car.id },
            data: {
              status: 'AVAILABLE',
              reservedByLeadId: null,
              reservationExpiry: null
            }
          });

          // Update lead status to EXPIRED if lead exists
          if (lead) {
            await prisma.lead.update({
              where: { id: lead.id },
              data: {
                status: 'CLOSED_LOST',
                message: `Reservation expired on ${now.toISOString()}`
              }
            });
          }

          // Send notifications
          await sendExpiryNotifications(car, lead);

          console.log(`✓ Processed expired reservation for car: ${car.title} (${car.id})`);
        } catch (error) {
          console.error(`✗ Error processing car ${car.id}:`, error);
          // Continue with next car even if one fails
        }
      }

      console.log(`Reservation expiry check completed. Processed ${expiredReservations.length} car(s).`);
    } catch (error) {
      console.error('Error in reservation expiry job:', error);
    }
  });

  console.log('✓ Reservation expiry cron job initialized (runs every 15 minutes)');
};

/**
 * Send notifications to admin, seller, and customer about expired reservation
 */
async function sendExpiryNotifications(car: any, lead: any) {
  const carTitle = `${car.maker?.name || ''} ${car.model?.name || ''} ${car.year || ''}`.trim() || car.title;
  
  try {
    // 1. Notify Admin via WhatsApp
    const adminWhatsApp = await getAdminWhatsApp();
    if (adminWhatsApp) {
      await notificationService.sendWhatsApp(
        adminWhatsApp,
        `🔔 *Reservation Expired*\n\n` +
        `Car: ${carTitle}\n` +
        `Status: Now AVAILABLE\n` +
        `Previous Customer: ${lead?.buyerName || 'Unknown'}\n` +
        `Time: ${new Date().toLocaleString()}`
      );
    }

    // 2. Notify Seller via SMS
    if (car.seller?.phone) {
      await notificationService.sendSMS(
        car.seller.phone,
        `GaliMotors: Your car "${carTitle}" is now AVAILABLE. The reservation has expired.`
      );
    }

    // 3. Notify Customer via SMS (if lead exists)
    if (lead?.buyerPhone) {
      await notificationService.sendSMS(
        lead.buyerPhone,
        `GaliMotors: Your reservation for "${carTitle}" has expired. ` +
        `The car is now available to other buyers. Contact us to reserve again: ${adminWhatsApp || '+265990000000'}`
      );
    }

    // 4. Notify Customer via WhatsApp (if available)
    if (lead?.buyerPhone) {
      await notificationService.sendWhatsApp(
        lead.buyerPhone,
        `🔔 *Reservation Expired*\n\n` +
        `Your reservation for *${carTitle}* has expired.\n\n` +
        `The car is now available to other buyers.\n\n` +
        `To reserve again, please contact us immediately.`
      );
    }

    console.log(`  ✓ Notifications sent for car: ${carTitle}`);
  } catch (error) {
    console.error(`  ✗ Error sending notifications for car ${car.id}:`, error);
    // Don't throw - we still want to mark the reservation as expired
  }
}
