import React, { useState, useEffect, useMemo } from 'react';
import { Users, X, PhoneCall, MessageCircle, FileText, ChevronRight, Search, Filter } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';
import { INQUIRY_LEAD_TYPES } from '../lib/leadTypes';
import { buildWhatsAppUrl, phoneMatchesQuery } from '../lib/whatsapp';
import VehicleContactsPanel from '../components/VehicleContactsPanel';
import type { ViewingCar } from '../components/VehicleContactsPanel';
import ViewingConversation from '../components/ViewingConversation';
import type { ViewingMessage as ThreadMessage } from '../components/ViewingConversation';
import LeadNextStep from '../components/LeadNextStep';
import ResizableSplit from '../components/ResizableSplit';

interface Lead {
  id: string;
  referenceNumber: string; // NEW
  type: string;
  status: string;
  buyerName: string;
  buyerPhone: string;
  message: string;
  adminNotes?: string;
  leadSource: string;
  createdAt: string;
  paymentStatus?: string;
  proofOfPaymentUrl?: string;
  // Quote fields (NEW)
  adminResponse?: string;
  quotedPrice?: number;
  paymentTerms?: string;
  quoteSentAt?: string;
  customerViewedAt?: string;
  // Negotiation fields (NEW)
  negotiationStatus?: string;
  lastCounterOfferPrice?: number;
  lastCounterOfferTerms?: string;
  lastCounterOfferAt?: string;
  negotiationHistory?: Array<{
    id: string;
    type: string;
    senderName?: string | null;
    offeredPrice?: number;
    proposedTerms?: string;
    message?: string;
    status: string;
    createdAt: string;
  }>;
  viewingMessages?: Array<{
    id: string;
    type: string;
    sender: string;
    senderName?: string | null;
    message?: string;
    costBreakdown?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    scheduledLocation?: string;
    createdAt: string;
  }>;
  car: ViewingCar;
}

// One chronological thread from everything that happened on a lead: the
// original inquiry, every quote/offer/response, and any viewing messages.
// These lived in three separately rendered boxes, which made it hard for a
// second admin to reconstruct who said what, in what order.
const buildThread = (lead: Lead): ThreadMessage[] => {
  const thread: ThreadMessage[] = [];
  const vms = lead.viewingMessages || [];
  const negs = lead.negotiationHistory || [];

  // The opening message, unless it is already represented in the trail.
  const hasRequestMsg = vms.some(m => m.type === 'CUSTOMER_REQUEST');
  const dupCounter = negs.some(h => h.type === 'CUSTOMER_COUNTER' && h.message === lead.message);
  if (lead.message && !hasRequestMsg && !dupCounter) {
    thread.push({
      id: `origin-${lead.id}`,
      type: 'CUSTOMER_MESSAGE',
      sender: 'customer',
      senderName: lead.buyerName,
      message: lead.message,
      createdAt: lead.createdAt,
    });
  }

  thread.push(...vms);
  thread.push(...negs.map(h => ({
    id: h.id,
    type: h.type,
    sender: h.type.startsWith('ADMIN') ? 'admin' : 'customer',
    senderName: h.senderName,
    message: h.message,
    offeredPrice: h.offeredPrice,
    proposedTerms: h.proposedTerms,
    createdAt: h.createdAt,
  })));

  return thread; // ViewingConversation sorts by createdAt
};

const STATUS_VARIANTS: Record<string, string> = {
  NEW: 'bg-muted text-dark',
  QUOTE_SENT: 'bg-info-light text-info',
  NEGOTIATION: 'bg-warning-light text-warning',
  QUOTE_ACCEPTED: 'bg-success-light text-success',
  IN_PROGRESS: 'bg-muted text-dark',
  VIEWING_SCHEDULED: 'bg-coral-light text-coral',
  COMPLETED: 'bg-gray-100 text-gray-800',
  CLOSED_LOST: 'bg-danger-light text-danger line-through',
};

const LeadManagement: React.FC = () => {
  const { showAlert } = useModal();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Quote form state (NEW)
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteForm, setQuoteForm] = useState({
    adminResponse: '',
    quotedPrice: '',
    paymentTerms: '',
  });
  const [isSendingQuote, setIsSendingQuote] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');

  // Viewing form state (NEW)
  const [showViewingModal, setShowViewingModal] = useState(false);
  const [viewingForm, setViewingForm] = useState({
    message: '',
    scheduledDate: '',
    scheduledTime: '',
    scheduledLocation: '',
  });
  const [isSendingViewing, setIsSendingViewing] = useState(false);

  const fetchLeads = async () => {
    try {
      // Filter positively on INQUIRY rather than excluding one paid type.
      // The old `!== PAID_VIEWING_REQUEST` swept up PAID_RESERVATION too, so
      // reservations landed in this screen, whose quote and negotiation UI
      // does not apply to an already-paid reservation.
      const response = await api.get(`/leads?type=${INQUIRY_LEAD_TYPES.join(',')}`);
      setLeads(response.data);
    } catch (error) {
      console.error('Failed to fetch leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setSearchQuery(s);
      setFilterStatus('ALL');
      setFilterType('ALL');
    }
  }, [searchParams]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchStatus = filterStatus === 'ALL' || lead.status === filterStatus;
      const matchType = filterType === 'ALL' || lead.type === filterType;
      // phoneMatchesQuery tolerates format differences: leads store the local
      // 0X form, but admins paste +265… numbers straight from WhatsApp.
      const matchSearch = lead.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          phoneMatchesQuery(lead.buyerPhone, searchQuery) ||
                          (lead.referenceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (lead.car?.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          lead.id.includes(searchQuery);
      return matchStatus && matchType && matchSearch;
    });
  }, [leads, filterStatus, filterType, searchQuery]);

  // Both writers go through the same endpoint; splitting them keeps each
  // call to one intent, so a note can never silently change the status and
  // an outcome can never silently attach a stale note.
  const patchLead = async (payload: { status?: string; notes?: string }, successMsg: string) => {
    if (!selectedLead) return;
    setIsUpdating(true);
    try {
      const response = await api.patch(`/leads/${selectedLead.id}/status`, payload);
      setLeads(prev => prev.map(l => (l.id === selectedLead.id ? response.data : l)));
      setSelectedLead(response.data);
      await showAlert({ title: 'Saved', message: successMsg, variant: 'success' });
    } catch (error) {
      console.error('Failed to update lead:', error);
      await showAlert({
        title: 'Update Failed',
        message: 'Could not save. Please check your connection and try again.',
        variant: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const setLeadStatus = (status: string) =>
    patchLead(
      { status },
      status === 'COMPLETED'
        ? 'Marked as sold. Remember to set the car to Sold in Inventory.'
        : 'Lead closed.'
    );

  const saveNote = async () => {
    const note = adminNotes.trim();
    if (!note) return;
    await patchLead({ notes: note }, 'Note added.');
    setAdminNotes('');
  };

  const openLeadDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setAdminNotes('');
  };

  const statusOptions = [
    { id: 'ALL', name: 'All Statuses' },
    { id: 'NEW', name: 'New Inquiry' },
    { id: 'QUOTE_SENT', name: 'Quote Sent' },
    { id: 'NEGOTIATION', name: 'Negotiation' },
    { id: 'QUOTE_ACCEPTED', name: 'Quote Accepted' },
    { id: 'IN_PROGRESS', name: 'In Progress' },
    { id: 'VIEWING_SCHEDULED', name: 'Viewing Scheduled' },
    { id: 'COMPLETED', name: 'Completed' },
    { id: 'CLOSED_LOST', name: 'Closed / Lost' },
  ];

  const typeOptions = [
    { id: 'ALL', name: 'All Types' },
    { id: 'INQUIRY', name: 'Direct Inquiry' },
    { id: 'PAID_VIEWING_REQUEST', name: 'Viewing Request' },
  ];


  // ============== QUOTE MANAGEMENT FUNCTIONS (NEW) ============== //
  
  const openQuoteModal = (lead: Lead) => {
    setSelectedLead(lead);

    const isInitialCustomerOffer = lead.status === 'NEW' && lead.lastCounterOfferPrice;
    const isCounterResponse = lead.status === 'NEGOTIATION' && lead.lastCounterOfferPrice;
    
    const defaultPrice = (isInitialCustomerOffer || isCounterResponse) 
      ? lead.lastCounterOfferPrice?.toString() 
      : (lead.quotedPrice?.toString() || lead.car?.basePrice?.toString());

    setQuoteForm({
      adminResponse: lead.adminResponse || '',
      quotedPrice: defaultPrice || '',
      paymentTerms: lead.paymentTerms || '50% deposit, 50% on delivery',
    });
    setShowQuoteModal(true);
  };

  const handleSendQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsSendingQuote(true);
    try {
      const isNegotiating = selectedLead.status === 'NEGOTIATION';
      const endpoint = isNegotiating ? 'respond-to-counter' : 'send-quote';
      
      const payload = isNegotiating 
        ? {
            responsePrice: quoteForm.quotedPrice,
            responseTerms: quoteForm.paymentTerms,
            responseMessage: quoteForm.adminResponse,
            status: 'ACTIVE'
          }
        : quoteForm;

      const response = await api.post(
        `/leads/${selectedLead.id}/${endpoint}`,
        payload
      );

      // Update leads list
      setLeads(prev => prev.map(l => l.id === selectedLead.id ? response.data.lead : l));
      setSelectedLead(response.data.lead);
      setWhatsappMessage(response.data.whatsappMessage);

      await showAlert({
        title: 'Quote Prepared!',
        message: 'Quote saved. Copy the WhatsApp message below and send to customer.',
        variant: 'success'
      });

      // Don't close modal - show WhatsApp message for copying
    } catch (error) {
      console.error('Failed to send quote:', error);
      await showAlert({
        title: 'Failed',
        message: 'Could not prepare quote. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsSendingQuote(false);
    }
  };

  const copyWhatsAppMessage = () => {
    navigator.clipboard.writeText(whatsappMessage);
    showAlert({
      title: 'Copied!',
      message: 'WhatsApp message copied to clipboard',
      variant: 'success'
    });
  };

  const closeQuoteModal = () => {
    setShowQuoteModal(false);
    setWhatsappMessage('');
    setQuoteForm({ adminResponse: '', quotedPrice: '', paymentTerms: '' });
  };

  // ============== VIEWING MANAGEMENT FUNCTIONS (NEW) ============== //
  
  const openViewingModal = (lead: Lead) => {
    setSelectedLead(lead);
    setViewingForm({
      message: '',
      scheduledDate: '',
      scheduledTime: '',
      scheduledLocation: 'GaliMotors Dealership',
    });
    setShowViewingModal(true);
  };

  const handleSendViewingResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsSendingViewing(true);
    try {
      await api.post(
        `/leads/${selectedLead.id}/viewing-respond`,
        viewingForm
      );

      // We should ideally fetch the updated lead, but we can just append the message or refetch all
      await fetchLeads();
      
      await showAlert({
        title: 'Response Sent!',
        message: 'Your response has been sent to the customer.',
        variant: 'success'
      });

      closeViewingModal();
    } catch (error) {
      console.error('Failed to send viewing response:', error);
      await showAlert({
        title: 'Failed',
        message: 'Could not send response. Please try again.',
        variant: 'error'
      });
    } finally {
      setIsSendingViewing(false);
    }
  };

  const closeViewingModal = () => {
    setShowViewingModal(false);
    setViewingForm({ message: '', scheduledDate: '', scheduledTime: '', scheduledLocation: '' });
  };

  return (
    <>
    <ResizableSplit
      storageKey="leads"
      className="h-[calc(100vh-140px)] -m-8 overflow-hidden bg-gray-50 text-gray-900 animate-in fade-in duration-500 rounded-tl-3xl"
      defaultRightWidth={520}
      left={
      <div className="flex-1 flex flex-col bg-white shadow-sm z-10 min-h-0">
        <div className="p-8 border-b border-gray-100 bg-white">
          <div className="flex justify-between items-end mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Lead Management</h1>
              <p className="text-sm text-gray-500 font-medium">Track inquiries and manage your sales pipeline</p>
            </div>
            <div className="bg-pharmacore-gray text-dark px-4 py-2 rounded-xl text-sm font-semibold border border-gray-100">
              {filteredLeads.length} Active Leads
            </div>
          </div>
          
          <div className="flex flex-col gap-4">
             <div className="relative group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-dark transition-colors" size={18} />
               <input 
                 placeholder="Search by name, phone, reference or car..." 
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400"
               />
             </div>
             
             <div className="grid grid-cols-2 gap-4">
               <div className="relative">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" size={16} />
                  <CustomSelect 
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={statusOptions}
                    placeholder="All Statuses"
                    className="pl-8"
                  />
               </div>

               <div className="relative">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10 pointer-events-none" size={16} />
                  <CustomSelect 
                    value={filterType}
                    onChange={setFilterType}
                    options={typeOptions}
                    placeholder="All Types"
                    className="pl-8"
                  />
               </div>
             </div>
          </div>
        </div>

        {/* List content: Registry Matrix */}
        <div className="flex-1 overflow-y-auto w-full custom-scrollbar bg-gray-50">
          {loading ? (
             <div className="p-20 text-center flex flex-col items-center gap-4">
               <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
               <span className="text-sm font-semibold text-gray-400">Loading leads...</span>
             </div>
          ) : filteredLeads.length === 0 ? (
             <div className="p-20 text-center flex flex-col items-center gap-4 opacity-70">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                 <FileText size={32} className="text-gray-400" />
               </div>
               <span className="text-sm font-medium text-gray-500">No leads found matching your criteria.</span>
             </div>
          ) : (
             <table className="w-full text-left border-collapse">
               <thead>
                 <tr className="bg-white border-b border-gray-200 text-xs font-semibold uppercase tracking-wider text-gray-500">
                   <th className="px-8 py-4">Lead ID</th>
                   <th className="px-6 py-4">Client</th>
                   <th className="px-6 py-4">Vehicle Interest</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-8 py-4 text-right"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 bg-white">
                 {filteredLeads.map(lead => (
                   <tr 
                     key={lead.id} 
                     onClick={() => openLeadDetails(lead)}
                     className={`cursor-pointer group transition-all duration-200 ${selectedLead?.id === lead.id ? 'bg-pharmacore-gray shadow-inner' : 'hover:bg-gray-50'}`}
                   >
                     <td className="px-8 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-gray-500">#{lead.id.slice(0, 8)}</span>
                          {lead.referenceNumber && (
                            <span className="text-[10px] font-bold tracking-wider text-coral uppercase">{lead.referenceNumber}</span>
                          )}
                        </div>
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex flex-col gap-0.5">
                         <span className="font-semibold text-gray-900 text-sm">{lead.buyerName}</span>
                         <span className="text-xs font-medium text-gray-500">{lead.buyerPhone}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex flex-col gap-0.5">
                         <span className="font-semibold text-sm text-gray-900 truncate max-w-[200px]">{lead.car?.title || 'Unknown Vehicle'}</span>
                         <span className="text-[10px] font-bold tracking-wider uppercase text-coral">{lead.type.replace(/_/g, ' ')}</span>
                       </div>
                     </td>
                     <td className="px-6 py-4">
                       <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${STATUS_VARIANTS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                         {lead.status.replace(/_/g, ' ')}
                       </span>
                     </td>
                     <td className="px-8 py-4 text-right">
                       <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ml-auto ${selectedLead?.id === lead.id ? 'bg-pharmacore-gray text-dark' : 'bg-gray-100 text-gray-400 group-hover:bg-pharmacore-gray group-hover:text-dark'}`}>
                         <ChevronRight size={16} className={`transition-transform duration-300 ${selectedLead?.id === lead.id ? 'translate-x-0.5' : ''}`} />
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          )}
        </div>
      </div>
      }
      right={
      <div className="flex-1 flex flex-col bg-gray-50 relative z-0 min-h-0">
      {selectedLead ? (
        <div className="flex flex-col h-full animate-in slide-in-from-right duration-500">
           <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm z-10">
              <div className="flex flex-col">
                 <h2 className="text-lg font-bold text-gray-900 leading-tight">Lead Details</h2>
                 <span className="text-xs font-medium text-gray-500">Manage communication and status</span>
              </div>
              <button onClick={() => setSelectedLead(null)} className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors">
                <X size={20} />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-6 md:p-8 flex flex-col gap-6 custom-scrollbar">
              {/* Customer Identity Card */}
              <div className="card-widget p-0 border-none shadow-sm bg-white overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Customer Profile</span>
                    <h3 className="text-xl font-bold text-gray-900">{selectedLead.buyerName}</h3>
                    <p className="text-gray-600 font-medium text-sm">{selectedLead.buyerPhone}</p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-pharmacore-gray flex items-center justify-center text-dark">
                    <Users size={24} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-px bg-gray-100">
                  <a
                    href={`tel:${selectedLead.buyerPhone}`}
                    className="flex justify-center items-center gap-2 py-4 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    <PhoneCall size={16} className="text-dark" /> Call Client
                  </a>
                  {/* Rendered only when the number is usable. The unguarded
                      .replace() here threw on a lead with no phone and blanked
                      this modal. */}
                  {buildWhatsAppUrl(selectedLead.buyerPhone) ? (
                    <a
                      href={buildWhatsAppUrl(selectedLead.buyerPhone)!}
                      target="_blank" rel="noreferrer"
                      className="flex justify-center items-center gap-2 py-4 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs uppercase tracking-wider transition-colors"
                    >
                      <MessageCircle size={16} className="text-dark" /> WhatsApp
                    </a>
                  ) : (
                    <span
                      title="No usable phone number on this lead"
                      className="flex justify-center items-center gap-2 py-4 bg-white text-gray-400 font-bold text-xs uppercase tracking-wider cursor-not-allowed"
                    >
                      <MessageCircle size={16} /> No number
                    </span>
                  )}
                </div>
              </div>

              {/* Inquiry Target Info */}
              <div className="card-widget p-6 border-none shadow-sm space-y-4">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    Vehicle Interest
                  </h4>
                  
                  <div className="flex flex-col gap-1 p-4 bg-gray-50 rounded-xl border border-gray-100">
                     <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Interested In</span>
                     <h4 className="font-bold text-base text-gray-900 leading-tight">{selectedLead.car?.title || 'Unknown Vehicle'}</h4>
                     {selectedLead.car.basePrice && (
                       <span className="text-sm font-bold text-coral mt-1">Listed: MK {selectedLead.car.basePrice.toLocaleString()}</span>
                     )}
                  </div>

                  {/* Full car details + who holds it, so availability can be
                      confirmed with the seller/attendant before quoting. Also
                      carries the seller's bottom line for negotiating room. */}
                  <VehicleContactsPanel
                    car={selectedLead.car}
                    reference={selectedLead.referenceNumber}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-500">Inquiry Date</span>
                        <span className="text-sm font-bold text-gray-900">{new Date(selectedLead.createdAt).toLocaleString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                     </div>
                     <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-gray-500">Reference</span>
                        <span className="text-sm font-bold text-coral">{selectedLead.referenceNumber || 'N/A'}</span>
                     </div>
                  </div>
                  
                  {selectedLead.type === 'PAID_VIEWING_REQUEST' && (
                     <div className="px-4 py-3 bg-coral/10 text-coral text-xs font-bold uppercase tracking-wider rounded-xl border border-coral/50">
                       Payment Status: {selectedLead.paymentStatus?.replace(/_/g, ' ') || 'Awaiting Verification'}
                     </div>
                  )}
              </div>

              {/* The customer's opening message now appears as the first
                  bubble of the Conversation thread below, in order. */}

              {/* The one thing to do next, derived from the lead's state.
                  This replaced four competing boxes (ready-to-quote,
                  quote-sent, action-required, pipeline select) that each
                  claimed to be the next move. */}
              <LeadNextStep
                lead={selectedLead}
                busy={isUpdating}
                onSendQuote={() => openQuoteModal(selectedLead)}
                onRespondToOffer={() => openQuoteModal(selectedLead)}
                onScheduleViewing={() => openViewingModal(selectedLead)}
                onMarkWon={() => setLeadStatus('COMPLETED')}
                onMarkLost={() => setLeadStatus('CLOSED_LOST')}
              />

              {/* Quote on record — reference, not an action. */}
              {selectedLead.quoteSentAt && selectedLead.quotedPrice && (
                <div className="card-widget p-5 border-none shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">Quote on record</h4>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${selectedLead.customerViewedAt ? 'bg-success-light text-success' : 'bg-muted text-text-secondary'}`}>
                      {selectedLead.customerViewedAt ? 'Opened by customer' : 'Not opened yet'}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-gray-500">Quoted price</span>
                    <span className="text-lg font-black text-coral">MK {selectedLead.quotedPrice.toLocaleString()}</span>
                  </div>
                  {selectedLead.paymentTerms && (
                    <p className="text-xs text-gray-600">Terms: {selectedLead.paymentTerms}</p>
                  )}
                  <p className="text-[11px] text-gray-400">
                    Sent {new Date(selectedLead.quoteSentAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )}

              {/* Conversation — one chronological WhatsApp-style thread of the
                  inquiry, quotes, offers, responses and viewing messages, so
                  any admin can pick up where a colleague left off. */}
              {(Boolean(selectedLead.negotiationHistory?.length) ||
                Boolean(selectedLead.viewingMessages?.length) ||
                Boolean(selectedLead.message)) && (
                <div className="card-widget p-6 border-none shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900">Conversation</h4>
                    {selectedLead.negotiationStatus && (
                      <span className={`px-2 py-1 text-xs font-bold rounded ${selectedLead.negotiationStatus === 'ACTIVE' ? 'bg-warning-light text-warning' : selectedLead.negotiationStatus === 'ACCEPTED' ? 'bg-success-light text-success' : selectedLead.negotiationStatus === 'REJECTED' ? 'bg-danger-light text-danger' : 'bg-gray-100 text-gray-700'}`}>
                        {selectedLead.negotiationStatus}
                      </span>
                    )}
                  </div>

                  <ViewingConversation
                    messages={buildThread(selectedLead)}
                    customerName={selectedLead.buyerName}
                    startedAt={selectedLead.createdAt}
                    composer={false}
                    title="Full history"
                  />

                  {Boolean(selectedLead.viewingMessages?.length) && (
                    <button
                      onClick={() => openViewingModal(selectedLead)}
                      className="w-full bg-dark hover:bg-black text-white font-bold py-3 text-sm rounded-lg transition-colors"
                    >
                      Reply about the viewing
                    </button>
                  )}
                </div>
              )}

              {/* Internal notes — staff-only, never shown to the customer.
                  These used to be appended to the customer's own inquiry
                  message, so they surfaced in the thread as customer speech. */}
              <div className="card-widget p-5 space-y-3 border border-gray-200 shadow-sm bg-white">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Internal notes</h4>
                  <p className="text-[11px] text-gray-500">Only your team sees these. The customer never does.</p>
                </div>

                {selectedLead.adminNotes && (
                  <div className="bg-muted border border-border p-3 text-xs text-text-primary whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {selectedLead.adminNotes}
                  </div>
                )}

                <textarea
                  rows={3}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-dark focus:ring-1 focus:ring-dark outline-none resize-none text-sm font-medium text-gray-900 placeholder:text-gray-400 transition-all"
                  placeholder="e.g. Called at 3pm, asked for photos of the interior…"
                  value={adminNotes}
                  onChange={e => setAdminNotes(e.target.value)}
                />
                <button
                  onClick={() => saveNote()}
                  disabled={isUpdating || !adminNotes.trim()}
                  className="btn-primary w-full py-2.5 text-sm flex justify-center disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                >
                  {isUpdating ? 'Saving…' : 'Add Note'}
                </button>
              </div>

           </div>
        </div>
      ) : (
        <div className="flex-1 bg-white flex flex-col items-center justify-center text-center p-12">
           <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-6 border border-gray-100">
              <FileText size={40} />
           </div>
           <h3 className="text-lg font-bold text-gray-900 mb-2">No Lead Selected</h3>
           <p className="text-sm font-medium text-gray-500 max-w-[250px] leading-relaxed">Select a lead from the list to view details, update status, and manage communication.</p>
        </div>
      )}
      </div>
      }
      />

      {/* Quote Modal (NEW) */}
      {showQuoteModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Send Quote</h3>
                <p className="text-sm text-gray-500">to {selectedLead.buyerName}</p>
              </div>
              <button
                onClick={closeQuoteModal}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {!whatsappMessage ? (
                <form onSubmit={handleSendQuote} className="space-y-6">
                  {/* Car Info */}
                  <div className="p-4 bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vehicle</p>
                        <p className="text-base font-bold text-gray-900 mt-1">{selectedLead.car.title}</p>
                      </div>
                      {selectedLead.car.basePrice && (
                        <div className="text-right">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Listed Price</p>
                          <p className="text-base font-bold text-coral mt-1">MK {selectedLead.car.basePrice.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quoted Price */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">
                      Your Quoted Price <span className="text-coral">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">MK</span>
                      <input
                        type="number"
                        required
                        value={quoteForm.quotedPrice}
                        onChange={(e) => setQuoteForm(prev => ({ ...prev, quotedPrice: e.target.value }))}
                        className="w-full pl-14 pr-4 py-3 border border-gray-300 focus:border-success focus:ring-2 focus:ring-success-light outline-none text-lg font-bold text-gray-900"
                        placeholder="Enter amount"
                      />
                    </div>
                    <p className="text-xs text-gray-500">This can be different from the listed price for negotiation</p>
                  </div>

                  {/* Response Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">
                      Your Message <span className="text-coral">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={quoteForm.adminResponse}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, adminResponse: e.target.value }))}
                      className="w-full p-4 border border-gray-300 focus:border-success focus:ring-2 focus:ring-success-light outline-none resize-none text-sm text-gray-900"
                      placeholder="e.g., Hi! We can offer this vehicle at the quoted price. The car is in excellent condition with full service history..."
                    />
                    <p className="text-xs text-gray-500">Personal message to the customer</p>
                  </div>

                  {/* Payment Terms */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">Payment Terms</label>
                    <input
                      type="text"
                      value={quoteForm.paymentTerms}
                      onChange={(e) => setQuoteForm(prev => ({ ...prev, paymentTerms: e.target.value }))}
                      className="w-full p-3 border border-gray-300 focus:border-success focus:ring-2 focus:ring-success-light outline-none text-sm text-gray-900"
                      placeholder="e.g., 50% deposit, 50% on delivery"
                    />
                    <p className="text-xs text-gray-500">Optional payment instructions</p>
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="button"
                      onClick={closeQuoteModal}
                      className="flex-1 px-6 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSendingQuote}
                      className="flex-1 px-6 py-3 bg-success hover:bg-success hover:brightness-110 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingQuote ? 'Preparing...' : 'Prepare Quote'}
                    </button>
                  </div>
                </form>
              ) : (
                /* WhatsApp Message Ready */
                <div className="space-y-6">
                  <div className="p-4 bg-success-light border border-success-light">
                    <p className="text-sm font-bold text-success mb-2">✓ Quote Prepared Successfully!</p>
                    <p className="text-xs text-success">Copy the message below and send it to the customer on WhatsApp.</p>
                  </div>

                  {/* WhatsApp Message Preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-900">WhatsApp Message</label>
                    <div className="p-4 bg-gray-50 border border-gray-300 text-sm text-gray-900 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {whatsappMessage}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={copyWhatsAppMessage}
                      className="flex-1 px-6 py-3 bg-success hover:bg-success hover:brightness-110 text-white font-bold text-sm transition-colors"
                    >
                      📋 Copy Message
                    </button>
                    {buildWhatsAppUrl(selectedLead.buyerPhone, whatsappMessage) ? (
                      <a
                        href={buildWhatsAppUrl(selectedLead.buyerPhone, whatsappMessage)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-6 py-3 bg-[#25D366] hover:bg-[#1fb85a] text-white font-bold text-sm text-center transition-colors"
                      >
                        📱 Open WhatsApp
                      </a>
                    ) : (
                      <span className="flex-1 px-6 py-3 bg-gray-200 text-gray-500 font-bold text-sm text-center cursor-not-allowed">
                        No WhatsApp number
                      </span>
                    )}
                  </div>

                  <button
                    onClick={closeQuoteModal}
                    className="w-full px-6 py-3 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEWING MODAL */}
      {showViewingModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">Respond to Viewing Request</h3>
              <button onClick={closeViewingModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSendViewingResponse} className="p-6 overflow-y-auto space-y-5">
              
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Schedule Details (Optional)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                    <input
                      type="date"
                      value={viewingForm.scheduledDate}
                      onChange={e => setViewingForm(p => ({ ...p, scheduledDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                    <input
                      type="time"
                      value={viewingForm.scheduledTime}
                      onChange={e => setViewingForm(p => ({ ...p, scheduledTime: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location</label>
                  <input
                    type="text"
                    value={viewingForm.scheduledLocation}
                    onChange={e => setViewingForm(p => ({ ...p, scheduledLocation: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Message</label>
                <textarea
                  required
                  rows={4}
                  value={viewingForm.message}
                  onChange={e => setViewingForm(p => ({ ...p, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none transition-colors text-sm resize-none"
                  placeholder="Type your response to the customer..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeViewingModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 font-semibold rounded hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingViewing}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white font-bold rounded hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {isSendingViewing ? 'Sending...' : 'Send Response'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default LeadManagement;
