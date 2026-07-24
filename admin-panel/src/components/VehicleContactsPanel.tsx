import React, { useState } from 'react';
import {
  Car as CarIcon, ChevronDown, PhoneCall, MessageCircle,
  Store, BadgeCheck, MapPin, User
} from 'lucide-react';
import { buildWhatsAppUrl } from '../lib/whatsapp';

interface Contact {
  name: string;
  phone: string;
  sellerType?: string;
  district?: string;
  verifiedByPlatform?: boolean;
  market?: { name: string; district: string } | null;
}

export interface ViewingCar {
  id?: string;
  title: string;
  basePrice?: number;
  /** Seller's bottom line — admin-only; the public API never sends it. */
  sellerAskingPrice?: number | null;
  status?: string;
  district?: string;
  year?: number;
  mileage?: number;
  registrationNumber?: string | null;
  maker?: { name: string } | null;
  model?: { name: string } | null;
  images?: { url: string; isPrimary: boolean }[];
  seller?: Contact | null;
  attendant?: Contact | null;
  market?: { name: string; district: string } | null;
}

interface Props {
  car: ViewingCar;
  /** Prefilled into the WhatsApp message so the contact knows which car. */
  reference?: string;
}

const STATUS_TONE: Record<string, string> = {
  AVAILABLE: 'bg-success-light text-success',
  RESERVED: 'bg-warning-light text-warning',
  SOLD: 'bg-danger-light text-danger',
  HIDDEN: 'bg-muted text-text-secondary',
};

/**
 * Vehicle, seller and attendant details for a viewing request.
 *
 * Before scheduling, an admin needs to confirm with whoever physically holds
 * the car that it is still available. Those numbers previously lived only in
 * the Inventory screen, so it meant leaving Viewings and searching for the car.
 */
const VehicleContactsPanel: React.FC<Props> = ({ car, reference }) => {
  const [open, setOpen] = useState(false);

  const contactMessage = (name: string) =>
    `Hi ${name.split(' ')[0]}, this is GaliMotors. A customer has requested a viewing` +
    `${reference ? ` (${reference})` : ''} for the ${car.title}. Is it still available?`;

  const renderContact = (label: string, contact: Contact | null | undefined, Icon: typeof User) => {
    if (!contact) {
      return (
        <div className="p-3 bg-muted border border-border">
          <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">{label}</p>
          <p className="text-sm text-text-tertiary">Not assigned</p>
        </div>
      );
    }

    const waHref = buildWhatsAppUrl(contact.phone, contactMessage(contact.name));

    return (
      <div className="p-3 bg-surface border border-border">
        <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">{label}</p>

        <div className="flex items-start gap-2">
          <Icon size={15} className="text-text-tertiary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-text-primary flex items-center gap-1.5 flex-wrap">
              {contact.name}
              {contact.verifiedByPlatform && (
                <BadgeCheck size={13} className="text-success shrink-0" />
              )}
            </p>

            <p className="text-xs text-text-secondary mt-0.5 tabular-nums">{contact.phone}</p>

            {(contact.sellerType || contact.district) && (
              <p className="text-[11px] text-text-tertiary mt-0.5">
                {[contact.sellerType, contact.district].filter(Boolean).join(' · ')}
              </p>
            )}

            {contact.market && (
              <p className="text-[11px] text-text-tertiary mt-0.5 flex items-center gap-1">
                <Store size={10} /> {contact.market.name}, {contact.market.district}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-2.5">
          <a
            href={`tel:${contact.phone}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-border hover:bg-muted text-xs font-bold text-text-primary transition-colors"
          >
            <PhoneCall size={13} /> Call
          </a>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#25D366] hover:bg-[#1fb85a] text-white text-xs font-bold transition-colors"
            >
              <MessageCircle size={13} /> WhatsApp
            </a>
          ) : (
            <span
              title="No usable WhatsApp number on file"
              className="flex-1 flex items-center justify-center py-2 bg-muted text-text-tertiary text-xs font-bold cursor-not-allowed"
            >
              No number
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-border">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface hover:bg-muted transition-colors text-left"
      >
        <span className="flex items-center gap-2 min-w-0">
          <CarIcon size={16} className="text-text-tertiary shrink-0" />
          <span className="text-sm font-bold text-text-primary truncate">Vehicle &amp; contacts</span>
          {car.status && (
            <span className={`text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider shrink-0 ${
              STATUS_TONE[car.status] || 'bg-muted text-text-secondary'
            }`}>
              {car.status}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={`text-text-tertiary shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="p-3 bg-muted/40 border-t border-border space-y-3">
          {/* Vehicle summary — confirms which car before ringing anyone. */}
          <div className="p-3 bg-surface border border-border">
            <p className="text-sm font-bold text-text-primary">{car.title}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
              {car.basePrice !== undefined && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Listed price</span>
                  <span className="font-bold text-text-primary">MK {car.basePrice.toLocaleString()}</span>
                </div>
              )}
              {car.year && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Year</span>
                  <span className="font-bold text-text-primary">{car.year}</span>
                </div>
              )}
              {car.mileage !== undefined && car.mileage !== null && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Mileage</span>
                  <span className="font-bold text-text-primary">{car.mileage.toLocaleString()} km</span>
                </div>
              )}
              {car.district && (
                <div className="flex justify-between">
                  <span className="text-text-tertiary">Location</span>
                  <span className="font-bold text-text-primary">{car.district}</span>
                </div>
              )}
              {car.registrationNumber && (
                <div className="flex justify-between col-span-2">
                  <span className="text-text-tertiary">Reg. number</span>
                  <span className="font-bold text-text-primary">{car.registrationNumber}</span>
                </div>
              )}
            </div>

            {/* Negotiating room. GaliMotors' take is whatever the agreed
                price clears the seller's bottom line by — not a fixed cut. */}
            {car.sellerAskingPrice ? (
              <div className="mt-2.5 bg-gold-light/50 border border-gold/30 px-2.5 py-2 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">Seller's final price</span>
                  <span className="font-bold text-text-primary">MK {car.sellerAskingPrice.toLocaleString()}</span>
                </div>
                {car.basePrice !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Room to negotiate</span>
                    <span className={`font-bold ${car.basePrice - car.sellerAskingPrice >= 0 ? 'text-success' : 'text-danger'}`}>
                      MK {(car.basePrice - car.sellerAskingPrice).toLocaleString()}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-text-tertiary">
                  Anything agreed above the seller's price is GaliMotors' margin. Never quote this number to the customer.
                </p>
              </div>
            ) : (
              <p className="mt-2.5 text-[11px] text-text-tertiary">
                Seller's final price not recorded — edit the car in Inventory to add it.
              </p>
            )}

            {car.status && car.status !== 'AVAILABLE' && (
              <p className="mt-2.5 text-[11px] font-semibold text-warning bg-warning-light px-2 py-1.5">
                This car is marked {car.status}. Confirm before scheduling a viewing.
              </p>
            )}

            {car.id && (
              <a
                href={`/inventory?carId=${car.id}`}
                className="inline-flex items-center gap-1 mt-2.5 text-xs font-semibold text-coral hover:underline"
              >
                Open in Inventory
              </a>
            )}
          </div>

          {renderContact('Seller', car.seller, User)}
          {renderContact('Market attendant', car.attendant, Store)}

          {car.market && !car.attendant && (
            <div className="p-3 bg-surface border border-border">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1">Market</p>
              <p className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                <MapPin size={13} className="text-text-tertiary" />
                {car.market.name}, {car.market.district}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleContactsPanel;
