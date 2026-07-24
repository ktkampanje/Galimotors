// Notification Service for GaliMotors
// Supports: WhatsApp, SMS, Email

import { getAdminWhatsApp } from '../lib/businessContact';

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

const isEmailConfigured = () => {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

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

// Send Email via SMTP
export const sendEmail = async (
  to: string,
  subject: string,
  message: string
): Promise<NotificationResult> => {
  try {
    if (!isEmailConfigured()) {
      console.warn(
        '[notifications] Email not configured — message NOT sent to %s. ' +
        'Set SMTP_HOST / SMTP_USER / SMTP_PASS and install the nodemailer package.',
        to
      );
      return {
        success: false,
        provider: 'email-unconfigured',
        error: 'Email provider is not configured on this server'
      };
    }

    const nodemailer = require('nodemailer');
    const businessNumber = await getAdminWhatsApp();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const result = await transporter.sendMail({
      from: `"GaliMotors" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject,
      text: message,
      // #13293D is the brand navy; this previously used the retired coral.
      // The contact number comes from settings so it tracks the admin panel.
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #13293D;">GaliMotors</h2>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr style="border: 1px solid #eee; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">
          This is an automated message from GaliMotors.${
            businessNumber ? `<br>For inquiries, contact us at ${businessNumber}` : ''
          }
        </p>
      </div>`
    });

    return {
      success: true,
      provider: 'smtp',
      messageId: result.messageId
    };
  } catch (error: any) {
    console.error('Email send failed:', error);
    return {
      success: false,
      provider: 'email',
      error: error.message
    };
  }
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
