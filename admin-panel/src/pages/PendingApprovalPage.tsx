import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { CheckCircle, XCircle, Eye, Calendar, User, Gauge, Tag, Store } from 'lucide-react';
import { useModal } from '../components/ui/ModalContext';

/**
 * The two admin gates of the seller/attendant workflow:
 *  1. New Listings — a submitted car is invisible to customers until approved.
 *  2. Sold Requests — a seller saying "it's sold" doesn't pull the car off
 *     the site; the admin confirms the sale here, and only then does the car
 *     become SOLD and leave the storefront.
 */

interface PendingCar {
  id: string;
  title: string;
  basePrice: number;
  year: number;
  mileage: number;
  maker: { name: string };
  model: { name: string };
  bodyType?: { name: string };
  seller: { name: string; phone: string; sellerType?: string };
  market?: { name: string } | null;
  images: { url: string; isPrimary: boolean }[];
  createdAt: string;
  soldRequestedAt?: string | null;
  soldRequestedByName?: string | null;
}

const PendingApprovalPage = () => {
  const { showAlert, showConfirm } = useModal();
  const [tab, setTab] = useState<'listings' | 'sold'>('listings');
  const [cars, setCars] = useState<PendingCar[]>([]);
  const [soldRequests, setSoldRequests] = useState<PendingCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchQueues = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, soldRes] = await Promise.all([
        api.get('/cars/pending-approval'),
        api.get('/cars/sold-requests'),
      ]);
      setCars(pendingRes.data);
      setSoldRequests(soldRes.data);
    } catch (error) {
      console.error('Failed to fetch approval queues:', error);
      await showAlert({
        title: 'Network Error',
        message: 'Failed to synchronize with the approval queue.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchQueues(); }, [fetchQueues]);

  const handleApprove = async (carId: string) => {
    const confirmed = await showConfirm({
      title: 'Approve Listing',
      message: 'This vehicle will be immediately visible to all customers on the platform. Proceed?',
      variant: 'success',
      confirmLabel: 'Approve Car'
    });
    if (!confirmed) return;

    setProcessing(carId);
    try {
      await api.post(`/cars/${carId}/approve`, {});
      await showAlert({
        title: 'Car Approved',
        message: 'The listing is now active and public.',
        variant: 'success'
      });
      fetchQueues();
    } catch (error) {
      console.error('Failed to approve car:', error);
      await showAlert({
        title: 'Action Failed',
        message: 'Could not approve the vehicle listing.',
        variant: 'error'
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (carId: string) => {
    const confirmed = await showConfirm({
      title: 'Reject Listing',
      message: 'Are you sure you want to reject this submission? It will be sent back to the seller.',
      variant: 'danger',
      confirmLabel: 'Reject Submission'
    });
    if (!confirmed) return;

    setProcessing(carId);
    try {
      await api.post(`/cars/${carId}/reject`, { reason: 'Rejected by admin' });
      await showAlert({
        title: 'Submission Rejected',
        message: 'The listing has been flagged and removed from the queue.',
        variant: 'info'
      });
      fetchQueues();
    } catch (error) {
      console.error('Failed to reject car:', error);
      await showAlert({
        title: 'Action Failed',
        message: 'Could not reject the car listing.',
        variant: 'error'
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleApproveSold = async (car: PendingCar) => {
    const confirmed = await showConfirm({
      title: 'Confirm Sale',
      message: `Confirm that "${car.title}" has been sold? It will be marked SOLD and removed from the storefront.`,
      variant: 'success',
      confirmLabel: 'Confirm Sale'
    });
    if (!confirmed) return;

    setProcessing(car.id);
    try {
      await api.post(`/cars/${car.id}/approve-sold`, {});
      await showAlert({
        title: 'Sale Confirmed',
        message: 'The car is now marked as sold and no longer listed.',
        variant: 'success'
      });
      fetchQueues();
    } catch (error: any) {
      await showAlert({
        title: 'Action Failed',
        message: error?.response?.data?.message || 'Could not confirm the sale.',
        variant: 'error'
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSold = async (car: PendingCar) => {
    const confirmed = await showConfirm({
      title: 'Decline Sold Request',
      message: `Decline the sold request for "${car.title}"? The listing stays live on the site.`,
      variant: 'danger',
      confirmLabel: 'Decline Request'
    });
    if (!confirmed) return;

    setProcessing(car.id);
    try {
      await api.post(`/cars/${car.id}/reject-sold`, {});
      await showAlert({
        title: 'Request Declined',
        message: 'The listing remains live. The seller can ask again if it does sell.',
        variant: 'info'
      });
      fetchQueues();
    } catch (error: any) {
      await showAlert({
        title: 'Action Failed',
        message: error?.response?.data?.message || 'Could not decline the request.',
        variant: 'error'
      });
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-coral rounded-full animate-spin" />
          <span className="text-sm font-medium text-gray-500">Loading pending approvals...</span>
        </div>
      </div>
    );
  }

  const activeList = tab === 'listings' ? cars : soldRequests;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-6 pt-2">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 border-l-[3px] border-coral pl-3">
          Pending Approval
        </h1>
        <p className="text-sm text-gray-500 font-medium pl-3">
          New listings and sold confirmations submitted by sellers and market attendants
        </p>
      </div>

      {/* Queue tabs */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setTab('listings')}
          className={`px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
            tab === 'listings' ? 'bg-coral text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-coral/40'
          }`}
        >
          New Listings ({cars.length})
        </button>
        <button
          onClick={() => setTab('sold')}
          className={`px-4 py-2.5 rounded-lg text-[13px] font-bold transition-colors ${
            tab === 'sold' ? 'bg-coral text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-coral/40'
          }`}
        >
          Sold Requests ({soldRequests.length})
        </button>
      </div>

      {/* Queue list */}
      {activeList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-sm text-gray-500">
            {tab === 'listings'
              ? 'No car listings pending approval at the moment.'
              : 'No sold requests waiting for confirmation.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeList.map((car) => (
            <div key={car.id} className="bg-white rounded-xl border border-gray-100 p-4 md:p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col sm:flex-row gap-4 md:gap-6">
                {/* Car Image */}
                <div className="w-full sm:w-48 h-40 sm:h-32 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {car.images[0] ? (
                    <img
                      src={(car.images.find(i => i.isPrimary) || car.images[0]).url}
                      alt={car.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Eye size={32} />
                    </div>
                  )}
                </div>

                {/* Car Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{car.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {car.maker?.name} {car.model?.name}{car.bodyType ? ` • ${car.bodyType.name}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl md:text-2xl font-black text-coral">
                        MK {car.basePrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar size={16} className="text-gray-400" />
                      <span className="text-gray-600">{car.year}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Gauge size={16} className="text-gray-400" />
                      <span className="text-gray-600">{car.mileage?.toLocaleString()} km</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User size={16} className="text-gray-400" />
                      <span className="text-gray-600">{car.seller?.name}</span>
                    </div>
                    {car.market?.name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Store size={16} className="text-gray-400" />
                        <span className="text-gray-600">{car.market.name}</span>
                      </div>
                    )}
                  </div>

                  {tab === 'sold' && (
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-gold-light border border-gold/30 rounded-lg">
                      <Tag size={14} className="text-gold-dark shrink-0" />
                      <p className="text-xs font-semibold text-gold-dark">
                        {car.soldRequestedByName || 'The seller'} reports this car as sold
                        {car.soldRequestedAt ? ` — ${new Date(car.soldRequestedAt).toLocaleString()}` : ''}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 flex-wrap">
                    {tab === 'listings' ? (
                      <>
                        <button
                          onClick={() => handleApprove(car.id)}
                          disabled={processing === car.id}
                          className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success hover:brightness-110 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          {processing === car.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(car.id)}
                          disabled={processing === car.id}
                          className="flex items-center gap-2 px-4 py-2 bg-danger hover:bg-danger hover:brightness-110 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                        <span className="text-xs text-gray-500 ml-auto">
                          Submitted {new Date(car.createdAt).toLocaleDateString()}
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleApproveSold(car)}
                          disabled={processing === car.id}
                          className="flex items-center gap-2 px-4 py-2 bg-success hover:bg-success hover:brightness-110 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          <CheckCircle size={16} />
                          {processing === car.id ? 'Processing...' : 'Confirm Sale'}
                        </button>
                        <button
                          onClick={() => handleRejectSold(car)}
                          disabled={processing === car.id}
                          className="flex items-center gap-2 px-4 py-2 bg-danger hover:bg-danger hover:brightness-110 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          <XCircle size={16} />
                          Decline
                        </button>
                        <span className="text-xs text-gray-500 ml-auto">
                          Listing stays live until you confirm
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PendingApprovalPage;
