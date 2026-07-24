import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';

interface Car {
  id: string;
  title: string;
  basePrice: number;
  status: string;
  maker?: { name: string };
  model?: { name: string };
  seller: { name: string };
  createdAt: string;
}

const BulkOperations: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [cars, setCars] = useState<Car[]>([]);
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    makerId: '',
    search: ''
  });
  const [bulkAction, setBulkAction] = useState('');
  const [bulkPriceChange, setBulkPriceChange] = useState({
    type: 'percentage', // 'percentage' or 'fixed'
    value: 0,
    operation: 'increase' // 'increase' or 'decrease'
  });

  useEffect(() => {
    fetchCars();
  }, [filters]);

  const fetchCars = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.makerId) params.append('makerId', filters.makerId);
      if (filters.search) params.append('search', filters.search);
      params.append('limit', '1000'); // Get all cars for bulk operations
      
      const response = await api.get(`/cars?${params}`);
      setCars(response.data.cars || []);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch cars:', error);
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedCars.size === cars.length) {
      setSelectedCars(new Set());
    } else {
      setSelectedCars(new Set(cars.map(car => car.id)));
    }
  };

  const handleSelectCar = (carId: string) => {
    const newSelected = new Set(selectedCars);
    if (newSelected.has(carId)) {
      newSelected.delete(carId);
    } else {
      newSelected.add(carId);
    }
    setSelectedCars(newSelected);
  };

  const executeBulkAction = async () => {
    if (selectedCars.size === 0 || !bulkAction) return;

    setProcessing(true);
    try {
      const carIds = Array.from(selectedCars);

      switch (bulkAction) {
        case 'status_available':
          await api.put('/cars/bulk-update', {
            carIds,
            updates: { status: 'AVAILABLE' }
          });
          break;
        
        case 'status_hidden':
          await api.put('/cars/bulk-update', {
            carIds,
            updates: { status: 'HIDDEN' }
          });
          break;
        
        case 'status_sold':
          await api.put('/cars/bulk-update', {
            carIds,
            updates: { status: 'SOLD' }
          });
          break;
        
        case 'feature_toggle':
          await api.put('/cars/bulk-update', {
            carIds,
            updates: { isFeatured: true }
          });
          break;
        
        case 'unfeature_toggle':
          await api.put('/cars/bulk-update', {
            carIds,
            updates: { isFeatured: false }
          });
          break;
        
        case 'price_update':
          await executeBulkPriceUpdate(carIds);
          break;
        
        case 'delete': {
          const confirmed = await showConfirm({
            title: 'Bulk Deletion',
            message: `Are you sure you want to delete ${selectedCars.size} cars? This action cannot be undone.`,
            variant: 'danger',
            confirmLabel: 'Delete All'
          });
          
          if (confirmed) {
            await api.delete('/cars/bulk-delete', {
              data: { carIds }
            });
          }
          break;
        }
      }

      fetchCars();
      setSelectedCars(new Set());
      setBulkAction('');
      await showAlert({
        title: 'Bulk Action Complete',
        message: 'The requested system updates have been applied successfully.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Bulk operation failed:', error);
      await showAlert({
        title: 'Operation Failed',
        message: 'Bulk update encountered an error. Please check connectivity.',
        variant: 'error'
      });
    } finally {
      setProcessing(false);
    }
  };

  const executeBulkPriceUpdate = async (carIds: string[]) => {
    const { type, value, operation } = bulkPriceChange;
    
    if (value <= 0) {
      await showAlert({
        title: 'Invalid Input',
        message: 'Please enter a valid price change value.',
        variant: 'warning'
      });
      return;
    }

    await api.put('/cars/bulk-price-update', {
      carIds,
      priceUpdate: {
        type,
        value,
        operation
      }
    });
  };

  const exportSelectedCars = async () => {
    if (selectedCars.size === 0) {
      await showAlert({
        title: 'Selection Empty',
        message: 'Please select at least one vehicle to export.',
        variant: 'warning'
      });
      return;
    }

    const selectedCarData = cars.filter(car => selectedCars.has(car.id));
    const csvContent = generateCSV(selectedCarData);
    downloadCSV(csvContent, 'selected_cars.csv');
  };

  const generateCSV = (carData: Car[]): string => {
    const headers = ['ID', 'Title', 'Price (MK)', 'Status', 'Maker', 'Model', 'Seller', 'Created Date'];
    const rows = carData.map(car => [
      car.id,
      `"${car.title}"`,
      car.basePrice,
      car.status,
      car.maker?.name || '',
      car.model?.name || '',
      car.seller.name,
      new Date(car.createdAt).toLocaleDateString()
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return `MK ${amount.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Loading inventory...
        </div>
      </div>
    );
  }

  const statusFilterOptions = [
    { id: '', name: 'All Statuses' },
    { id: 'AVAILABLE', name: 'Available' },
    { id: 'HIDDEN', name: 'Hidden' },
    { id: 'SOLD', name: 'Sold' },
    { id: 'PENDING_APPROVAL', name: 'Pending Approval' },
  ];

  const bulkActionOptions = [
    { id: '', name: 'Select an action...' },
    { id: 'status_available', name: 'Mark as Available' },
    { id: 'status_hidden', name: 'Hide (Archive)' },
    { id: 'status_sold', name: 'Mark as Sold' },
    { id: 'feature_toggle', name: 'Feature on Homepage' },
    { id: 'unfeature_toggle', name: 'Remove from Homepage' },
    { id: 'price_update', name: 'Update Prices' },
    { id: 'delete', name: 'Delete Cars' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Bulk Operations</h1>
          <p className="text-sm text-gray-500 font-medium">Manage and modify multiple vehicles at once</p>
        </div>
      </div>

      {/* Row 1: Filters & Actions Container */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Filters Panel */}
        <div className="card-widget overflow-hidden p-0 border border-gray-100 shadow-sm flex flex-col">
           <div className="px-6 py-4 border-b border-gray-50 bg-gray-50 flex justify-between items-center">
              <h2 className="text-sm font-bold text-gray-900">Filters</h2>
              <button 
                onClick={() => setFilters({ status: '', makerId: '', search: '' })}
                className="text-xs font-semibold text-gray-500 hover:text-coral transition-colors"
              >
                Reset Filters
              </button>
           </div>
           
           <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white flex-1">
              <div className="space-y-2">
                 <label className="text-xs font-semibold text-gray-600">Status</label>
                 <CustomSelect 
                   value={filters.status}
                   onChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
                   options={statusFilterOptions}
                   placeholder="All Statuses"
                 />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-semibold text-gray-600">Search Assets</label>
                 <input
                   type="text"
                   value={filters.search}
                   onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                   className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder-gray-400"
                   placeholder="Search..."
                 />
              </div>
           </div>
        </div>

        {/* Action Panel */}
        <div className="card-widget overflow-hidden p-0 shadow-md bg-white border border-gray-200 flex flex-col">
           <div className="px-6 py-4 border-b border-gray-100 bg-pharmacore-gray flex justify-between items-center">
              <h2 className="text-sm font-bold text-dark">Actions ({selectedCars.size} selected)</h2>
           </div>
           
           <div className="p-6 flex flex-col gap-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-xs font-semibold text-gray-600">Choose Action</label>
                   <CustomSelect 
                     value={bulkAction}
                     onChange={setBulkAction}
                     options={bulkActionOptions}
                     placeholder="Select an action..."
                   />
                </div>

                <div className="flex items-end">
                  {bulkAction === 'price_update' ? (
                    <div className="flex items-center gap-2 w-full animate-in slide-in-from-left-4 duration-300 bg-gray-50 p-2 rounded-xl border border-gray-200">
                       <CustomSelect
                         value={bulkPriceChange.operation}
                         onChange={(val) => setBulkPriceChange(prev => ({ ...prev, operation: val as 'increase' | 'decrease' }))}
                         options={[
                           { id: 'increase', name: 'Add' },
                           { id: 'decrease', name: 'Sub' }
                         ]}
                         placeholder="Op"
                         className="w-24 shrink-0"
                       />
                       <input
                         type="number"
                         value={bulkPriceChange.value}
                         onChange={(e) => setBulkPriceChange(prev => ({ ...prev, value: Number(e.target.value) }))}
                         className="flex-1 min-w-0 px-3 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:border-dark outline-none text-gray-900 font-bold tabular-nums"
                         placeholder="0"
                       />
                       <CustomSelect
                         value={bulkPriceChange.type}
                         onChange={(val) => setBulkPriceChange(prev => ({ ...prev, type: val as 'percentage' | 'fixed' }))}
                         options={[
                           { id: 'percentage', name: '%' },
                           { id: 'fixed', name: 'MK' }
                         ]}
                         placeholder="Unit"
                         className="w-24 shrink-0"
                       />
                    </div>
                  ) : (
                     <button
                       onClick={exportSelectedCars}
                       disabled={selectedCars.size === 0}
                       className="btn-outline w-full py-3 text-sm font-bold"
                     >
                       Export to CSV
                     </button>
                  )}
                </div>
              </div>

              <div className="mt-auto pt-4">
                 <button
                   onClick={executeBulkAction}
                   disabled={selectedCars.size === 0 || !bulkAction || processing}
                   className={`w-full py-3 rounded-xl font-bold text-sm shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                     bulkAction === 'delete' 
                       ? 'bg-coral hover:bg-coral text-white focus:ring-coral shadow-coral/20' 
                       : 'bg-dark hover:bg-black text-white focus:ring-dark shadow-dark/20'
                   } disabled:opacity-50 disabled:cursor-not-allowed`}
                 >
                  {processing ? 'Processing...' : 'Apply Fast Action'}
                 </button>
              </div>
           </div>
        </div>
      </div>

      {/* Row 2: Master Asset Grid */}
      <div className="card-widget p-0 overflow-hidden border border-gray-100 shadow-sm bg-white">
        <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Vehicles List ({cars.length})</h2>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedCars.size === cars.length && cars.length > 0}
                onChange={handleSelectAll}
                className="w-5 h-5 rounded border-gray-300 text-dark focus:ring-dark transition-all cursor-pointer shadow-sm"
              />
              <span className="font-semibold text-gray-500 text-xs group-hover:text-gray-900 transition-colors">Select All</span>
            </label>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 tracking-wider text-left">
                <th className="px-6 py-4 w-12"></th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Listed Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cars.map((car) => (
                <tr key={car.id} className={`group hover:bg-gray-50 transition-all ${selectedCars.has(car.id) ? 'bg-pharmacore-gray/50' : ''}`}>
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedCars.has(car.id)}
                      onChange={() => handleSelectCar(car.id)}
                      className="w-5 h-5 rounded border-gray-300 text-dark focus:ring-dark transition-all cursor-pointer shadow-sm mx-auto block"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-sm text-gray-900 truncate max-w-[300px] leading-tight group-hover:text-dark transition-colors">{car.title}</span>
                      <span className="text-xs font-medium text-gray-500">Seller: {car.seller.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                       <span className="text-sm font-bold text-gray-900 leading-none">{formatCurrency(car.basePrice)}</span>
                       <span className="text-[10px] font-semibold text-gray-400">ID: #{car.id.slice(0, 6)}</span>
                    </div>
                  </td>
                   <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-md shadow-sm transition-all ${
                      car.status === 'AVAILABLE' ? 'bg-pharmacore-gray text-dark' :
                      car.status === 'SOLD' ? 'bg-gray-100 text-gray-600' :
                      car.status === 'HIDDEN' ? 'bg-gray-50 text-gray-400 border border-dash border-gray-200' :
                      'bg-coral/10 text-coral'
                    }`}>
                      {car.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                     <span className="text-sm font-medium text-gray-700">{new Date(car.createdAt).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {cars.length === 0 && (
          <div className="p-16 text-center flex flex-col items-center">
             <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mb-4 border border-gray-100">
               <span className="text-2xl font-bold">∅</span>
             </div>
             <p className="text-sm font-medium text-gray-500">No vehicles match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOperations;
