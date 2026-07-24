import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, X, Phone, MessageSquare, Car, Calendar, Send, ChevronDown, ArrowLeft, User, Store } from 'lucide-react';
import { api } from '../lib/api';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { useSettings } from '../hooks/useSettings';
import { useModal } from '../components/ui/ModalContext';

interface ConversationEntry {
  id: string;
  type: string;
  sender: 'admin' | 'customer';
  senderName: string;
  message?: string;
  offeredPrice?: number;
  proposedTerms?: string;
  status?: string;
  timestamp: string;
}

interface Quote {
  id: string;
  referenceNumber: string;
  buyerName: string;
  buyerPhone: string;
  message?: string;
  status: string;
  adminResponse?: string;
  quotedPrice?: number;
  paymentTerms?: string;
  quoteSentAt?: string;
  customerViewedAt?: string;
  negotiationStatus?: string;
  lastCounterOfferPrice?: number;
  createdAt: string;
  car: {
    id: string;
    title: string;
    basePrice: number;
    year?: number;
    mileage?: number;
    fuelType?: string;
    transmission?: string;
    condition?: string;
    district?: string;
    maker?: { name: string };
    model?: { name: string };
    bodyType?: { name: string };
    images: Array<{ url: string; isPrimary: boolean }>;
  };
  conversation: ConversationEntry[];
}

const QuoteView: React.FC = () => {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const { phoneLink, whatsappNumber } = useSettings();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reply form state
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyForm, setReplyForm] = useState({
    counterPrice: '',
    counterTerms: '',
    counterMessage: ''
  });
  const [submittingReply, setSubmittingReply] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reference) fetchQuote();
  }, [reference]);

  useEffect(() => {
    // Auto-scroll to bottom of conversation when new messages arrive
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [quote?.conversation]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/leads/quote/${reference}`);
      setQuote(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Quote not found');
    } finally {
      setLoading(false);
    }
  };

  const canTakeAction = quote && (quote.status === 'QUOTE_SENT' || quote.status === 'NEGOTIATION');
  const isResolved = quote && (quote.status === 'QUOTE_ACCEPTED' || quote.status === 'CLOSED_LOST');

  const handleAccept = async () => {
    if (!quote || !reference) return;

    const confirmed = await showConfirm({
      title: 'Accept This Quote?',
      message: `You are accepting the quote for MK ${(quote.quotedPrice || quote.car.basePrice).toLocaleString()}. The GaliMotors team will contact you to proceed with the purchase.`,
      confirmLabel: 'Yes, Accept Quote',
      cancelLabel: 'Cancel',
      variant: 'success',
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await api.post(`/leads/quote/${reference}/accept`);
      await fetchQuote();
      await showAlert({
        title: 'Quote Accepted! 🎉',
        message: 'We will contact you shortly to proceed with the purchase.',
        variant: 'success',
      });
    } catch (err: any) {
      await showAlert({
        title: 'Action Failed',
        message: err.response?.data?.message || 'Failed to accept quote. Please try again or contact us directly.',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!quote || !reference) return;

    const confirmed = await showConfirm({
      title: 'Decline This Quote?',
      message: 'Are you sure you want to decline? You can always browse other vehicles on our website.',
      confirmLabel: 'Yes, Decline',
      cancelLabel: 'Go Back',
      variant: 'danger',
    });
    if (!confirmed) return;

    setActionLoading(true);
    try {
      await api.post(`/leads/quote/${reference}/decline`, { reason: 'Customer declined via quote page' });
      await fetchQuote();
      await showAlert({
        title: 'Quote Declined',
        message: 'Thank you for your response. Feel free to browse other vehicles on our website.',
        variant: 'info',
      });
    } catch (err: any) {
      await showAlert({
        title: 'Action Failed',
        message: err.response?.data?.message || 'Failed to decline quote.',
        variant: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quote || !reference) return;

    if (!replyForm.counterPrice && !replyForm.counterMessage) {
      await showAlert({
        title: 'Empty Reply',
        message: 'Please enter a counter price or a message.',
        variant: 'warning',
      });
      return;
    }

    setSubmittingReply(true);
    try {
      const response = await api.post(`/leads/quote/${reference}/counter-offer`, {
        counterPrice: replyForm.counterPrice ? parseFloat(replyForm.counterPrice) : undefined,
        counterTerms: replyForm.counterTerms || undefined,
        counterMessage: replyForm.counterMessage || undefined,
      });

      setReplyForm({ counterPrice: '', counterTerms: '', counterMessage: '' });
      setShowReplyForm(false);
      await fetchQuote();
      
      if (response.data.whatsappUrl) {
        const confirmed = await showConfirm({
          title: 'Reply Submitted! 💬',
          message: 'Your counter-offer has been saved. Would you like to also send this directly to our WhatsApp for a faster response?',
          confirmLabel: 'Send via WhatsApp',
          cancelLabel: 'Close',
          variant: 'success',
        });
        if (confirmed) {
          window.open(response.data.whatsappUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        await showAlert({
          title: 'Reply Sent! 💬',
          message: 'Your counter-offer has been submitted. The GaliMotors team will review and respond shortly.',
          variant: 'success',
        });
      }
    } catch (err: any) {
      await showAlert({
        title: 'Failed to Send',
        message: err.response?.data?.message || 'Failed to submit reply. Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  // Render a conversation bubble
  const renderBubble = (entry: ConversationEntry) => {
    const isAdmin = entry.sender === 'admin';
    return (
      <div key={entry.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-4 animate-fade-up`}>
        <div className={`max-w-[80%] ${isAdmin ? 'order-2' : 'order-1'}`}>
          {/* Sender label */}
          <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? '' : 'justify-end'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isAdmin ? 'bg-dark text-white' : 'bg-coral text-white'}`}>
              {isAdmin ? <Store size={11} /> : <User size={11} />}
            </div>
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              {entry.senderName}
            </span>
            <span className="text-[9px] text-text-tertiary">
              {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Bubble */}
          <div className={`rounded-2xl px-4 py-3 shadow-sm ${
            isAdmin
              ? 'bg-white border border-border/60 rounded-tl-md'
              : 'bg-coral text-white rounded-tr-md'
          }`}>
            {/* Price tag if present */}
            {entry.offeredPrice && (
              <div className={`flex items-baseline gap-1.5 mb-2 pb-2 border-b ${isAdmin ? 'border-border/60' : 'border-white/20'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isAdmin ? 'text-text-tertiary' : 'text-white/70'}`}>
                  {entry.type === 'ADMIN_QUOTE' ? 'Quoted Price' : entry.type === 'ADMIN_COUNTER_RESPONSE' ? 'Our Offer' : 'Counter Price'}
                </span>
                <span className={`text-lg font-extrabold ${isAdmin ? 'text-gold-dark' : 'text-white'}`}>
                  MK {entry.offeredPrice.toLocaleString()}
                </span>
              </div>
            )}

            {/* Terms if present */}
            {entry.proposedTerms && (
              <div className={`mb-2 text-[11px] font-semibold ${isAdmin ? 'text-dark' : 'text-white/90'}`}>
                💳 {entry.proposedTerms}
              </div>
            )}

            {/* Message */}
            {entry.message && (
              <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isAdmin ? 'text-text-primary' : 'text-white'}`}>
                {entry.message}
              </p>
            )}

            {/* Status badge for special entries */}
            {(entry.type === 'QUOTE_ACCEPTED' || entry.type === 'QUOTE_DECLINED') && (
              <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                entry.type === 'QUOTE_ACCEPTED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {entry.type === 'QUOTE_ACCEPTED' ? <Check size={12} /> : <X size={12} />}
                {entry.type === 'QUOTE_ACCEPTED' ? 'Accepted' : 'Declined'}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-gray-200 border-t-coral rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-text-secondary">Loading your quote...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-border">
            <X size={32} className="text-text-tertiary" />
          </div>
          <h1 className="text-xl font-bold text-dark mb-2">Quote Not Found</h1>
          <p className="text-sm text-text-secondary mb-6">{error || 'The quote you are looking for does not exist or has expired.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Browse Cars
          </button>
        </div>
      </div>
    );
  }

  const primaryImage = getPrimaryImage(quote.car.images);
  const displayPrice = quote.quotedPrice || quote.car.basePrice;
  // import.meta.env, not process.env — `process` is undefined in the browser
  // bundle and Vite adds no polyfill, so the old form threw a ReferenceError
  // and blanked this page whenever whatsappNumber was empty.
  const dealershipWhatsApp = whatsappNumber || import.meta.env.VITE_ADMIN_WHATSAPP || '265990000000';

  // Arrive in the chat with the quote already identified, so the customer
  // does not have to explain which vehicle they are calling about.
  const whatsappHref = `https://wa.me/${dealershipWhatsApp}?text=${encodeURIComponent(
    `Hi GaliMotors, I'm contacting you about quote ${quote.referenceNumber} for the ${quote.car.title}.`
  )}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-secondary hover:bg-gray-200 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-dark">Quote Negotiation</h1>
              <span className="text-[10px] font-semibold text-gold-dark uppercase tracking-wider">Ref: {quote.referenceNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider ${
              quote.status === 'QUOTE_ACCEPTED' ? 'bg-green-50 text-green-700 border border-green-200' :
              quote.status === 'CLOSED_LOST' ? 'bg-red-50 text-red-600 border border-red-200' :
              quote.status === 'NEGOTIATION' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {quote.status === 'QUOTE_SENT' ? 'Awaiting Response' :
               quote.status === 'NEGOTIATION' ? 'Negotiating' :
               quote.status === 'QUOTE_ACCEPTED' ? 'Accepted' :
               quote.status === 'CLOSED_LOST' ? 'Closed' :
               quote.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Conversation Trail */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Car Summary Card */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4 mb-4 flex items-center gap-4">
              <div className="w-20 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                {primaryImage ? (
                  <img
                    src={getCloudinaryThumbnail(primaryImage.url, 200)}
                    alt={quote.car.title}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car size={24} className="text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-dark truncate">{quote.car.title}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  {quote.car.year && <span className="text-[11px] text-text-secondary">{quote.car.year}</span>}
                  {quote.car.mileage && <span className="text-[11px] text-text-secondary">{quote.car.mileage.toLocaleString()} km</span>}
                  {quote.car.transmission && <span className="text-[11px] text-text-secondary">{quote.car.transmission === 'AUTOMATIC' ? 'Auto' : 'Manual'}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Current Price</p>
                <p className="text-lg font-extrabold text-gold-dark">MK {displayPrice.toLocaleString()}</p>
              </div>
            </div>

            {/* Conversation Trail */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/20">
                <h3 className="text-[11px] font-extrabold text-dark uppercase tracking-widest">Conversation</h3>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-1 max-h-[500px] custom-scrollbar bg-gray-50/50">
                {quote.conversation && quote.conversation.length > 0 ? (
                  <>
                    {quote.conversation.map(renderBubble)}
                    <div ref={chatEndRef} />
                  </>
                ) : (
                  <div className="text-center py-10">
                    <MessageSquare size={32} className="text-text-tertiary mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-semibold text-text-secondary">No conversation yet</p>
                  </div>
                )}
              </div>

              {/* Reply Input Area */}
              {canTakeAction && (
                <div className="border-t border-border/60 bg-white p-4">
                  {!showReplyForm ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowReplyForm(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
                      >
                        <Send size={14} /> Reply / Counter-Offer
                      </button>
                      <button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="px-5 py-3 bg-green-600 hover:bg-green-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm disabled:opacity-50"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={handleDecline}
                        disabled={actionLoading}
                        className="px-5 py-3 bg-white border border-border hover:bg-muted text-text-secondary font-bold text-sm rounded-xl transition-colors disabled:opacity-50"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReply} className="space-y-3 animate-fade-up">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Your Counter Price (MK)</label>
                          <input
                            type="number"
                            value={replyForm.counterPrice}
                            onChange={(e) => setReplyForm(p => ({ ...p, counterPrice: e.target.value }))}
                            className="w-full mt-1 p-2.5 border border-border rounded-xl text-sm font-semibold focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                            placeholder={`e.g., ${Math.round(displayPrice * 0.9).toLocaleString()}`}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Payment Terms</label>
                          <input
                            type="text"
                            value={replyForm.counterTerms}
                            onChange={(e) => setReplyForm(p => ({ ...p, counterTerms: e.target.value }))}
                            className="w-full mt-1 p-2.5 border border-border rounded-xl text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                            placeholder="e.g., 30% now, 70% delivery"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Message</label>
                        <textarea
                          rows={2}
                          value={replyForm.counterMessage}
                          onChange={(e) => setReplyForm(p => ({ ...p, counterMessage: e.target.value }))}
                          className="w-full mt-1 p-2.5 border border-border rounded-xl text-sm resize-none focus:border-coral focus:ring-1 focus:ring-coral outline-none"
                          placeholder="Add any comments or questions..."
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={submittingReply}
                          className="flex-1 py-2.5 bg-coral hover:bg-coral-dark text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {submittingReply ? 'Sending...' : <><Send size={14} /> Send Reply</>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReplyForm(false)}
                          className="px-4 py-2.5 border border-border bg-white hover:bg-muted text-text-primary font-semibold text-sm rounded-xl transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Resolved state */}
              {isResolved && (
                <div className={`border-t px-5 py-4 flex items-center gap-3 ${
                  quote.status === 'QUOTE_ACCEPTED' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-border/60'
                }`}>
                  {quote.status === 'QUOTE_ACCEPTED' ? (
                    <>
                      <Check size={18} className="text-green-600 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-green-900">Quote Accepted</p>
                        <p className="text-[11px] text-green-700">The GaliMotors team will be in touch to finalize the deal.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <X size={18} className="text-gray-500 shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-gray-700">Quote Closed</p>
                        <p className="text-[11px] text-gray-500">This negotiation has been concluded.</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column — Car Details & Contact */}
          <div className="space-y-4">
            {/* Car Image */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                {primaryImage ? (
                  <img
                    src={getCloudinaryThumbnail(primaryImage.url, 600)}
                    alt={quote.car.title}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Car size={48} className="text-text-tertiary" />
                  </div>
                )}
              </div>

              {/* Car Specs */}
              <div className="p-4 space-y-3">
                <h3 className="text-base font-bold text-dark">{quote.car.title}</h3>
                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  {quote.car.year && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Year</span>
                      <p className="font-bold text-dark">{quote.car.year}</p>
                    </div>
                  )}
                  {quote.car.mileage && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Mileage</span>
                      <p className="font-bold text-dark">{quote.car.mileage.toLocaleString()} km</p>
                    </div>
                  )}
                  {quote.car.fuelType && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Fuel</span>
                      <p className="font-bold text-dark">{quote.car.fuelType}</p>
                    </div>
                  )}
                  {quote.car.transmission && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Transmission</span>
                      <p className="font-bold text-dark">{quote.car.transmission === 'AUTOMATIC' ? 'Automatic' : 'Manual'}</p>
                    </div>
                  )}
                  {quote.car.condition && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Condition</span>
                      <p className="font-bold text-dark">{quote.car.condition}</p>
                    </div>
                  )}
                  {quote.car.district && (
                    <div>
                      <span className="text-text-tertiary font-semibold">Location</span>
                      <p className="font-bold text-dark">{quote.car.district}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-5">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider">Listed Price</span>
                  <span className="text-sm font-semibold text-text-secondary">MK {quote.car.basePrice.toLocaleString()}</span>
                </div>
                {quote.quotedPrice && quote.quotedPrice !== quote.car.basePrice && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/60">
                    <span className="text-[11px] font-bold text-gold-dark uppercase tracking-wider">Quoted Price</span>
                    <span className="text-lg font-extrabold text-gold-dark">MK {quote.quotedPrice.toLocaleString()}</span>
                  </div>
                )}
                {quote.lastCounterOfferPrice && (
                  <div className="flex justify-between items-center pt-2 border-t border-border/60">
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Your Last Offer</span>
                    <span className="text-base font-bold text-amber-700">MK {quote.lastCounterOfferPrice.toLocaleString()}</span>
                  </div>
                )}
                {quote.paymentTerms && (
                  <div className="pt-2 border-t border-border/60">
                    <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Payment Terms</span>
                    <p className="text-[12px] font-medium text-text-primary mt-0.5">{quote.paymentTerms}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Options */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-5 space-y-3">
              <p className="text-[10px] font-extrabold text-text-tertiary uppercase tracking-widest">Need Help?</p>
              <a
                href={phoneLink || `tel:+${dealershipWhatsApp}`}
                className="w-full flex items-center justify-center gap-2 py-3 border border-border hover:bg-muted rounded-xl text-text-primary font-bold text-sm transition-colors"
              >
                <Phone size={16} className="text-gold-dark" />
                Call GaliMotors
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 bg-dark hover:bg-coral-dark rounded-xl text-white font-bold text-sm transition-colors [&>svg]:text-[#25D366]"
              >
                <MessageSquare size={16} />
                WhatsApp GaliMotors
              </a>
            </div>

            {/* Quote Meta */}
            {quote.quoteSentAt && (
              <div className="text-center">
                <p className="text-[10px] text-text-tertiary font-medium flex items-center justify-center gap-1.5">
                  <Calendar size={12} />
                  Quote sent {new Date(quote.quoteSentAt).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteView;
