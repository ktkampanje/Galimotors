import React from 'react';
import { ArrowRight, CheckCircle, XCircle, Clock, Handshake, Eye } from 'lucide-react';

export interface NextStepLead {
  status: string;
  buyerName?: string;
  negotiationStatus?: string;
  quotedPrice?: number;
  quoteSentAt?: string;
  customerViewedAt?: string;
  lastCounterOfferPrice?: number;
  lastCounterOfferTerms?: string;
  car: { basePrice?: number; sellerAskingPrice?: number | null };
}

interface Props {
  lead: NextStepLead;
  onSendQuote: () => void;
  onRespondToOffer: () => void;
  onScheduleViewing: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  busy?: boolean;
}

/**
 * The single "what do I do next?" panel for a lead.
 *
 * The screen previously showed several competing boxes plus a free-form
 * pipeline dropdown that let an admin set any status at any time — including
 * ones the backend's state machine rejects. This derives ONE primary action
 * from the lead's actual state, and only offers transitions that are legal.
 */

const money = (n?: number | null) => `MK ${Number(n || 0).toLocaleString()}`;

const LeadNextStep: React.FC<Props> = ({
  lead, onSendQuote, onRespondToOffer, onScheduleViewing, onMarkWon, onMarkLost, busy,
}) => {
  // An offer is on the table when the negotiation is live — whether or not
  // the customer named a price (they can counter with terms/message only).
  // Gating on price alone dropped price-less negotiations to the "send your
  // first quote" default, which misread a lead already mid-conversation.
  const hasOpenOffer =
    lead.negotiationStatus === 'ACTIVE' &&
    (lead.lastCounterOfferPrice != null || lead.status === 'NEGOTIATION');

  // What GaliMotors keeps if this offer is accepted: the gap over the
  // seller's bottom line, not a fixed commission.
  const take =
    lead.car?.sellerAskingPrice != null && lead.lastCounterOfferPrice != null
      ? lead.lastCounterOfferPrice - lead.car.sellerAskingPrice
      : null;

  const Shell: React.FC<{
    tone: 'action' | 'waiting' | 'won' | 'lost';
    icon: React.ReactNode;
    step: string;
    children?: React.ReactNode;
  }> = ({ tone, icon, step, children }) => {
    const tones = {
      action: 'bg-warning-light border-warning/30',
      waiting: 'bg-info-light border-info/25',
      won: 'bg-success-light border-success/30',
      lost: 'bg-muted border-border',
    };
    const labels = {
      action: 'text-warning',
      waiting: 'text-info',
      won: 'text-success',
      lost: 'text-text-secondary',
    };
    return (
      <div className={`border-2 ${tones[tone]} p-5 rounded-xl space-y-4`}>
        <div className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] ${labels[tone]}`}>
          {icon}
          {tone === 'action' ? 'Your next step' : tone === 'waiting' ? 'Waiting on customer' : 'Outcome'}
        </div>
        <p className="text-[15px] font-bold text-text-primary leading-snug">{step}</p>
        {children}
      </div>
    );
  };

  const CloseRow = () => (
    <div className="flex gap-2 pt-1">
      <button
        onClick={onMarkWon}
        disabled={busy}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-success/40 bg-white text-success text-xs font-bold hover:bg-success hover:text-white transition-colors disabled:opacity-50"
      >
        <CheckCircle size={14} /> Mark Sold
      </button>
      <button
        onClick={onMarkLost}
        disabled={busy}
        className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-danger/40 bg-white text-danger text-xs font-bold hover:bg-danger hover:text-white transition-colors disabled:opacity-50"
      >
        <XCircle size={14} /> Close as Lost
      </button>
    </div>
  );

  // ── Closed states ────────────────────────────────────────────────
  if (lead.status === 'COMPLETED') {
    return (
      <Shell tone="won" icon={<CheckCircle size={14} />} step="Sold — this lead is closed.">
        <p className="text-xs text-success">
          Remember to mark the car as Sold in Inventory if you have not already.
        </p>
      </Shell>
    );
  }

  if (lead.status === 'CLOSED_LOST') {
    return (
      <Shell tone="lost" icon={<XCircle size={14} />} step="Closed — this lead did not convert.">
        <button
          onClick={onSendQuote}
          disabled={busy}
          className="w-full py-2.5 border border-border bg-white text-text-primary text-xs font-bold hover:border-gold-dark transition-colors disabled:opacity-50"
        >
          Reopen with a new quote
        </button>
      </Shell>
    );
  }

  // ── An offer is on the table: the decision moment ─────────────────
  if (hasOpenOffer) {
    return (
      <Shell
        tone="action"
        icon={<Handshake size={14} />}
        step={lead.lastCounterOfferPrice != null
          ? `${lead.buyerName ?? 'The customer'} offered ${money(lead.lastCounterOfferPrice)} — respond to it.`
          : `${lead.buyerName ?? 'The customer'} is negotiating — respond to their message.`}
      >
        <div className="space-y-1.5">
          <div className="flex justify-between items-center bg-white/70 px-3 py-2 text-xs">
            <span className="text-text-secondary">Listed price</span>
            <span className="font-bold text-text-primary">{money(lead.car?.basePrice)}</span>
          </div>
          {lead.lastCounterOfferPrice != null && (
            <div className="flex justify-between items-center bg-white px-3 py-2 border border-warning/30">
              <span className="text-xs font-bold text-warning">Their offer</span>
              <span className="text-base font-black text-coral">{money(lead.lastCounterOfferPrice)}</span>
            </div>
          )}
          {take !== null && (
            <div className={`flex justify-between items-center px-3 py-2 border ${
              take >= 0 ? 'bg-success-light border-success/30' : 'bg-danger-light border-danger/30'
            }`}>
              <span className={`text-xs font-bold ${take >= 0 ? 'text-success' : 'text-danger'}`}>
                {take >= 0 ? 'You keep if accepted' : 'Below the seller’s price'}
              </span>
              <span className={`text-base font-black ${take >= 0 ? 'text-success' : 'text-danger'}`}>
                {money(Math.abs(take))}{take < 0 ? ' short' : ''}
              </span>
            </div>
          )}
          {lead.lastCounterOfferTerms && (
            <p className="text-xs text-warning px-1">Terms: {lead.lastCounterOfferTerms}</p>
          )}
        </div>

        <button
          onClick={onRespondToOffer}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-warning hover:brightness-110 text-white font-bold py-3 text-sm transition-all disabled:opacity-50"
        >
          Respond to Offer <ArrowRight size={16} />
        </button>
        <CloseRow />
      </Shell>
    );
  }

  // ── Quote accepted: arrange the handover ──────────────────────────
  if (lead.status === 'QUOTE_ACCEPTED') {
    return (
      <Shell
        tone="action"
        icon={<CheckCircle size={14} />}
        step={`Quote accepted at ${money(lead.quotedPrice)} — arrange the viewing or handover.`}
      >
        <button
          onClick={onScheduleViewing}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-coral hover:bg-coral-dark text-white font-bold py-3 text-sm transition-colors disabled:opacity-50"
        >
          <Eye size={16} /> Arrange Viewing
        </button>
        <CloseRow />
      </Shell>
    );
  }

  // ── Viewing scheduled ─────────────────────────────────────────────
  if (lead.status === 'VIEWING_SCHEDULED') {
    return (
      <Shell tone="waiting" icon={<Eye size={14} />} step="Viewing arranged — close the lead once it happens.">
        <CloseRow />
      </Shell>
    );
  }

  // ── Quote sent, no reply yet ──────────────────────────────────────
  if (lead.status === 'QUOTE_SENT') {
    return (
      <Shell
        tone="waiting"
        icon={<Clock size={14} />}
        step={`Quote of ${money(lead.quotedPrice)} sent — waiting for their reply.`}
      >
        <p className="text-xs text-info">
          {lead.customerViewedAt
            ? '✓ The customer has opened the quote.'
            : 'Not opened yet. Follow up on WhatsApp if it has been a while.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={onSendQuote}
            disabled={busy}
            className="flex-1 py-2.5 border border-info/40 bg-white text-info text-xs font-bold hover:bg-info hover:text-white transition-colors disabled:opacity-50"
          >
            Revise Quote
          </button>
          <button
            onClick={onScheduleViewing}
            disabled={busy}
            className="flex-1 py-2.5 border border-border bg-white text-text-primary text-xs font-bold hover:border-gold-dark transition-colors disabled:opacity-50"
          >
            Arrange Viewing
          </button>
        </div>
        <CloseRow />
      </Shell>
    );
  }

  // ── NEW / IN_PROGRESS: nothing sent yet ───────────────────────────
  return (
    <Shell
      tone="action"
      icon={<ArrowRight size={14} />}
      step="Send this customer a quote to start the conversation."
    >
      <button
        onClick={onSendQuote}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-success hover:brightness-110 text-white font-bold py-3 text-sm transition-all disabled:opacity-50"
      >
        Send Quote <ArrowRight size={16} />
      </button>
      <CloseRow />
    </Shell>
  );
};

export default LeadNextStep;
