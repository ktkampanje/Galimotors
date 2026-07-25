import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { X, Phone, MessageSquare, Car, Calendar, Send, ArrowLeft, User, Store, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { generateCarUrl } from '../lib/seoRoutes';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { useSettings } from '../hooks/useSettings';
import { useModal } from '../components/ui/ModalContext';

interface ConversationEntry {
  id: string;
  type: string;
  sender: 'admin' | 'customer';
  /** Name of the specific team member who replied, when recorded. */
  senderName?: string | null;
  title: string;
  content?: string;
  metadata?: any;
  timestamp: string;
}

interface ViewingRequest {
  id: string;
  referenceNumber: string;
  buyerName: string;
  buyerPhone: string;
  status: string;
  paymentStatus?: string;
  paymentAmount?: number;
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
    images: Array<{ url: string; isPrimary: boolean }>;
  };
  conversation: ConversationEntry[];
}

const ViewingView: React.FC = () => {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const { showAlert } = useModal();
  const { phoneLink, whatsappNumber } = useSettings();
  
  const [viewing, setViewing] = useState<ViewingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Reply state
  const [message, setMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reference) fetchViewing();
  }, [reference]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [viewing?.conversation]);

  const fetchViewing = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/leads/viewing/${reference}`);
      setViewing(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Viewing request not found');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewing || !reference || !message.trim()) return;

    setSubmittingReply(true);
    try {
      await api.post(`/leads/viewing/${reference}/message`, {
        message: message.trim()
      });
      setMessage('');
      await fetchViewing();
    } catch (err: any) {
      await showAlert({
        title: 'Failed to Send',
        message: err.response?.data?.message || 'Failed to send message. Please try again.',
        variant: 'error',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const renderBubble = (entry: ConversationEntry) => {
    const isAdmin = entry.sender === 'admin';
    return (
      <div key={entry.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'} mb-4 animate-fade-up`}>
        <div className={`max-w-[85%] ${isAdmin ? 'order-2' : 'order-1'}`}>
          <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? '' : 'justify-end'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${isAdmin ? 'bg-dark text-white' : 'bg-coral text-white'}`}>
              {isAdmin ? <Store size={11} /> : <User size={11} />}
            </div>
            <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
              {isAdmin
                ? (entry.senderName ? `${entry.senderName} · GaliMotors` : 'GaliMotors')
                : 'You'}
            </span>
            <span className="text-[9px] text-text-tertiary">
              {new Date(entry.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          <div className={`rounded-2xl px-4 py-3 shadow-sm ${
            isAdmin
              ? 'bg-white border border-border/60 rounded-tl-md'
              : 'bg-coral text-white rounded-tr-md'
          }`}>
            
            {/* Title / Type indicator */}
            <div className={`mb-2 text-[10px] font-extrabold uppercase tracking-wider ${isAdmin ? 'text-text-tertiary' : 'text-white/80'}`}>
                {entry.title}
            </div>

            {/* Custom renders based on metadata */}
            {entry.type === 'CUSTOMER_REQUEST' && entry.metadata?.buyerDistrict && (
              <div className={`mb-3 p-3 rounded-xl ${isAdmin ? 'bg-muted/50' : 'bg-white/10'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin size={12} className={isAdmin ? 'text-text-tertiary' : 'text-white/70'} />
                  <span className={`text-[11px] font-semibold ${isAdmin ? 'text-dark' : 'text-white'}`}>
                    {entry.metadata.buyerDistrict} to {entry.metadata.carDistrict}
                  </span>
                </div>
                <div className={`text-[10px] ${isAdmin ? 'text-text-secondary' : 'text-white/80'}`}>
                  Round Trip: {entry.metadata.roundTripDistanceKm} km
                </div>
              </div>
            )}

            {entry.type === 'ADMIN_COST_QUOTE' && entry.metadata?.costBreakdown && (
              <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-border/50">
                <p className="text-[10px] font-bold text-text-tertiary mb-2 uppercase">Cost Breakdown</p>
                <div className="space-y-1 text-[11px]">
                  {entry.metadata.costBreakdown.fuelCost && (
                     <div className="flex justify-between">
                       <span className="text-text-secondary">Fuel Estimate</span>
                       <span className="font-semibold text-dark">MK {entry.metadata.costBreakdown.fuelCost.toLocaleString()}</span>
                     </div>
                  )}
                  {entry.metadata.costBreakdown.driverAllowance && (
                     <div className="flex justify-between">
                       <span className="text-text-secondary">Driver Allowance</span>
                       <span className="font-semibold text-dark">MK {entry.metadata.costBreakdown.driverAllowance.toLocaleString()}</span>
                     </div>
                  )}
                  {entry.metadata.costBreakdown.accommodation && (
                     <div className="flex justify-between">
                       <span className="text-text-secondary">Accommodation</span>
                       <span className="font-semibold text-dark">MK {entry.metadata.costBreakdown.accommodation.toLocaleString()}</span>
                     </div>
                  )}
                  <div className="flex justify-between pt-1 mt-1 border-t border-border font-bold">
                    <span className="text-text-primary">Total Payable</span>
                    <span className="text-gold-dark text-[12px]">MK {entry.metadata.costBreakdown.totalCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {entry.type === 'ADMIN_VIEWING_SCHEDULED' && entry.metadata?.scheduledDate && (
              <div className="mb-3 p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={14} className="text-green-600" />
                  <span className="text-[12px] font-bold text-green-800">Viewing Confirmed</span>
                </div>
                <div className="text-[11px] text-green-700 space-y-1">
                  <p><strong>Date:</strong> {entry.metadata.scheduledDate}</p>
                  <p><strong>Time:</strong> {entry.metadata.scheduledTime}</p>
                  <p><strong>Location:</strong> {entry.metadata.scheduledLocation}</p>
                </div>
              </div>
            )}

            {/* Message content */}
            {entry.content && (
              <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${isAdmin ? 'text-text-primary' : 'text-white'}`}>
                {entry.content}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 border-4 border-gray-200 border-t-coral rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-semibold text-text-secondary">Loading viewing details...</p>
        </div>
      </div>
    );
  }

  if (error || !viewing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-3xl shadow-sm border border-border">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-border">
            <X size={32} className="text-text-tertiary" />
          </div>
          <h1 className="text-xl font-bold text-dark mb-2">Viewing Request Not Found</h1>
          <p className="text-sm text-text-secondary mb-6">{error || 'This request does not exist or has expired.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary">Browse Cars</button>
        </div>
      </div>
    );
  }

  const primaryImage = getPrimaryImage(viewing.car.images);
  const dealershipWhatsApp = whatsappNumber || import.meta.env.VITE_ADMIN_WHATSAPP || '265990000000';

  // Identify the booking up front so the customer does not have to repeat it.
  const whatsappHref = `https://wa.me/${dealershipWhatsApp}?text=${encodeURIComponent(
    `Hi GaliMotors, I'm contacting you about viewing ${viewing.referenceNumber} for the ${viewing.car.title}.`
  )}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-text-secondary hover:bg-gray-200 transition-colors">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-sm font-bold text-dark">Viewing Request</h1>
              <span className="text-[10px] font-semibold text-gold-dark uppercase tracking-wider">Ref: {viewing.referenceNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-lg uppercase tracking-wider ${
              viewing.status === 'VIEWING_SCHEDULED' ? 'bg-green-50 text-green-700 border border-green-200' :
              viewing.status === 'CLOSED_LOST' ? 'bg-red-50 text-red-600 border border-red-200' :
              viewing.paymentStatus === 'PENDING_VERIFICATION' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {viewing.status === 'VIEWING_SCHEDULED' ? 'Scheduled' :
               viewing.paymentStatus === 'PENDING_VERIFICATION' ? 'Payment Pending' :
               viewing.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column — Conversation */}
          <div className="lg:col-span-2 flex flex-col">
            {/* Car Card */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-4 mb-4 flex items-center gap-4 cursor-pointer" onClick={() => navigate(generateCarUrl(viewing.car))}>
              <div className="w-20 h-14 rounded-xl overflow-hidden bg-muted shrink-0">
                {primaryImage ? (
                  <img
                    src={getCloudinaryThumbnail(primaryImage.url, 200)}
                    alt={viewing.car.title}
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
                <h2 className="text-sm font-bold text-dark truncate">{viewing.car.title}</h2>
                <div className="flex items-center gap-3 mt-0.5">
                  {viewing.car.year && <span className="text-[11px] text-text-secondary">{viewing.car.year}</span>}
                  {viewing.car.district && <span className="text-[11px] text-text-secondary">{viewing.car.district}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Vehicle Price</p>
                <p className="text-sm font-bold text-dark">MK {viewing.car.basePrice.toLocaleString()}</p>
              </div>
            </div>

            {/* Chat Trail */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm flex-1 flex flex-col overflow-hidden">
              <div className="px-5 py-3 border-b border-border/60 bg-muted/20">
                <h3 className="text-[11px] font-extrabold text-dark uppercase tracking-widest">Conversation & Logistics</h3>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-1 max-h-[500px] custom-scrollbar bg-gray-50/50">
                {viewing.conversation && viewing.conversation.length > 0 ? (
                  <>
                    {viewing.conversation.map(renderBubble)}
                    <div ref={chatEndRef} />
                  </>
                ) : (
                  <div className="text-center py-10">
                    <MessageSquare size={32} className="text-text-tertiary mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-semibold text-text-secondary">No messages yet</p>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-border/60 bg-white p-4">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-gray-50 border border-border rounded-xl text-sm focus:border-coral focus:ring-1 focus:ring-coral outline-none transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!message.trim() || submittingReply}
                    className="px-5 py-3 bg-coral hover:bg-coral-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            
            {/* Payment Summary */}
            <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-5">
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider mb-2">Viewing Status</h3>
                
                <div className="flex justify-between items-center py-1">
                  <span className="text-[12px] font-semibold text-text-secondary">Status</span>
                  <span className="text-[12px] font-bold text-dark">{viewing.status.replace(/_/g, ' ')}</span>
                </div>
                
                {viewing.paymentAmount && (
                  <div className="flex justify-between items-center py-1 border-t border-border/60">
                    <span className="text-[12px] font-semibold text-text-secondary">Viewing Fee</span>
                    <span className="text-[13px] font-bold text-dark">MK {viewing.paymentAmount.toLocaleString()}</span>
                  </div>
                )}
                
                {viewing.paymentStatus && (
                  <div className="flex justify-between items-center py-1 border-t border-border/60">
                    <span className="text-[12px] font-semibold text-text-secondary">Payment</span>
                    <span className={`text-[12px] font-bold ${viewing.paymentStatus === 'VERIFIED' ? 'text-green-600' : 'text-amber-600'}`}>
                        {viewing.paymentStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact */}
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
                WhatsApp Us
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewingView;
