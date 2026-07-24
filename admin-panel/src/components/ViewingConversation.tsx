import React, { useState, useRef, useEffect } from 'react';
import { Send, Calendar, CheckCircle, XCircle, Receipt, MapPin, Clock, Flag } from 'lucide-react';

export interface ViewingMessage {
  id: string;
  type: string;
  sender: string; // "customer" | "admin"
  /** Who wrote it — admin's name or the buyer's. Multi-admin attribution. */
  senderName?: string | null;
  message?: string | null;
  costBreakdown?: string | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  scheduledLocation?: string | null;
  /** Present on negotiation entries mapped into the thread. */
  offeredPrice?: number | null;
  proposedTerms?: string | null;
  createdAt: string;
}

interface Props {
  messages: ViewingMessage[];
  customerName: string;
  /** When the lead was created — renders the "conversation started" marker. */
  startedAt?: string;
  onSend?: (message: string) => Promise<void>;
  sending?: boolean;
  disabled?: boolean;
  /** Hide the reply box (quote thread is read-only; replies go via actions). */
  composer?: boolean;
  title?: string;
}

/**
 * WhatsApp-style thread for a lead.
 *
 * Reads like a chat so any admin can pick up a lead a colleague started:
 * customer on the left, admins on the right, every bubble named and
 * timestamped, day separators between dates, and system events (payments,
 * verifications) as centred notices rather than fake speech.
 */

const SYSTEM_TYPES = new Set([
  'ADMIN_PAYMENT_VERIFIED',
  'ADMIN_PAYMENT_REJECTED',
  'CUSTOMER_PAYMENT',
  'ADMIN_COST_QUOTE',
]);

const systemMeta = (type: string) => {
  switch (type) {
    case 'ADMIN_PAYMENT_VERIFIED':
      return { icon: CheckCircle, label: 'Payment verified', tone: 'text-success bg-success-light' };
    case 'ADMIN_PAYMENT_REJECTED':
      return { icon: XCircle, label: 'Payment rejected', tone: 'text-danger bg-danger-light' };
    case 'CUSTOMER_PAYMENT':
      return { icon: Receipt, label: 'Customer uploaded proof of payment', tone: 'text-info bg-info-light' };
    case 'ADMIN_COST_QUOTE':
      return { icon: Receipt, label: 'Viewing cost calculated', tone: 'text-text-secondary bg-muted' };
    default:
      return { icon: Receipt, label: type.replace(/_/g, ' '), tone: 'text-text-secondary bg-muted' };
  }
};

// Human labels for negotiation entries mapped into the thread.
const bubbleHeading = (type: string): string | null => {
  switch (type) {
    case 'ADMIN_QUOTE': return 'Quote sent';
    case 'ADMIN_COUNTER_RESPONSE': return 'Response to offer';
    case 'CUSTOMER_COUNTER': return 'Offer';
    case 'ADMIN_VIEWING_SCHEDULED': return 'Viewing scheduled';
    default: return null;
  }
};

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const dayLabel = (iso: string): string => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const parseCost = (raw?: string | null) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return null;
  }
};

const DaySeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-1">
    <span className="h-px flex-1 bg-border" />
    <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary bg-muted px-2.5 py-1 rounded-full">
      {label}
    </span>
    <span className="h-px flex-1 bg-border" />
  </div>
);

const ViewingConversation: React.FC<Props> = ({
  messages, customerName, startedAt, onSend, sending = false, disabled = false,
  composer = true, title = 'Conversation',
}) => {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const sorted = [...messages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [sorted.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending || !onSend) return;
    await onSend(text);
    setDraft('');
  };

  let lastDay: string | null = null;

  return (
    <div className="flex flex-col border border-border bg-muted/40">
      <div className="px-4 py-2.5 bg-surface border-b border-border flex items-center justify-between">
        <span className="text-sm font-bold text-text-primary">{title}</span>
        <span className="text-xs text-text-tertiary">
          {sorted.length} message{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="max-h-96 overflow-y-auto px-4 py-4 space-y-3">
        {/* Where it all began — so an admin joining later sees the origin. */}
        {startedAt && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-surface border border-border px-3 py-1.5 rounded-full">
              <Flag size={11} />
              Started by {customerName.split(' ')[0]} · {dayLabel(startedAt)} {timeOf(startedAt)}
            </span>
          </div>
        )}

        {sorted.length === 0 ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            No messages yet.{composer ? ' Send one below to start the conversation.' : ''}
          </p>
        ) : (
          sorted.map(msg => {
            const day = dayLabel(msg.createdAt);
            const showSeparator = day !== lastDay;
            lastDay = day;

            const separator = showSeparator ? <DaySeparator label={day} /> : null;

            if (SYSTEM_TYPES.has(msg.type)) {
              const { icon: Icon, label, tone } = systemMeta(msg.type);
              const cost = parseCost(msg.costBreakdown);
              return (
                <React.Fragment key={msg.id}>
                  {separator}
                  <div className="flex justify-center">
                    <div className={`max-w-[85%] px-3 py-2 text-center rounded ${tone}`}>
                      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                        <Icon size={13} /> {label}
                        {msg.senderName && <span className="opacity-70">— {msg.senderName}</span>}
                      </div>
                      {msg.message && (
                        <p className="text-xs mt-1 opacity-90">{msg.message}</p>
                      )}
                      {cost && (
                        <p className="text-xs mt-1 font-mono">
                          MK {Number(cost.totalCost ?? 0).toLocaleString()}
                        </p>
                      )}
                      <p className="text-[10px] mt-1 opacity-60">{timeOf(msg.createdAt)}</p>
                    </div>
                  </div>
                </React.Fragment>
              );
            }

            const isAdmin = msg.sender === 'admin';
            const heading = bubbleHeading(msg.type);
            const who = msg.senderName || (isAdmin ? 'GaliMotors' : customerName.split(' ')[0]);

            return (
              <React.Fragment key={msg.id}>
                {separator}
                <div className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Name above the bubble, WhatsApp-group style — the point
                        is that a second admin can see who wrote each message. */}
                    <span className={`text-[10px] font-bold mb-0.5 px-1 ${isAdmin ? 'text-coral' : 'text-text-secondary'}`}>
                      {who}{isAdmin ? ' · GaliMotors' : ''}
                    </span>
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isAdmin
                          ? 'bg-coral text-white rounded-lg rounded-tr-none'
                          : 'bg-surface text-text-primary border border-border rounded-lg rounded-tl-none'
                      }`}
                    >
                      {heading && (
                        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isAdmin ? 'text-white/70' : 'text-text-tertiary'}`}>
                          {heading}
                        </p>
                      )}

                      {msg.offeredPrice != null && (
                        <p className={`text-base font-black mb-1 ${isAdmin ? 'text-gold' : 'text-coral'}`}>
                          MK {msg.offeredPrice.toLocaleString()}
                        </p>
                      )}

                      {msg.message}

                      {msg.proposedTerms && (
                        <p className={`text-xs mt-1.5 ${isAdmin ? 'text-white/80' : 'text-text-secondary'}`}>
                          Terms: {msg.proposedTerms}
                        </p>
                      )}

                      {msg.type === 'ADMIN_VIEWING_SCHEDULED' && (
                        <div className={`mt-2.5 pt-2.5 border-t space-y-1 ${isAdmin ? 'border-white/20' : 'border-border'}`}>
                          {msg.scheduledDate && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                              <Calendar size={12} /> {msg.scheduledDate}
                            </p>
                          )}
                          {msg.scheduledTime && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                              <Clock size={12} /> {msg.scheduledTime}
                            </p>
                          )}
                          {msg.scheduledLocation && (
                            <p className="flex items-center gap-1.5 text-xs font-semibold">
                              <MapPin size={12} /> {msg.scheduledLocation}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-text-tertiary mt-1 px-1">
                      {timeOf(msg.createdAt)}
                    </span>
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {composer && (
        <div className="border-t border-border bg-surface p-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                // Enter sends; Shift+Enter adds a newline.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              rows={2}
              disabled={disabled || sending}
              placeholder={disabled ? 'Select a viewing to reply' : 'Type a message…  (Enter to send)'}
              className="filter-select flex-1 bg-surface resize-none text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!draft.trim() || sending || disabled}
              className="btn-primary px-4 h-11 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send message"
            >
              {sending ? '…' : <Send size={16} />}
            </button>
          </div>
          <p className="text-[11px] text-text-tertiary mt-1.5">
            Saved to the customer's viewing page. No WhatsApp message is sent automatically.
          </p>
        </div>
      )}
    </div>
  );
};

export default ViewingConversation;
