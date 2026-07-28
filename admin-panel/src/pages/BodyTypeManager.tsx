import React, { useState, useEffect } from 'react';
import { Plus, X, Edit, Trash2, LayoutGrid, Search } from 'lucide-react';
import { api } from '../lib/api';

interface BodyType {
  id: string;
  name: string;
  iconUrl?: string;
}

import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';

const BodyTypeManager: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  // Sub-admins add and fix body types; deleting stays super-admin only,
  // matching the server (cars reference these rows).
  const isSuper = user?.role === 'SUPER_ADMIN';
  const [bodyTypes, setBodyTypes] = useState<BodyType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBodyType, setEditingBodyType] = useState<BodyType | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({ name: '', iconUrl: '' });

  const fetchBodyTypes = async () => {
    try {
      const response = await api.get('/body-types');
      setBodyTypes(response.data);
    } catch (error) {
      console.error('Failed to fetch body types', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBodyTypes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/body-types', form);
      resetForm();
      fetchBodyTypes();
      await showAlert({
        title: 'Body Type Created',
        message: 'The new vehicle classification has been added.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to create body type', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to create body type. Please try again.',
        variant: 'error'
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBodyType) return;
    try {
      await api.put(`/body-types/${editingBodyType.id}`, form);
      resetForm();
      fetchBodyTypes();
      await showAlert({
        title: 'Updated',
        message: 'Body type details have been modified.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to update body type', error);
      await showAlert({
        title: 'Update Failed',
        message: 'Could not save changes to the body type.',
        variant: 'error'
      });
    }
  };

  const handleDelete = async (bodyTypeId: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Body Type',
      message: 'Are you sure? This classification will be removed and may affect filtering for existing vehicles.',
      variant: 'danger',
      confirmLabel: 'Delete'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/body-types/${bodyTypeId}`);
      fetchBodyTypes();
      await showAlert({
        title: 'Removed',
        message: 'The body type has been deleted from the registry.',
        variant: 'info'
      });
    } catch (error) {
      console.error('Failed to delete body type', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to delete. This body type might be linked to active listings.',
        variant: 'error'
      });
    }
  };

  const startEdit = (bodyType: BodyType) => {
    setEditingBodyType(bodyType);
    setForm({ name: bodyType.name, iconUrl: bodyType.iconUrl || '' });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setForm({ name: '', iconUrl: '' });
    setEditingBodyType(null);
    setShowAddForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-sm font-medium text-gray-500 animate-pulse">
           <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
           Loading Body Types...
        </div>
      </div>
    );
  }

  const filteredTypes = bodyTypes.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Vehicle Body Types</h1>
          <p className="text-sm text-gray-500 font-medium">Manage and define car body classifications (e.g. SUV, Sedan)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-xl border border-gray-200 focus-within:border-dark focus-within:ring-1 focus-within:ring-dark transition-all w-full sm:w-64">
            <Search size={16} className="text-gray-400" />
            <input 
              type="text" 
              placeholder="Search body types..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm font-medium w-full text-gray-900 placeholder:text-gray-400" 
            />
          </div>
          <button 
            onClick={() => setShowAddForm(true)} 
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Add Type
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group bg-white">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">Total Body Types</span>
            <span className="text-2xl font-bold text-gray-900 leading-none">{bodyTypes.length}</span>
          </div>
          <div className="w-12 h-12 bg-pharmacore-gray text-dark rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <LayoutGrid size={24} />
          </div>
        </div>
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group bg-white">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-dark">Database Status</span>
            <span className="text-2xl font-bold text-gray-900 leading-none">Synced</span>
          </div>
          <div className="w-12 h-12 bg-pharmacore-gray text-dark rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <div className="w-4 h-4 bg-dark rounded-full animate-pulse shadow-md shadow-green-500/50"></div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredTypes.map((bodyType) => (
          <div key={bodyType.id} className="card-widget p-0 overflow-hidden flex flex-col group hover:-translate-y-1 transition-all cursor-pointer border border-gray-100 shadow-sm bg-white rounded-2xl">
            <div className="h-32 bg-gray-50 flex items-center justify-center relative border-b border-gray-100/50">
              {bodyType.iconUrl ? (
                <img src={bodyType.iconUrl} alt={bodyType.name} className="w-26 h-26 object-contain drop-shadow-sm group-hover:scale-110 transition-transform p-2" />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 group-hover:text-dark transition-colors shadow-sm">
                  <LayoutGrid size={36} />
                </div>
              )}
              
              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(bodyType); }}
                  className="p-2 rounded-lg bg-white text-gray-500 hover:text-dark hover:bg-pharmacore-gray border border-gray-200 shadow-sm transition-colors"
                  title="Edit Type"
                >
                  <Edit size={14} />
                </button>
                {isSuper && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(bodyType.id); }}
                  className="p-2 rounded-lg bg-white text-gray-500 hover:text-coral hover:bg-coral/10 border border-gray-200 shadow-sm transition-colors"
                  title="Delete Type"
                >
                  <Trash2 size={14} />
                </button>
                )}
              </div>
            </div>
            <div className="p-4 text-center bg-white flex-1 flex items-center justify-center">
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-dark transition-colors">{bodyType.name}</h3>
            </div>
          </div>
        ))}
        
        {filteredTypes.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100">
               <Search size={28} />
            </div>
            <div className="flex flex-col gap-1">
               <h3 className="text-sm font-bold text-gray-900">No types found</h3>
               <p className="text-xs font-medium text-gray-500">Could not find any body types matching your search.</p>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <button 
              onClick={resetForm} 
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">{editingBodyType ? 'Edit Body Type' : 'Add New Body Type'}</h2>
              <p className="text-xs font-medium text-gray-500 mt-1">Classifications group vehicles for easy client searching.</p>
            </div>

            <form onSubmit={editingBodyType ? handleUpdate : handleCreate} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Body Type Name</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. SUV, Sedan, Hatchback"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-dark focus:ring-1 focus:ring-dark transition-all font-medium text-sm text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Icon URL (Optional)</label>
                <input
                  type="text"
                  placeholder="https://example.com/icon.png"
                  value={form.iconUrl}
                  onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-dark focus:ring-1 focus:ring-dark transition-all font-medium text-sm text-gray-900 placeholder:text-gray-400"
                />
              </div>
              
              {form.iconUrl && (
                <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 border-dashed flex flex-col items-center gap-3">
                  <p className="text-xs font-semibold text-gray-500">Icon Preview</p>
                  <img src={form.iconUrl} alt="Preview" className="w-26 h-26 object-contain drop-shadow-sm" />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                >
                  {editingBodyType ? 'Save Changes' : 'Create Type'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BodyTypeManager;

