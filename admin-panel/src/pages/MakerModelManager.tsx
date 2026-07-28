import React, { useState, useEffect } from 'react';
import { Car, Plus, X, Edit, Trash2, Save, MoreHorizontal, Search, Layers } from 'lucide-react';
import { api } from '../lib/api';

interface Maker {
  id: string;
  name: string;
  logoUrl?: string;
  models: Model[];
}

interface Model {
  id: string;
  name: string;
  makerId: string;
}

import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';

const MakerModelManager: React.FC = () => {
  const { showConfirm, showAlert } = useModal();
  const { user } = useAuth();
  // Sub-admins add and fix brands/models; deleting a brand (which cascades
  // through its models) stays a super-admin action, matching the server.
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [makers, setMakers] = useState<Maker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMaker, setShowAddMaker] = useState(false);
  const [editingMaker, setEditingMaker] = useState<Maker | null>(null);
  const [editingModel, setEditingModel] = useState<{ makerId: string; model: Model | null }>({ makerId: '', model: null });

  const [makerForm, setMakerForm] = useState({ name: '', logoUrl: '' });
  const [modelForm, setModelForm] = useState({ name: '', makerId: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const fetchMakers = async () => {
    try {
      const response = await api.get('/makers');
      setMakers(response.data);
    } catch (error) {
      console.error('Failed to fetch makers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMakers();
  }, []);

  const handleCreateMaker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/makers', makerForm);
      setMakerForm({ name: '', logoUrl: '' });
      setShowAddMaker(false);
      fetchMakers();
      await showAlert({
        title: 'Brand Registered',
        message: `${makerForm.name} has been added to the system.`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to create maker', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to create brand. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleUpdateMaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaker) return;
    try {
      await api.put(`/makers/${editingMaker.id}`, makerForm);
      setEditingMaker(null);
      setMakerForm({ name: '', logoUrl: '' });
      fetchMakers();
    } catch (error) {
      console.error('Failed to update maker', error);
    }
  };

  const handleDeleteMaker = async (makerId: string) => {
    const confirmed = await showConfirm({
      title: 'Confirm Brand Deletion',
      message: 'Are you sure? This will delete all associated models and cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete Brand'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/makers/${makerId}`);
      fetchMakers();
      await showAlert({
        title: 'Brand Removed',
        message: 'The brand and its models have been deleted.',
        variant: 'info'
      });
    } catch (error) {
      console.error('Failed to delete maker', error);
      await showAlert({
        title: 'Error',
        message: 'Could not delete brand. It may be in use by active listings.',
        variant: 'error'
      });
    }
  };

  const handleCreateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/models', modelForm);
      setModelForm({ name: '', makerId: '' });
      setEditingModel({ makerId: '', model: null });
      fetchMakers();
    } catch (error) {
      console.error('Failed to create model', error);
    }
  };

  const handleUpdateModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel.model) return;
    try {
      await api.put(`/models/${editingModel.model.id}`, {
        name: modelForm.name,
        makerId: editingModel.makerId
      });
      setEditingModel({ makerId: '', model: null });
      setModelForm({ name: '', makerId: '' });
      fetchMakers();
    } catch (error) {
      console.error('Failed to update model', error);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Model',
      message: 'Are you sure you want to delete this vehicle model?',
      variant: 'danger',
      confirmLabel: 'Delete'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/models/${modelId}`);
      fetchMakers();
    } catch (error) {
      console.error('Failed to delete model', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to delete model. It might be linked to existing cars.',
        variant: 'error'
      });
    }
  };

  const startEditMaker = (maker: Maker) => {
    setEditingMaker(maker);
    setMakerForm({ name: maker.name, logoUrl: maker.logoUrl || '' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Loading makers & models...
        </div>
      </div>
    );
  }

  const filteredMakers = makers.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.models.some(model => model.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Makers & Models</h1>
          <p className="text-sm text-gray-500 font-medium">Manage vehicle brands, logs, and associated models.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-gray-200 focus-within:border-dark focus-within:ring-1 focus-within:ring-dark transition-all shadow-sm flex-1 md:w-64">
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search brands or models..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-gray-700 placeholder-gray-400" 
            />
          </div>
          <button 
            onClick={() => setShowAddMaker(true)} 
            className="btn-primary whitespace-nowrap"
          >
            <Plus size={18} />
            Add Maker
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card flex justify-between items-center group">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-500">Total Makers</span>
            <span className="text-3xl font-bold text-gray-900 tracking-tight">{makers.length}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-pharmacore-gray flex items-center justify-center text-dark group-hover:bg-pharmacore-gray transition-colors">
             <Car size={24} />
          </div>
        </div>
        <div className="stat-card flex justify-between items-center group">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-500">Total Models</span>
            <span className="text-3xl font-bold text-gray-900 tracking-tight">{makers.reduce((acc, m) => acc + m.models.length, 0)}</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-pharmacore-gray flex items-center justify-center text-dark group-hover:bg-pharmacore-gray transition-colors">
             <Layers size={24} />
          </div>
        </div>
        <div className="stat-card flex justify-between items-center group">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-gray-500">Coverage</span>
            <span className="text-3xl font-bold text-gray-900 tracking-tight">84%</span>
          </div>
          <div className="w-12 h-12 rounded-full bg-coral/10 flex items-center justify-center text-coral group-hover:bg-coral/10 transition-colors">
             <MoreHorizontal size={24} />
          </div>
        </div>
      </div>

      {/* Makers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredMakers.map((maker) => (
          <div key={maker.id} className="card-widget flex flex-col gap-0 p-0 overflow-hidden hover:-translate-y-1 transition-transform duration-300">
            {/* Card Header (Maker Info) */}
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                  {maker.logoUrl ? (
                    <img src={maker.logoUrl} alt={maker.name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <Car size={26} className="text-gray-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-gray-900">{maker.name}</h3>
                  <p className="text-xs font-medium text-gray-500">{maker.models.length} {maker.models.length === 1 ? 'Model' : 'Models'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditMaker(maker)}
                  className="p-2 rounded-lg text-gray-400 hover:text-dark hover:bg-pharmacore-gray transition-colors"
                  title="Edit Brand"
                >
                  <Edit size={16} />
                </button>
                {isSuper && (
                <button
                  onClick={() => handleDeleteMaker(maker.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-coral hover:bg-coral/10 transition-colors"
                  title="Delete Brand"
                >
                  <Trash2 size={16} />
                </button>
                )}
              </div>
            </div>

            {/* Models List */}
            <div className="p-5 flex-1 bg-gray-50/50 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Models</span>
                <button
                  onClick={() => setEditingModel({ makerId: maker.id, model: null })}
                  className="text-xs font-bold text-coral flex items-center gap-1 hover:text-coral/80 transition-colors bg-coral/10 px-2 py-1 rounded-md"
                >
                  <Plus size={14} /> Add Model
                </button>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto max-h-[180px] custom-scrollbar pr-2">
                {maker.models.map((model) => (
                  <div key={model.id} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-gray-100 shadow-sm group/model hover:border-gray-200 transition-colors">
                    <span className="text-sm font-medium text-gray-700">{model.name}</span>
                    <div className="flex gap-1 opacity-0 group-hover/model:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditingModel({ makerId: maker.id, model });
                          setModelForm({ name: model.name, makerId: maker.id });
                        }}
                        className="p-1 text-gray-400 hover:text-dark rounded"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model.id)}
                        className="p-1 text-gray-400 hover:text-coral rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                
                {editingModel.makerId === maker.id && (
                  <form onSubmit={editingModel.model ? handleUpdateModel : handleCreateModel} className="mt-2 text-sm">
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-dark p-1 pl-3 shadow-sm ring-2 ring-dark">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Model name..."
                        value={modelForm.name}
                        onChange={(e) => setModelForm({ name: e.target.value, makerId: maker.id })}
                        className="flex-1 bg-transparent border-none outline-none text-gray-800 font-medium placeholder:text-gray-400 placeholder:font-normal"
                        required
                      />
                      <button type="submit" className="p-1.5 text-white bg-dark rounded-md hover:bg-black transition-colors">
                        <Save size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingModel({ makerId: '', model: null })}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </form>
                )}

                {maker.models.length === 0 && !editingModel.makerId && (
                  <div className="py-6 text-center text-sm text-gray-400 font-medium">No models added yet</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {(showAddMaker || editingMaker) && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{editingMaker ? 'Edit Maker' : 'Add New Maker'}</h2>
                <p className="text-sm text-gray-500 font-medium mt-1">Configure vehicle brand details</p>
              </div>
              <button
                onClick={() => {
                  setShowAddMaker(false);
                  setEditingMaker(null);
                  setMakerForm({ name: '', logoUrl: '' });
                }}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={editingMaker ? handleUpdateMaker : handleCreateMaker} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Brand Name</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Toyota"
                  value={makerForm.name}
                  onChange={(e) => setMakerForm({ ...makerForm, name: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-dark focus:ring-1 focus:ring-dark transition-all font-medium text-gray-900"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Logo URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={makerForm.logoUrl}
                  onChange={(e) => setMakerForm({ ...makerForm, logoUrl: e.target.value })}
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 outline-none focus:border-dark focus:ring-1 focus:ring-dark transition-all text-gray-900"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddMaker(false);
                    setEditingMaker(null);
                  }}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 shadow-md shadow-coral/20 transition-colors"
                >
                  {editingMaker ? 'Update Mode' : 'Save Maker'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MakerModelManager;

