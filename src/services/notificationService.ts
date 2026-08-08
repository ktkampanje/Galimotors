// Notification Service for GaliMotors
// Supports: WhatsApp, SMS, Email

import { escapeHtml, isEmailConfigured as resendConfigured, renderEmail, sendMail } from '../lib/email';
import { getAdminEmail, getAdminWhatsApp } from '../lib/businessContact';

interface NotificationPayload {
  to: string; // Phone number or email
  message: string;
  subject?: string; // For email
  type: 'whatsapp' | 'sms' | 'email';
}

interface NotificationResult {
  success: boolean;
  provider: string;
  messageId?: string;
  error?: string;
}

// Check if notification providers are configured
const isWhatsAppConfigured = () => {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_NUMBER
  );
};

const isSMSConfigured = () => {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
};

// Email runs on Resend now, so configuration is a single API key.
const isEmailConfigured = () => resendConfigured();

// Send WhatsApp message via Twilio
export const sendWhatsApp = async (to: string, message: string): Promise<NotificationResult> => {
  try {
    if (!isWhatsAppConfigured()) {
      // Reports failure deliberately. This previously returned success:true
      // with a mock id, so every caller believed the customer had been
      // notified when nothing was sent and no one could tell the difference.
      // Automated WhatsApp requires `npm install twilio` AND the TWILIO_*
      // env vars — setting the vars alone makes require('twilio') throw below.
      console.warn(
        '[notifications] WhatsApp not configured — message NOT sent to %s. ' +
        'Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_NUMBER and install the twilio package.',
        to
      );
      return {
        success: false,
        provider: 'whatsapp-unconfigured',
        error: 'WhatsApp provider is not configured on this server'
      };
    }

    // Twilio WhatsApp integration
    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Format phone number for WhatsApp (must start with whatsapp:)
    const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:+${to.replace(/^0/, '265')}`;
    const formattedFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;

    const result = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo
    });

    return {
      success: true,
      provider: 'twilio-whatsapp',
      messageId: result.sid
    };
  } catch (error: any) {
    console.error('WhatsApp send failed:', error);
    return {
      success: false,
      provider: 'whatsapp',
      error: error.message
    };
  }
};

// Send SMS via Twilio
export const sendSMS = async (to: string, message: string): Promise<NotificationResult> => {
  try {
    if (!isSMSConfigured()) {
      console.warn(
        '[notifications] SMS not configured — message NOT sent to %s. ' +
        'Set TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER and install the twilio package.',
        to
      );
      return {
        success: false,
        provider: 'sms-unconfigured',
        error: 'SMS provider is not configured on this server'
      };
    }

    const twilio = require('twilio');
    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    // Format phone number (add +265 for Malawi)
    const formattedTo = to.startsWith('+') ? to : `+${to.replace(/^0/, '265')}`;

    const result = await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: formattedTo
    });

    return {
      success: true,
      provider: 'twilio-sms',
      messageId: result.sid
    };
  } catch (error: any) {
    console.error('SMS send failed:', error);
    return {
      success: false,
      provider: 'sms',
      error: error.message
    };
  }
};

// Send Email via Resend
export const sendEmail = async (
  to: string,
  subject: string,
  message: string
): Promise<NotificationResult> => {
  if (!isEmailConfigured()) {
    console.warn(
      '[notifications] Email not configured — message NOT sent to %s. ' +
      'Set RESEND_API_KEY (and RESEND_FROM) to enable it.',
      to
    );
    return {
      success: false,
      provider: 'email-unconfigured',
      error: 'Email provider is not configured on this server'
    };
  }

  // Templates below are authored as plain text with blank lines between
  // paragraphs. That structure is exactly what the HTML layout wants, so it is
  // reused rather than dumping the whole body into one <p> as the old SMTP
  // version did. Single newlines stay as line breaks (address blocks, lists).
  const paragraphs = message
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block.trim()).replace(/\n/g, '<br>'))
    .filter(Boolean);

  // Subjects are suffixed "- GaliMotors" for the inbox list, where the sender
  // is not always visible. Inside the email the brand is already in the header,
  // so the suffix would just read as a stutter.
  const heading = subject.replace(/\s*[-–—]\s*GaliMotors.*$/i, '').trim() || subject;

  const html = await renderEmail({ heading, paragraphs });
  const result = await sendMail({ to, subject, html, text: message });

  return {
    success: result.success,
    provider: 'resend',
    messageId: result.messageId,
    error: result.error
  };
};

// Smart notification with fallback (WhatsApp → SMS → Email)
export const sendNotification = async (payload: NotificationPayload): Promise<NotificationResult> => {
  const { to, message, subject, type } = payload;

  // Try primary method
  if (type === 'whatsapp') {
    const result = await sendWhatsApp(to, message);
    if (result.success) return result;
    
    // Fallback to SMS
    console.log('WhatsApp failed, falling back to SMS');
    return await sendSMS(to, message);
  }

  if (type === 'sms') {
    return await sendSMS(to, message);
  }

  if (type === 'email') {
    return await sendEmail(to, subject || 'GaliMotors Notification', message);
  }

  return {
    success: false,
    provider: 'unknown',
    error: 'Invalid notification type'
  };
};

/**
 * Alert the business that something needs a human: a new inquiry, a quote
 * request, a viewing booking, a car submitted for sale.
 *
 * Fans out to BOTH channels instead of falling back between them. Falling
 * back would mean the WhatsApp attempt has to fail before email is tried —
 * and WhatsApp is unconfigured (no Twilio), so every alert would take the
 * slow path. More importantly these are leads: a missed one is lost revenue,
 * so a duplicate alert is far cheaper than a dropped one.
 *
 * Recipients come from the admin Settings page via businessContact, so they
 * follow the business rather than the server's environment.
 */
export const notifyAdmin = async (
  subject: string,
  message: string
): Promise<NotificationResult> => {
  const [adminWhatsApp, adminEmail] = await Promise.all([
    getAdminWhatsApp(),
    getAdminEmail(),
  ]);

  const results: NotificationResult[] = [];

  if (adminWhatsApp) {
    results.push(await sendWhatsApp(adminWhatsApp, message));
  }

  if (adminEmail) {
    results.push(await sendEmail(adminEmail, subject, message));
  } else {
    console.warn(
      '[notifications] No business email configured — admin alert "%s" was not emailed. ' +
      'Set it on the admin Settings page (businessEmail).',
      subject
    );
  }

  const delivered = results.find((r) => r.success);
  if (delivered) return delivered;

  return {
    success: false,
    provider: 'admin-alert',
    error:
      results.map((r) => r.error).filter(Boolean).join('; ') ||
      'No admin contact is configured',
  };
};

// Notification templates
export const templates = {
  // Customer notifications
  inquiryReceived: (customerName: string, carTitle: string) => ({
    message: `Hi ${customerName}! 👋\n\nThank you for your inquiry about the ${carTitle}.\n\nOur team will contact you shortly to discuss this vehicle.\n\nGaliMotors - Your Trusted Car Broker`,
    subject: 'Inquiry Received - GaliMotors'
  }),

  paymentVerified: (customerName: string, carTitle: string) => ({
    message: `Hi ${customerName}! ✅\n\nYour payment has been verified!\n\nVehicle: ${carTitle}\n\nOur team will contact you to schedule your viewing.\n\nGaliMotors`,
    subject: 'Payment Verified - GaliMotors'
  }),

  paymentRejected: (customerName: string, reason: string) => ({
    message: `Hi ${customerName},\n\nYour payment could not be verified.\n\nReason: ${reason}\n\nPlease contact us or re-upload your proof of payment.\n\nGaliMotors`,
    subject: 'Payment Verification Issue - GaliMotors'
  }),

  reservationExpired: (customerName: string, carTitle: string) => ({
    message: `Hi ${customerName},\n\nYour reservation for ${carTitle} has expired.\n\nThe vehicle is now available again. Contact us to extend your reservation.\n\nGaliMotors`,
    subject: 'Reservation Expired - GaliMotors'
  }),

  // Admin notifications
  newInquiry: (carTitle: string, customerName: string, customerPhone: string) => ({
    message: `🔔 New Inquiry!\n\nCar: ${carTitle}\nCustomer: ${customerName}\nPhone: ${customerPhone}\n\nCheck admin panel for details.`,
    subject: 'New Inquiry - GaliMotors Admin'
  }),

  paymentPending: (carTitle: string, customerName: string, amount: number) => ({
    message: `💰 Payment Pending Verification\n\nCar: ${carTitle}\nCustomer: ${customerName}\nAmount: MK ${amount.toLocaleString()}\n\nCheck payment queue in admin panel.`,
    subject: 'Payment Pending - GaliMotors Admin'
  }),

  quoteRequested: (carTitle: string, customerName: string, customerPhone: string) => ({
    message: `📄 Quote Requested\n\nCar: ${carTitle}\nCustomer: ${customerName}\nPhone: ${customerPhone}\n\nSend a quote from the admin panel.`,
    subject: 'Quote Requested - GaliMotors Admin'
  }),

  viewingBooked: (carTitle: string, customerName: string, customerPhone: string, when?: string | null) => ({
    message:
      `📅 Viewing Booked\n\nCar: ${carTitle}\nCustomer: ${customerName}\nPhone: ${customerPhone}` +
      (when ? `\nRequested: ${when}` : '') +
      `\n\nConfirm the appointment in the admin panel.`,
    subject: 'Viewing Booked - GaliMotors Admin'
  }),

  sellRequestSubmitted: (sellerName: string, sellerPhone: string, vehicle: string) => ({
    message: `🚗 Car Submitted For Sale\n\nVehicle: ${vehicle}\nSeller: ${sellerName}\nPhone: ${sellerPhone}\n\nReview it under Sell Requests in the admin panel.`,
    subject: 'New Sell Request - GaliMotors Admin'
  }),

  // Seller notifications
  carSold: (sellerName: string, carTitle: string, price: number, commission: number) => ({
    message: `🎉 Congratulations ${sellerName}!\n\nYour ${carTitle} has been sold!\n\nSale Price: MK ${price.toLocaleString()}\nYour Commission: MK ${commission.toLocaleString()}\n\nGaliMotors`,
    subject: 'Car Sold - GaliMotors'
  })
};

// Batch notification (send to multiple recipients)
export const sendBatchNotifications = async (
  recipients: string[],
  message: string,
  type: 'whatsapp' | 'sms' | 'email' = 'whatsapp'
): Promise<NotificationResult[]> => {
  const results = await Promise.all(
    recipients.map(to => sendNotification({ to, message, type }))
  );
  return results;
};

export default {
  notifyAdmin,
  sendWhatsApp,
  sendSMS,
  sendEmail,
  sendNotification,
  sendBatchNotifications,
  templates,
  isWhatsAppConfigured,
  isSMSConfigured,
  isEmailConfigured
};
