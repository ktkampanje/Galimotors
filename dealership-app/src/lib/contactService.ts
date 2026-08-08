// Opens WhatsApp chats with the business, with car-aware prefilled messages.
import axios from 'axios';
import { API_BASE_URL } from './api';
import { generateCarUrl } from './seoRoutes';

interface ContactOptions {
  phone: string;
  message: string;
}

interface GlobalSettings {
  adminWhatsApp: string;
  adminPhone: string;
  businessEmail: string;
  driverAllowance: number;
  accommodationFee: number;
}

export class ContactService {
  private adminPhone = '265990000000'; // Default admin phone (fallback only)
  private cachedSettings: GlobalSettings | null = null;

  // Fetch settings from API
  private async getSettings(): Promise<GlobalSettings> {
    // Return cached settings if available
    if (this.cachedSettings) {
      return this.cachedSettings;
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/settings/global`);
      this.cachedSettings = response.data;
      return response.data;
    } catch (error) {
      console.error('Failed to fetch settings, using default:', error);
      return {
        adminWhatsApp: this.adminPhone,
        adminPhone: this.adminPhone,
        businessEmail: 'info@galimotor.com',
        driverAllowance: 15000,
        accommodationFee: 25000
      };
    }
  }

  // Format phone number for WhatsApp. wa.me accepts digits only — no +,
  // spaces or punctuation — and requires international form.
  private formatPhoneForWhatsApp(phone: string): string {
    let cleaned = (phone || '').replace(/[^\d+]/g, '').replace(/^\+/, '');

    // A local-form Malawian number (0885…) is not routable by wa.me; promote
    // it to international form rather than producing a dead link.
    if (cleaned.startsWith('0')) {
      cleaned = `265${cleaned.slice(1)}`;
    }

    if (!cleaned || !/^\d+$/.test(cleaned)) {
      console.warn('[contactService] Unusable phone number, using fallback:', phone);
      cleaned = '265990000000';
    }
    return cleaned;
  }

  // Generate WhatsApp URL
  generateWhatsAppUrl(options: ContactOptions): string {
    const { phone, message } = options;
    const cleanPhone = this.formatPhoneForWhatsApp(phone);

    // encodeURIComponent already escapes &, quotes, angle brackets and
    // newlines safely. The previous sanitiser stripped them first, which only
    // corrupted legitimate text — a car titled 'TOYOTA "GL"' lost its quotes
    // and "Import & Clearing" became "Import and Clearing" in the message the
    // customer sent.
    const encodedMessage = encodeURIComponent(message.trim());

    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  async openWhatsApp(options: ContactOptions): Promise<boolean> {
    try {
      const whatsappUrl = this.generateWhatsAppUrl(options);
      const opened = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

      if (!opened) {
        // Popup blocked. Navigating the current tab still reaches WhatsApp,
        // which is better than telling the customer to change browser settings.
        window.location.href = whatsappUrl;
        return true;
      }

      return true;
    } catch (error) {
      console.error('[contactService] Failed to open WhatsApp:', error);
      alert('Could not open WhatsApp. Please try again.');
      return false;
    }
  }

  // Generate contact message for car inquiry
  generateCarInquiryMessage(car: any): string {
    // Build comprehensive message with car details for clear identification
    // Car titles already lead with the year ("2010 ISUZU ELF TRUCK"), so it is
    // deliberately not repeated here.
    const title = car.title || 'Vehicle';
    const bodyType = car.bodyType?.name || '';
    const mileage = car.mileage ? `${car.mileage.toLocaleString()} km` : '';
    const transmission = car.transmission === 'AUTOMATIC' ? 'Automatic' : car.transmission === 'MANUAL' ? 'Manual' : '';
    const fuelType = car.fuelType || '';
    const exteriorColor = car.exteriorColor || '';
    const price = car.basePrice ? `MK ${Number(car.basePrice).toLocaleString()}` : '';
    
    let message = `Hi, I'm interested in the ${title}`;
    
    // Add body type if available
    if (bodyType) {
      message += ` (${bodyType})`;
    }
    
    // Add detailed specs on new line
    let specs = [];
    if (mileage) specs.push(`Mileage: ${mileage}`);
    if (transmission) specs.push(`Transmission: ${transmission}`);
    if (fuelType) specs.push(`Fuel: ${fuelType}`);
    if (exteriorColor) specs.push(`Color: ${exteriorColor}`);
    if (price) specs.push(`Price: ${price}`);
    
    if (specs.length > 0) {
      message += '\n' + specs.join(', ');
    }

    // The unique identifier. Specs alone cannot distinguish two similar
    // imports (same model, year and price is common stock); the ref is the
    // car id prefix, which the admin inventory search matches directly, and
    // the link reopens the exact listing.
    if (car.id) {
      message += `\nRef: ${String(car.id).split('-')[0].toUpperCase()}`;
      try {
        message += `\n${window.location.origin}${generateCarUrl(car)}`;
      } catch {
        /* URL builder needs maker/model — ref alone still identifies it */
      }
    }

    message += '\n\nCan you provide more details and confirm availability?';

    return message;
  }

  // Generate contact message for viewing request
  generateViewingRequestMessage(car: any, customerName: string): string {
    // Build comprehensive message with car details for viewing request
    const title = car.title || 'Vehicle';
    const bodyType = car.bodyType?.name || '';

    let message = `Hi, I am ${customerName} and would like to schedule a viewing for the ${title}`;

    if (bodyType) {
      message += ` (${bodyType})`;
    }
    message += '.';

    // Same unique identifier as the inquiry message — a viewing request for
    // "the Vezel" must never end up scheduling the wrong Vezel.
    if (car.id) {
      message += `\nRef: ${String(car.id).split('-')[0].toUpperCase()}`;
      try {
        message += `\n${window.location.origin}${generateCarUrl(car)}`;
      } catch { /* ref alone still identifies it */ }
    }

    message += '\n\nWhen would be a good time?';

    return message;
  }

  // Contact admin about a car (async - uses DB settings)
  async contactAboutCar(car: any, type: 'inquiry' | 'viewing' = 'inquiry', customerName?: string): Promise<void> {
    try {
      const message = type === 'viewing' && customerName
        ? this.generateViewingRequestMessage(car, customerName)
        : this.generateCarInquiryMessage(car);

      const settings = await this.getSettings();

      if (!settings.adminWhatsApp) {
        throw new Error('Admin WhatsApp number not configured');
      }

      await this.openWhatsApp({
        phone: settings.adminWhatsApp,
        message,
      });
    } catch (error) {
      console.error('Error in contactAboutCar:', error);
      alert('Sorry, could not open WhatsApp. Please try again later.');
    }
  }
}

export default new ContactService();