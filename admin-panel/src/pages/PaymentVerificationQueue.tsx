import React, { useState, useEffect } from 'react';
import { CheckCircle, DollarSign, X, FileText } from 'lucide-react';
import { api } from '../lib/api';

interface PendingPayment {
  id: string;
  buyerName: string;
  buyerPhone: string;
  message: string;
  proofOfPaymentUrl: string;
  calculatedTotalCost: number;
  createdAt: string;
  car: {
    id: string;
    title: string;
    basePrice: number;
    images: { url: string }[];
  };
}

import { useModal } from '../components/ui/ModalContext';

const PaymentVerificationQueue: React.FC = () => {
  const { showAlert } = useModal();
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchPendingPayments = async () => {
    try {
      const response = await api.get('/leads/pending-payments');
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch pending payments', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const handleVerify = async (leadId: string, approved: boolean) => {
    setProcessing(true);
    try {
      await api.post(
        `/leads/${leadId}/verify-payment`,
        { approved, rejectionReason: approved ? undefined : rejectionReason }
      );
      
      await showAlert({
        title: approved ? 'Payment Verified' : 'Payment Rejected',
        message: approved 
          ? 'The funds have been confirmed and the order is ready for fulfillment.'
          : 'The proof of payment was flagged as invalid.',
        variant: approved ? 'success' : 'info'
      });
      
      setSelectedPayment(null);
      setRejectionReason('');
      fetchPendingPayments();
    } catch (error) {
       await showAlert({
        title: 'Verification Failed',
        message: 'Could not process the payment verification at this time.',
        variant: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Loading verification queue...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Payment Verification</h1>
          <p className="text-sm text-gray-500 font-medium">Review and verify proof of payments submitted by clients</p>
        </div>
        <div className="flex items-center gap-2 bg-coral/10 text-coral px-4 py-2 rounded-xl text-sm font-semibold border border-coral/50">
           <span>Total Pending:</span>
           <span>{payments.length}</span>
        </div>
      </div>

      {/* Payment List */}
      {payments.length === 0 ? (
        <div className="card-widget p-20 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-pharmacore-gray rounded-full flex items-center justify-center text-dark mb-4 shadow-sm">
            <CheckCircle size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Queue is Clear</h3>
          <p className="text-sm font-medium text-gray-500 max-w-sm">
            There are no pending proofs of payment waiting for verification at the moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="card-widget p-0 overflow-hidden flex flex-col md:flex-row hover:shadow-md transition-shadow group"
            >
              {/* Car Image Profile */}
              <div className="w-full md:w-56 h-48 bg-gray-100 shrink-0 overflow-hidden relative">
                {payment.car.images[0] ? (
                  <img
                    src={payment.car.images[0].url}
                    alt={payment.car.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50"><DollarSign size={40} strokeWidth={1} /></div>
                )}
                <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold px-2 py-1 rounded-md shadow-sm">
                  ID: #{payment.car.id.slice(0, 6)}
                </div>
              </div>

              {/* Details */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100 p-0 overflow-hidden bg-white">
                 <div className="p-6 flex flex-col justify-center">
                    <span className="text-xs font-semibold text-gray-500 mb-1">Vehicle Details</span>
                    <h4 className="text-base font-bold text-gray-900 line-clamp-2">{payment.car.title}</h4>
                    <p className="text-sm font-semibold text-gray-600 mt-2">Price: MK {Number(payment.car.basePrice).toLocaleString()}</p>
                 </div>
                 
                 <div className="p-6 flex flex-col justify-center bg-gray-50/50">
                    <span className="text-xs font-semibold text-gray-500 mb-1">Client Details</span>
                    <p className="text-base font-bold text-gray-900">{payment.buyerName}</p>
                    <p className="text-sm font-semibold text-dark mt-1">{payment.buyerPhone}</p>
                 </div>

                 <div className="p-6 flex flex-col justify-center">
                    <span className="text-xs font-semibold text-gray-500 mb-1">Payment Amount</span>
                    <h3 className="text-2xl font-bold text-gray-900">MK {(payment.calculatedTotalCost || 0).toLocaleString()}</h3>
                    <div className="flex items-center gap-2 mt-2 bg-coral/10 text-coral w-fit px-2 py-1 rounded-md text-xs font-semibold">
                       <span className="w-2 h-2 bg-coral rounded-full animate-pulse" />
                       Awaiting Verification
                    </div>
                 </div>

                 <div className="p-6 flex flex-col justify-center gap-3">
                    <button
                      onClick={() => setSelectedPayment(payment)}
                      className="btn-outline w-full text-sm py-2.5"
                    >
                      Review Payment
                    </button>
                    <button
                      onClick={() => handleVerify(payment.id, true)}
                      disabled={processing}
                      className="btn-primary w-full text-sm py-2.5 bg-dark hover:bg-black disabled:opacity-50"
                    >
                      Verify & Approve
                    </button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Audit Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in zoom-in-95 duration-300">
          <div className="bg-white max-w-5xl w-full h-[90vh] md:h-[80vh] flex flex-col shadow-2xl overflow-hidden rounded-2xl relative">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pharmacore-gray text-dark flex items-center justify-center rounded-full">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Proof of Payment Review</h2>
                  <p className="text-sm font-medium text-gray-500">Verify the transaction details below</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedPayment(null); setRejectionReason(''); }}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden w-full flex flex-col lg:flex-row bg-gray-50">
              {/* Left: Proof Viewer */}
              <div className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-gray-700">Uploaded Document</span>
                  <span className="text-xs font-semibold text-gray-500 bg-white px-2 py-1 rounded-md border border-gray-200">ID: #{selectedPayment.id.slice(0, 8)}</span>
                </div>
                
                <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex items-center justify-center relative min-h-[300px]">
                  {selectedPayment.proofOfPaymentUrl ? (
                    /\.pdf($|\?)/i.test(selectedPayment.proofOfPaymentUrl) ? (
                      <a href={selectedPayment.proofOfPaymentUrl} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-3 text-gray-600 hover:text-gray-900 transition-colors p-8">
                        <FileText size={56} className="text-gold-dark" />
                        <span className="text-sm font-bold">PDF receipt — click to open</span>
                      </a>
                    ) : (
                    <img
                      src={selectedPayment.proofOfPaymentUrl}
                      alt="Proof of Payment"
                      className="w-full h-full object-contain p-4"
                    />
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <DollarSign size={48} className="mb-4 opacity-50" />
                      <span className="text-sm font-medium">No document uploaded</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Decision Panel */}
              <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col shadow-sm z-10">
                 <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar space-y-8">
                    
                    <div className="space-y-4">
                       <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Transaction Details</h3>
                       
                       <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-1">
                          <span className="text-xs font-semibold text-gray-500">Amount Expected</span>
                          <span className="text-3xl font-bold text-gray-900">MK {(selectedPayment.calculatedTotalCost || 0).toLocaleString()}</span>
                       </div>

                       <div className="bg-white rounded-xl p-4 border border-gray-100 flex flex-col gap-1 shadow-sm">
                          <span className="text-xs font-semibold text-gray-500">Vehicle</span>
                          <span className="text-sm font-bold text-gray-900">{selectedPayment.car.title}</span>
                       </div>
                    </div>

                    <div className="space-y-4">
                       <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Client Details</h3>
                       <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3 shadow-sm">
                          <div className="flex flex-col gap-1">
                             <span className="text-xs font-semibold text-gray-500">Name</span>
                             <span className="text-sm font-bold text-gray-900">{selectedPayment.buyerName}</span>
                          </div>
                          <div className="flex flex-col gap-1 pt-3 border-t border-gray-50">
                             <span className="text-xs font-semibold text-gray-500">Phone</span>
                             <span className="text-sm font-bold text-dark">{selectedPayment.buyerPhone}</span>
                          </div>
                       </div>
                    </div>

                    <div className="space-y-3">
                       <h3 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2">Action Required</h3>
                       <div className="flex flex-col gap-2">
                          <label className="text-xs font-semibold text-gray-600">Rejection Reason (if applicable)</label>
                          <textarea
                            className="w-full border border-gray-200 rounded-xl p-3 text-sm font-medium focus:border-coral focus:ring-1 focus:ring-coral outline-none bg-white resize-none text-gray-900 transition-all placeholder:text-gray-400"
                            rows={3}
                            placeholder="Explain why this proof is invalid..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                          />
                       </div>
                    </div>
                 </div>

                 <div className="p-6 md:p-8 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
                    <button
                      className="btn-primary w-full py-3.5 text-sm bg-dark hover:bg-black shadow-md shadow-dark/20 disabled:opacity-50 flex justify-center"
                      onClick={() => handleVerify(selectedPayment.id, true)}
                      disabled={processing}
                    >
                      {processing ? 'Processing...' : 'Approve Payment'}
                    </button>
                    <button
                      className="btn-outline w-full py-3 text-sm text-coral border-coral/50 hover:bg-coral/10 hover:border-coral/50 transition-colors disabled:opacity-50"
                      onClick={() => handleVerify(selectedPayment.id, false)}
                      disabled={processing || !rejectionReason}
                    >
                      Reject Proof (Requires Reason)
                    </button>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentVerificationQueue;


