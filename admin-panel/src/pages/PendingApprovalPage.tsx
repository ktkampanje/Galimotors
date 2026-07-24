import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { CheckCircle, XCircle, Eye, Calendar, User, Gauge } from 'lucide-react';

interface PendingCar {
  id: string;
  title: string;
  basePrice: number;
  year: number;
  mileage: number;
  maker: { name: string };
  model: { name: string };
  bodyType: { name: string };
  seller: { name: string; phone: string; sellerType: string };
  images: { url: string; isPrimary: boolean }[];
  createdAt: string;
}

import { useModal } from '../components/ui/ModalContext';

const PendingApprovalPage = () => {
  const { showAlert, showConfirm } = useModal();
  const [cars, setCars] = useState<PendingCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPendingCars();
  }, []);

  const fetchPendingCars = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/cars/pending-approval`);
      setCars(response.data);
    } catch (error) {
      console.error('Failed to fetch pending cars:', error);
      await showAlert({
        title: 'Network Error',
        message: 'Failed to synchronize with the approval queue.',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

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
      fetchPendingCars();
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
      fetchPendingCars();
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

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-gray-100 pb-6 pt-2">
        <h1 className="text-2xl font-black tracking-tight text-gray-900 border-l-[3px] border-coral pl-3">
          Pending Approval
        </h1>
        <p className="text-sm text-gray-500 font-medium pl-3">
          Review and approve car listings submitted by sellers and market attendants
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Pending Review</p>
              <p className="text-3xl font-black text-gray-900 mt-1">{cars.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gold-light flex items-center justify-center">
              <CheckCircle size={24} className="text-gold-dark" />
            </div>
          </div>
        </div>
      </div>

      {/* Cars List */}
      {cars.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">All Caught Up!</h3>
          <p className="text-sm text-gray-500">No car listings pending approval at the moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {cars.map((car) => (
            <div key={car.id} className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex gap-6">
                {/* Car Image */}
                <div className="w-48 h-32 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {car.images[0] ? (
                    <img 
                      src={car.images[0].url} 
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
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{car.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {car.maker.name} {car.model.name} • {car.bodyType.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-coral">
                        MK {car.basePrice.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                      <span className="text-gray-600">{car.seller.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold">
                        {car.seller.sellerType}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
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
