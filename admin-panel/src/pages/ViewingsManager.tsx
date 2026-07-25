import React, { useState, useEffect } from 'react';
import { Eye, Search, CheckCircle, XCircle, MapPin, Calendar, CheckSquare, X, MessageCircle, ArrowLeft, FileText } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';
import { PAID_LEAD_TYPES, leadTypeLabel } from '../lib/leadTypes';
import { buildWhatsAppUrl, phoneMatchesQuery } from '../lib/whatsapp';
import ResizableSplit from '../components/ResizableSplit';
import ViewingConversation from '../components/ViewingConversation';
import type { ViewingMessage } from '../components/ViewingConversation';
import VehicleContactsPanel from '../components/VehicleContactsPanel';
import type { ViewingCar } from '../components/VehicleContactsPanel';

interface Lead {
  id: string;
  referenceNumber: string;
  type: string;
  status: string;
  buyerName: string;
  buyerPhone: string;
  message: string;
  createdAt: string;
  buyerDistrict?: string;
  carDistrict?: string;
  roundTripDistanceKm?: number;
  calculatedTotalCost?: number;
  paymentStatus?: string;
  paymentAmount?: number;
  proofOfPaymentUrl?: string;
  car: ViewingCar;
  viewingMessages?: ViewingMessage[];
}

const STATUS_VARIANTS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-warning-light text-warning',
  VERIFIED: 'bg-success-light text-success',
  REJECTED: 'bg-danger-light text-danger',
  NEW: 'bg-muted text-dark',
  VIEWING_SCHEDULED: 'bg-coral-light text-coral',
  COMPLETED: 'bg-gray-100 text-gray-800',
};

const ViewingsManager: React.FC = () => {
  const { showAlert } = useModal();
  const [viewings, setViewings] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState('ALL');
  const [selectedViewing, setSelectedViewing] = useState<Lead | null>(null);
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // Scheduling state
  const [showSchedulingModal, setShowSchedulingModal] = useState(false);
  const [schedulingForm, setSchedulingForm] = useState({
    scheduledDate: '',
    scheduledTime: '',
    scheduledLocation: '',
    message: ''
  });
  const [isScheduling, setIsScheduling] = useState(false);

  const fetchViewings = async () => {
    try {
      // Both paid workflows belong here. Reserving a car flips its lead to
      // PAID_RESERVATION, and while this screen filtered on
      // PAID_VIEWING_REQUEST alone that lead silently dropped off this page
      // and reappeared under Customer Inquiries.
      const response = await api.get(`/leads?type=${PAID_LEAD_TYPES.join(',')}`);
      setViewings(response.data);
    } catch (error: any) {
      console.error('Failed to fetch viewings', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load viewings.';
      showAlert({ title: 'Error', message: `Failed to load viewings: ${errorMessage}`, variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViewings();
  }, []);

  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setSearchQuery(s);
      setFilterPaymentStatus('ALL');
    }
  }, [searchParams]);

  const handleVerifyPayment = async (id: string, approved: boolean, reason?: string) => {
    try {
      setIsVerifying(true);
      await api.post(`/leads/${id}/verify-payment`, {
        approved,
        rejectionReason: reason
      });
      
      showAlert({ 
        title: 'Success', 
        message: approved ? 'Payment verified successfully.' : 'Payment rejected.',
        variant: 'success' 
      });
      setShowRejectModal(false);
      setRejectionReason('');
      fetchViewings();
      if (selectedViewing?.id === id) {
        setSelectedViewing(prev => prev ? { ...prev, paymentStatus: approved ? 'VERIFIED' : 'REJECTED' } : null);
      }
    } catch (error) {
      console.error('Failed to verify payment', error);
      showAlert({ title: 'Error', message: 'Failed to update payment status.', variant: 'error' });
    } finally {
      setIsVerifying(false);
    }
  };

  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const handleSendMessage = async (message: string) => {
    if (!selectedViewing) return;
    try {
      setIsSendingMessage(true);
      const res = await api.post(`/leads/${selectedViewing.id}/viewing-respond`, { message });

      // Append locally so the reply appears immediately; the next fetch will
      // reconcile with the server's copy.
      const newMsg: ViewingMessage = res.data?.viewingMessage || res.data || {
        id: `local-${Date.now()}`,
        type: 'ADMIN_MESSAGE',
        sender: 'admin',
        message,
        createdAt: new Date().toISOString(),
      };
      setSelectedViewing(prev => prev ? {
        ...prev,
        viewingMessages: [...(prev.viewingMessages || []), newMsg],
      } : prev);
      fetchViewings();
    } catch (error) {
      console.error('Failed to send message', error);
      showAlert({ title: 'Error', message: 'Failed to send the message. Please try again.', variant: 'error' });
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedViewing || !status) return;
    try {
      setIsUpdatingStatus(true);
      await api.patch(`/leads/${selectedViewing.id}/status`, {
        status
      });

      showAlert({ title: 'Success', message: 'Viewing status updated.', variant: 'success' });
      fetchViewings();
      setSelectedViewing({ ...selectedViewing, status });
    } catch (error) {
      console.error('Failed to update status', error);
      showAlert({ title: 'Error', message: 'Failed to update status.', variant: 'error' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleScheduleViewing = async () => {
    if (!selectedViewing) return;
    
    if (!schedulingForm.scheduledDate || !schedulingForm.scheduledTime || !schedulingForm.scheduledLocation) {
      showAlert({ title: 'Missing Information', message: 'Please fill in all scheduling fields', variant: 'warning' });
      return;
    }
    
    try {
      setIsScheduling(true);

      // Add viewing message with schedule details
      await api.post(`/leads/${selectedViewing.id}/viewing-respond`, {
        message: schedulingForm.message || `Viewing scheduled for ${schedulingForm.scheduledDate} at ${schedulingForm.scheduledTime}`,
        scheduledDate: schedulingForm.scheduledDate,
        scheduledTime: schedulingForm.scheduledTime,
        scheduledLocation: schedulingForm.scheduledLocation
      });

      // Update status to VIEWING_SCHEDULED
      await api.patch(`/leads/${selectedViewing.id}/status`, {
        status: 'VIEWING_SCHEDULED'
      });
      
      showAlert({ 
        title: 'Viewing Scheduled Successfully!', 
        message: `Customer will be notified. Viewing set for ${schedulingForm.scheduledDate} at ${schedulingForm.scheduledTime}`, 
        variant: 'success' 
      });
      
      setShowSchedulingModal(false);
      setSchedulingForm({ scheduledDate: '', scheduledTime: '', scheduledLocation: '', message: '' });
      fetchViewings();
      
      if (selectedViewing) {
        setSelectedViewing({ ...selectedViewing, status: 'VIEWING_SCHEDULED' });
      }
    } catch (error: any) {
      console.error('Failed to schedule viewing', error);
      showAlert({ 
        title: 'Scheduling Failed', 
        message: error.response?.data?.message || 'Failed to schedule viewing', 
        variant: 'error' 
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const filteredViewings = viewings.filter(v => {
    const q = searchQuery.toLowerCase();
    const matchStatus = filterPaymentStatus === 'ALL' || v.paymentStatus === filterPaymentStatus;
    const matchSearch = v.buyerName.toLowerCase().includes(q) ||
                        (v.referenceNumber || '').toLowerCase().includes(q) ||
                        (v.car?.title || '').toLowerCase().includes(q) ||
                        phoneMatchesQuery(v.buyerPhone, searchQuery) ||
                        v.id.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto lg:h-[calc(100vh-80px)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Viewings Management</h1>
          <p className="text-sm text-gray-500 font-medium">Manage paid viewing requests and logistics</p>
        </div>
      </div>

      {/* Draggable divider: the list was locked at 450px, so a long car title
          or a wide detail panel had no give on either side. */}
      <ResizableSplit
        storageKey="viewings"
        fixedSide="left"
        defaultRightWidth={450}
        minRightWidth={320}
        maxRightWidth={700}
        className="flex-1 min-h-0 gap-0"
        left={
        <div className={`w-full ${selectedViewing ? "hidden lg:flex" : "flex"} flex-col gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full`}>
          <div className="p-4 border-b border-gray-100 space-y-4 shrink-0 bg-gray-50/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name, phone, reference or car..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <CustomSelect
              value={filterPaymentStatus}
              onChange={setFilterPaymentStatus}
              options={[
                { id: 'ALL', name: 'All Payments' },
                { id: 'PENDING_VERIFICATION', name: 'Pending Verification' },
                { id: 'VERIFIED', name: 'Verified' },
                { id: 'REJECTED', name: 'Rejected' },
              ]}
              placeholder="Filter by Payment"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm font-medium">Loading viewings...</div>
            ) : filteredViewings.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm font-medium bg-gray-50 rounded-xl m-2 border border-gray-100">
                No viewings found matching filters.
              </div>
            ) : (
              <div className="space-y-1.5">
                {filteredViewings.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedViewing(v)}
                    className={`w-full text-left p-4 rounded-xl transition-all border ${
                      selectedViewing?.id === v.id 
                        ? 'bg-dark text-white border-dark shadow-md' 
                        : 'bg-white border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${
                          selectedViewing?.id === v.id ? 'bg-white/20 text-white' : (STATUS_VARIANTS[v.paymentStatus || ''] || 'bg-gray-100 text-gray-600')
                        }`}>
                          {v.paymentStatus?.replace(/_/g, ' ') || 'Unpaid'}
                        </span>
                        {/* Distinguishes a reservation from a viewing now that
                            both paid workflows share this screen. */}
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${
                          selectedViewing?.id === v.id
                            ? 'bg-white/10 text-white/80'
                            : v.type === 'PAID_RESERVATION'
                              ? 'bg-coral-light text-coral'
                              : 'bg-gray-100 text-gray-600'
                        }`}>
                          {leadTypeLabel(v.type)}
                        </span>
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${selectedViewing?.id === v.id ? 'text-white/70' : 'text-gray-400'}`}>
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="font-bold text-sm mb-1 line-clamp-1">{v.buyerName}</div>
                    <div className={`text-xs font-medium line-clamp-1 mb-2 ${selectedViewing?.id === v.id ? 'text-white/80' : 'text-gray-500'}`}>
                      {v.car.title}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium opacity-80 mt-1">
                      <MapPin size={12} /> {v.buyerDistrict || 'Unknown'} → {v.carDistrict || 'Unknown'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        }
        right={
        <div className={`${selectedViewing ? "flex" : "hidden"} lg:flex flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden h-full flex-col ml-0 lg:ml-6`}>
          {selectedViewing ? (
            <div className="flex-1 overflow-y-auto">
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/30">
                <button
                  onClick={() => setSelectedViewing(null)}
                  className="lg:hidden flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 hover:text-gray-900 mb-3"
                >
                  <ArrowLeft size={15} /> Back to list
                </button>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedViewing.buyerName}</h2>
                    <p className="text-sm font-medium text-gray-500 mt-1">Ref: {selectedViewing.referenceNumber}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider ${STATUS_VARIANTS[selectedViewing.status] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedViewing.status.replace(/_/g, ' ')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Phone</span>
                    <span className="text-sm font-bold text-gray-900">{selectedViewing.buyerPhone}</span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Vehicle</span>
                    <span className="text-sm font-bold text-gray-900 truncate block">{selectedViewing.car.title}</span>
                  </div>
                </div>

                {/* Nothing is sent automatically, so the admin needs a direct
                    way to reach the customer about this specific booking. */}
                {(() => {
                  const href = buildWhatsAppUrl(
                    selectedViewing.buyerPhone,
                    `Hi ${selectedViewing.buyerName}, this is GaliMotors about your viewing ${selectedViewing.referenceNumber} for the ${selectedViewing.car.title}.`
                  );
                  return href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1fb85a] text-white font-bold text-sm rounded-xl transition-colors"
                    >
                      <MessageCircle size={16} /> WhatsApp {selectedViewing.buyerName.split(' ')[0]}
                    </a>
                  ) : (
                    <p className="mt-4 text-xs text-gray-500 text-center">
                      No usable WhatsApp number on this booking.
                    </p>
                  );
                })()}

                {/* Who holds the car — for confirming availability before
                    scheduling, without leaving this screen. */}
                <div className="mt-4">
                  <VehicleContactsPanel
                    car={selectedViewing.car}
                    reference={selectedViewing.referenceNumber}
                  />
                </div>

                {/* The customer app has had a composer all along; these
                    messages were accumulating with no admin-side reader. */}
                <div className="mt-4">
                  <ViewingConversation
                    messages={selectedViewing.viewingMessages || []}
                    customerName={selectedViewing.buyerName}
                    startedAt={selectedViewing.createdAt}
                    onSend={handleSendMessage}
                    sending={isSendingMessage}
                  />
                </div>
              </div>

              {/* Logistics & Payment */}
              <div className="p-6 md:p-8 space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <MapPin size={16} className="text-coral" /> Logistics Details
                  </h3>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 grid grid-cols-2 gap-y-4 text-sm">
                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5 text-xs">Customer District</span>
                      <span className="font-bold text-gray-900">{selectedViewing.buyerDistrict || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5 text-xs">Car District</span>
                      <span className="font-bold text-gray-900">{selectedViewing.carDistrict || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5 text-xs">Round Trip</span>
                      <span className="font-bold text-gray-900">{selectedViewing.roundTripDistanceKm || 0} km</span>
                    </div>
                    <div>
                      <span className="text-gray-500 font-medium block mb-0.5 text-xs">Calculated Fee</span>
                      <span className="font-bold text-coral">MK {selectedViewing.calculatedTotalCost?.toLocaleString() || 0}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckSquare size={16} className="text-info" /> Payment Verification
                  </h3>
                  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-xs font-medium text-gray-500 block">Status</span>
                        <span className={`text-sm font-bold ${selectedViewing.paymentStatus === 'VERIFIED' ? 'text-success' : selectedViewing.paymentStatus === 'REJECTED' ? 'text-danger' : 'text-warning'}`}>
                          {selectedViewing.paymentStatus?.replace(/_/g, ' ') || 'Pending'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-medium text-gray-500 block">Amount Paid</span>
                        <span className="text-sm font-bold text-gray-900">MK {selectedViewing.paymentAmount?.toLocaleString() || 0}</span>
                      </div>
                    </div>
                    
                    {selectedViewing.proofOfPaymentUrl ? (
                      <div className="mb-4">
                        <span className="text-xs font-medium text-gray-500 block mb-2">Proof of Payment</span>
                        {/\.pdf($|\?)/i.test(selectedViewing.proofOfPaymentUrl) ? (
                          <a href={selectedViewing.proofOfPaymentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 hover:border-gold-dark hover:bg-gold-light/30 transition-colors">
                            <FileText size={22} className="text-gold-dark shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900">PDF receipt</p>
                              <p className="text-xs text-gray-500">Tap to open the document</p>
                            </div>
                          </a>
                        ) : (
                        <a href={selectedViewing.proofOfPaymentUrl} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity">
                           <img src={selectedViewing.proofOfPaymentUrl} alt="Proof of Payment" className="w-full h-40 object-cover" />
                        </a>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg text-center text-sm font-medium text-gray-500 border border-gray-100 mb-4">
                        No proof of payment uploaded.
                      </div>
                    )}

                    {selectedViewing.paymentStatus === 'PENDING_VERIFICATION' && (
                      <div className="flex gap-3 pt-2">
                        <button 
                          onClick={() => handleVerifyPayment(selectedViewing.id, true)}
                          disabled={isVerifying}
                          className="flex-1 bg-success hover:bg-success hover:brightness-110 text-white py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16} /> Verify
                        </button>
                        <button
                          onClick={() => setShowRejectModal(true)}
                          disabled={isVerifying}
                          className="flex-1 bg-danger-light hover:bg-danger-light text-danger border border-danger-light py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    )}
                    
                    {selectedViewing.paymentStatus === 'VERIFIED' && selectedViewing.status !== 'VIEWING_SCHEDULED' && (
                      <div className="pt-2">
                        <button 
                          onClick={() => setShowSchedulingModal(true)}
                          className="w-full bg-coral hover:bg-coral/90 text-white py-2.5 rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          <Calendar size={16} /> Schedule Viewing Date & Time
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar size={16} className="text-gray-500" /> Viewing Outcome
                  </h3>

                  {/* Outcome controls instead of a free status dropdown:
                      scheduling itself must go through the Schedule modal
                      (which records date/time/location and tells the
                      customer) — the old dropdown let you set "Scheduled"
                      with none of that. */}
                  {(() => {
                    const schedMsg = [...(selectedViewing.viewingMessages || [])]
                      .reverse()
                      .find(m => m.type === 'ADMIN_VIEWING_SCHEDULED');

                    if (selectedViewing.status === 'COMPLETED') {
                      return (
                        <p className="text-sm font-semibold text-success bg-success-light px-4 py-3 rounded-lg">
                          ✓ Viewing completed. If a sale followed, mark the car as Sold in Inventory.
                        </p>
                      );
                    }
                    if (selectedViewing.status === 'CLOSED_LOST') {
                      return (
                        <p className="text-sm font-semibold text-danger bg-danger-light px-4 py-3 rounded-lg">
                          This viewing was cancelled.
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {selectedViewing.status === 'VIEWING_SCHEDULED' && schedMsg ? (
                          <div className="bg-info-light border border-info/20 px-4 py-3 rounded-lg text-sm text-info font-medium">
                            📅 Scheduled: {schedMsg.scheduledDate || '—'} at {schedMsg.scheduledTime || '—'}
                            {schedMsg.scheduledLocation ? ` · ${schedMsg.scheduledLocation}` : ''}
                          </div>
                        ) : selectedViewing.status === 'VIEWING_SCHEDULED' ? (
                          <p className="text-sm text-gray-500">A viewing has been scheduled.</p>
                        ) : (
                          <p className="text-xs text-gray-500">
                            Normal path: verify payment, then Schedule Viewing above. Use these
                            only to record how the viewing ended.
                          </p>
                        )}
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleUpdateStatus('COMPLETED')}
                            disabled={isUpdatingStatus}
                            className="flex-1 bg-success hover:brightness-110 text-white py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                          >
                            ✓ Mark Completed
                          </button>
                          <button
                            onClick={() => handleUpdateStatus('CLOSED_LOST')}
                            disabled={isUpdatingStatus}
                            className="px-5 bg-danger-light hover:bg-danger hover:text-white text-danger py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
                          >
                            Cancel Viewing
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/30">
              <Eye size={48} className="mb-4 text-gray-300" />
              <p className="text-base font-bold text-gray-600">No Viewing Selected</p>
              <p className="text-sm font-medium mt-1">Select a viewing request from the list to view logistics and verify payment.</p>
            </div>
          )}
        </div>
        }
      />

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="font-bold text-gray-900">Reject Payment</h2>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reason for rejection (sent to customer)</label>
              <textarea
                value={rejectionReason}
                onChange={e => setRejectionReason(e.target.value)}
                className="w-full h-32 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none resize-none transition-all"
                placeholder="e.g. The screenshot provided is illegible."
              />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm">
                Cancel
              </button>
              <button 
                onClick={() => handleVerifyPayment(selectedViewing!.id, false, rejectionReason)}
                disabled={!rejectionReason || isVerifying}
                className="px-5 py-2.5 rounded-xl font-bold bg-danger hover:bg-danger hover:brightness-110 text-white transition-colors text-sm shadow-md shadow-danger/20 disabled:opacity-50"
              >
                {isVerifying ? 'Rejecting...' : 'Reject Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Viewing Modal */}
      {showSchedulingModal && selectedViewing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-coral/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-coral/10 rounded-full flex items-center justify-center">
                  <Calendar size={20} className="text-coral" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Schedule Viewing</h2>
                  <p className="text-xs text-gray-500 font-medium">{selectedViewing.buyerName} • {selectedViewing.car.title}</p>
                </div>
              </div>
              <button onClick={() => setShowSchedulingModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Viewing Date</label>
                <input
                  type="date"
                  value={schedulingForm.scheduledDate}
                  onChange={e => setSchedulingForm({...schedulingForm, scheduledDate: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-coral focus:ring-1 focus:ring-coral outline-none transition-all"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Viewing Time</label>
                <input
                  type="time"
                  value={schedulingForm.scheduledTime}
                  onChange={e => setSchedulingForm({...schedulingForm, scheduledTime: e.target.value})}
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-coral focus:ring-1 focus:ring-coral outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Meeting Location</label>
                <input
                  type="text"
                  value={schedulingForm.scheduledLocation}
                  onChange={e => setSchedulingForm({...schedulingForm, scheduledLocation: e.target.value})}
                  placeholder="e.g., GaliMotors Office, Area 47, Lilongwe"
                  className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-coral focus:ring-1 focus:ring-coral outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Additional Message (Optional)</label>
                <textarea
                  value={schedulingForm.message}
                  onChange={e => setSchedulingForm({...schedulingForm, message: e.target.value})}
                  placeholder="Any special instructions or notes for the customer..."
                  className="w-full h-24 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-coral focus:ring-1 focus:ring-coral outline-none resize-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Was "Customer will receive a WhatsApp and SMS notification".
                  No messaging provider is configured on the server, so nothing
                  is sent automatically — the admin must contact the customer. */}
              <div className="bg-warning-light p-4 rounded-xl border border-warning/20">
                <div className="flex items-start gap-2 text-xs text-warning">
                  <MessageCircle size={14} className="shrink-0 mt-0.5" />
                  <p className="font-medium">
                    This is saved to the system only — no message is sent automatically.
                    Contact the customer on WhatsApp to confirm the viewing.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setShowSchedulingModal(false)} 
                disabled={isScheduling}
                className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleScheduleViewing}
                disabled={isScheduling || !schedulingForm.scheduledDate || !schedulingForm.scheduledTime || !schedulingForm.scheduledLocation}
                className="px-6 py-2.5 rounded-xl font-bold bg-coral hover:bg-coral/90 text-white transition-colors text-sm shadow-md shadow-coral/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isScheduling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Calendar size={16} />
                    Confirm & Notify Customer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewingsManager;
