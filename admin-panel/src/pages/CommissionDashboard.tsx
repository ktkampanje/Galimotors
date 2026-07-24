import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Download, Archive, CheckCircle, Clock } from 'lucide-react';

interface CommissionData {
  total: { commission: number; sales: number };
  pending: { commission: number; sales: number };
  paid: { commission: number; sales: number };
  bySeller: Array<{
    sellerName: string;
    totalCommission: number;
    pendingCommission: number;
    paidCommission: number;
    salesCount: number;
  }>;
}

interface SoldCar {
  id: string;
  title: string;
  basePrice: number;
  commissionAmount: number;
  commissionStatus: string;
  seller: { name: string };
  updatedAt: string;
}

const CommissionDashboard: React.FC = () => {
  const [commissionData, setCommissionData] = useState<CommissionData | null>(null);
  const [soldCars, setSoldCars] = useState<SoldCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchCommissionData();
    fetchSoldCars();
  }, [dateRange]);

  const fetchCommissionData = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange.endDate) params.append('endDate', dateRange.endDate);
      
      const response = await api.get(`/analytics/revenue?${params}`);
      setCommissionData(response.data);
    } catch (error) {
      console.error('Failed to fetch commission data:', error);
    }
  };

  const fetchSoldCars = async () => {
    try {
      const response = await api.get('/cars?status=SOLD&limit=100');
      setSoldCars(response.data.cars || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch sold cars:', error);
      setLoading(false);
    }
  };

  const markCommissionPaid = async (carId: string) => {
    try {
      await api.put(`/cars/${carId}`, { commissionStatus: 'PAID' });
      fetchCommissionData();
      fetchSoldCars();
    } catch (error) {
      console.error('Failed to mark commission as paid:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return `MK ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Calculating recent revenue...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Row 1: Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Sales & Commissions</h1>
          <p className="text-sm text-gray-500 font-medium">Track financial performance, view sales, and execute payouts</p>
        </div>
        <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (dateRange.startDate) params.append('startDate', dateRange.startDate);
                if (dateRange.endDate) params.append('endDate', dateRange.endDate);
                window.open(`${api.defaults.baseURL}/analytics/export/commissions?${params}`, '_blank');
              }}
              className="btn-outline flex items-center gap-2"
            >
              <Download size={16} />
              Export Payouts
            </button>
            <button
              onClick={() => {
                const params = new URLSearchParams();
                if (dateRange.startDate) params.append('startDate', dateRange.startDate);
                if (dateRange.endDate) params.append('endDate', dateRange.endDate);
                window.open(`${api.defaults.baseURL}/analytics/export/sales?${params}`, '_blank');
              }}
              className="btn-primary flex items-center gap-2"
            >
              <Archive size={16} />
              Sales Report
            </button>
        </div>
      </div>

      {/* Row 2: Filters & Quick Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
         {/* Filter Card */}
         <div className="lg:col-span-1 card-widget p-0 border border-gray-100 shadow-sm flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
               <h3 className="text-sm font-bold text-gray-900">Filter Range</h3>
            </div>
            <div className="p-6 space-y-5 bg-white flex-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Start Date</label>
                <input
                  type="date"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">End Date</label>
                <input
                  type="date"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all text-gray-900"
                />
              </div>
              <button
                onClick={() => setDateRange({ startDate: '', endDate: '' })}
                className="w-full py-2.5 mt-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors bg-gray-50 rounded-xl"
              >
                Clear Range
              </button>
            </div>
         </div>

         {/* Stats Row */}
         <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total Revenue */}
            <div className="card-widget p-6 border-none shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-transform group">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-pharmacore-gray text-dark flex items-center justify-center">
                    <span className="font-bold">MK</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">Total Company Revenue</span>
               </div>
               <h2 className="text-3xl font-bold text-gray-900 leading-none mb-4">{commissionData ? formatCurrency(commissionData.total.commission) : 'MK 0'}</h2>
               <div className="pt-4 border-t border-gray-100 flex justify-between items-center mt-auto">
                  <span className="text-xs font-semibold text-gray-500">Total Cars Sold</span>
                  <span className="text-sm font-bold text-gray-900 px-2 py-1 bg-gray-100 rounded-md">{commissionData?.total.sales || 0}</span>
               </div>
            </div>

            {/* Pending Commissions */}
            <div className="card-widget p-6 border border-coral/50 shadow-sm flex flex-col justify-between bg-coral/10/30 hover:-translate-y-1 transition-transform group">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-coral/10 text-coral flex items-center justify-center">
                    <Clock size={20} />
                  </div>
                  <span className="text-sm font-semibold text-coral">Pending Broker Payouts</span>
               </div>
               <h2 className="text-3xl font-bold text-coral leading-none mb-4">{commissionData ? formatCurrency(commissionData.pending.commission) : 'MK 0'}</h2>
               <div className="pt-4 border-t border-coral/50/50 flex justify-between items-center mt-auto">
                  <span className="text-xs font-semibold text-coral">Awaiting Settlement</span>
                  <span className="text-sm font-bold text-coral px-2 py-1 bg-coral/10 rounded-md">{commissionData?.pending.sales || 0}</span>
               </div>
            </div>

            {/* Paid Commissions */}
            <div className="card-widget p-6 border-none bg-pharmacore-gray/50 shadow-sm flex flex-col justify-between hover:-translate-y-1 transition-transform group">
               <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-pharmacore-gray text-dark flex items-center justify-center">
                    <CheckCircle size={20} />
                  </div>
                  <span className="text-sm font-semibold text-dark">Completed Payouts</span>
               </div>
               <h2 className="text-3xl font-bold text-dark leading-none mb-4">{commissionData ? formatCurrency(commissionData.paid.commission) : 'MK 0'}</h2>
               <div className="pt-4 border-t border-gray-200/50 flex justify-between items-center mt-auto">
                  <span className="text-xs font-semibold text-dark">Successfully Paid Out</span>
                  <span className="text-sm font-bold text-dark px-2 py-1 bg-pharmacore-gray rounded-md">{commissionData?.paid.sales || 0}</span>
               </div>
            </div>
         </div>
      </div>

      {/* Row 3: Tables Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Seller Table */}
        <div className="lg:col-span-1 card-widget p-0 overflow-hidden border border-gray-100 bg-white">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
             <h3 className="text-sm font-bold text-gray-900">Broker Performance</h3>
          </div>
          <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs font-semibold text-gray-500 text-left tracking-wider">
                  <th className="px-6 py-4">Broker</th>
                  <th className="px-6 py-4">Sales</th>
                  <th className="px-6 py-4 text-right">Commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {commissionData?.bySeller.map((seller, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-gray-900 text-sm leading-tight">{seller.sellerName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-sm text-gray-500">{seller.salesCount}</td>
                    <td className="px-6 py-4 text-right font-bold text-sm text-gray-900">{formatCurrency(seller.totalCommission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Sales Master List */}
        <div className="lg:col-span-2 card-widget p-0 overflow-hidden border border-gray-100 bg-white flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
             <h3 className="text-sm font-bold text-gray-900">Recent Sales & Payouts</h3>
             <span className="text-xs font-semibold text-gray-500 px-2 py-1 bg-white border border-gray-200 rounded-md shadow-sm">{soldCars.length} completed</span>
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar min-h-[300px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-100 text-xs font-semibold text-gray-500 tracking-wider text-left">
                  <th className="px-6 py-4">Vehicle Sold</th>
                  <th className="px-6 py-4">Broker</th>
                  <th className="px-6 py-4 text-right">Price / Commission</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {soldCars.map((car) => (
                  <tr key={car.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-gray-900 leading-tight">{car.title}</span>
                        <span className="text-xs font-medium text-gray-500">Date: {new Date(car.updatedAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-md">{car.seller.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex flex-col gap-1 items-end">
                        <span className="text-sm font-bold text-gray-900 leading-none">{formatCurrency(car.basePrice)}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-dark leading-none">+{formatCurrency(car.commissionAmount || 0)}</span>
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${
                            car.commissionStatus === 'PAID' 
                              ? 'bg-pharmacore-gray text-dark'
                              : 'bg-coral/10 text-coral'
                          }`}>
                            {car.commissionStatus}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {car.commissionStatus === 'PENDING' ? (
                        <button
                          onClick={() => markCommissionPaid(car.id)}
                          className="px-4 py-2 bg-pharmacore-gray text-dark hover:bg-pharmacore-gray text-xs font-bold rounded-lg transition-colors border border-gray-200"
                        >
                          Mark as Paid
                        </button>
                      ) : (
                        <div className="flex justify-end">
                           <div className="w-8 h-8 rounded-full bg-pharmacore-gray text-dark flex items-center justify-center">
                              <CheckCircle size={16} />
                           </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {soldCars.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center gap-4">
                 <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300">
                    <span className="text-2xl font-bold">∅</span>
                 </div>
                 <div className="space-y-1">
                   <h4 className="text-sm font-bold text-gray-900">No Sales Found</h4>
                   <p className="text-xs font-medium text-gray-500">There are no closed sales in the current registry interval.</p>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommissionDashboard;

