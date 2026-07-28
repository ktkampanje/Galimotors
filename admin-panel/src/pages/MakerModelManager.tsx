import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Plus, X, Edit, Trash2, Search, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import LogoUploadField from '../components/ui/LogoUploadField';

/**
 * Makers catalogue — a clean logo grid. Each tile opens the maker's own
 * page (/maker-model/:id) where its models are managed. The old page
 * crammed every maker's model list, inline forms and a fake stats strip
 * into one screen.
 */

export interface Maker {
  id: string;
  name: string;
  logoUrl?: string;
  models: { id: string; name: string; makerId: string }[];
}

/** Maker logo with a proper fallback — a broken URL shows the car mark, not a broken-image glyph. */
export const MakerLogo: React.FC<{ maker: { name: string; logoUrl?: string }; size?: number; className?: string }> = ({ maker, size = 26, className = '' }) => {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`bg-white border border-gray-100 rounded-xl flex items-center justify-center overflow-hidden ${className}`}>
      {maker.logoUrl && !broken ? (
        <img src={maker.logoUrl} alt={maker.name} className="w-full h-full object-contain p-2" onError={() => setBroken(true)} />
      ) : (
        <Car size={size} className="text-gray-300" />
      )}
    </div>
  );
};

const MakerModelManager: React.FC = () => {
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useModal();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [makers, setMakers] = useState<Maker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingMaker, setEditingMaker] = useState<Maker | null>(null);
  const [form, setForm] = useState({ name: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);

  const fetchMakers = async () => {
    try {
      const res = await api.get('/makers');
      setMakers(res.data);
    } catch (error) {
      console.error('Failed to fetch makers', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMakers(); }, []);

  const openAdd = () => { setEditingMaker(null); setForm({ name: '', logoUrl: '' }); setShowForm(true); };
  const openEdit = (maker: Maker) => { setEditingMaker(maker); setForm({ name: maker.name, logoUrl: maker.logoUrl || '' }); setShowForm(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingMaker) {
        await api.put(`/makers/${editingMaker.id}`, { name: form.name.trim(), logoUrl: form.logoUrl.trim() || null });
      } else {
        await api.post('/makers', { name: form.name.trim(), logoUrl: form.logoUrl.trim() || null });
      }
      setShowForm(false);
      fetchMakers();
    } catch (error: any) {
      await showAlert({ title: 'Could Not Save', message: error?.response?.data?.message || error?.response?.data?.error || 'Please try again.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (maker: Maker) => {
    const confirmed = await showConfirm({
      title: 'Delete Brand',
      message: `Delete "${maker.name}" and its ${maker.models.length} model${maker.models.length === 1 ? '' : 's'}? Cars already using this maker keep working, but it disappears from every dropdown. This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Brand',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/makers/${maker.id}`);
      fetchMakers();
    } catch (error: any) {
      await showAlert({ title: 'Delete Failed', message: error?.response?.data?.message || 'It may be in use by active listings.', variant: 'error' });
    }
  };

  const q = searchQuery.toLowerCase().trim();
  const filtered = makers.filter(m =>
    !q || m.name.toLowerCase().includes(q) || m.models.some(model => model.name.toLowerCase().includes(q))
  );
  const totalModels = makers.reduce((sum, m) => sum + m.models.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Makers &amp; Models</h1>
          <p className="text-sm text-gray-500 font-medium">
            {makers.length} maker{makers.length === 1 ? '' : 's'} · {totalModels} model{totalModels === 1 ? '' : 's'} — tap a brand to manage its models
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-xl px-3 py-2.5 focus-within:border-dark transition-colors w-56">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search brand or model…"
              className="bg-transparent border-none outline-none text-sm font-medium w-full pl-2 placeholder:text-gray-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
            )}
          </div>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Plus size={16} /> Add Maker
          </button>
        </div>
      </div>

      {/* Maker grid */}
      {filtered.length === 0 ? (
        <div className="card-widget p-12 text-center">
          <Car className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-sm font-medium text-gray-600">
            {searchQuery ? `No brands or models match “${searchQuery}”.` : 'No makers yet — add the first brand.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map(maker => (
            <div
              key={maker.id}
              onClick={() => navigate(`/maker-model/${maker.id}`)}
              className="card-widget overflow-hidden group cursor-pointer hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="relative">
                <MakerLogo maker={maker} className="w-full aspect-[5/3] rounded-none border-0 border-b border-gray-100" size={34} />
                {/* Hover actions */}
                <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => { e.stopPropagation(); openEdit(maker); }}
                    className="w-7 h-7 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-500 hover:text-dark transition-colors"
                    title="Edit brand"
                  >
                    <Edit size={13} />
                  </button>
                  {isSuper && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(maker); }}
                      className="w-7 h-7 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center text-gray-400 hover:text-danger transition-colors"
                      title="Delete brand"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-3.5 py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{maker.name}</p>
                  <p className="text-[11px] font-semibold text-gray-400">{maker.models.length} model{maker.models.length === 1 ? '' : 's'}</p>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-dark group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit maker modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editingMaker ? 'Edit Brand' : 'Add Brand'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Brand Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Toyota"
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400"
                />
              </div>
              <LogoUploadField
                value={form.logoUrl}
                onChange={url => setForm(prev => ({ ...prev, logoUrl: url }))}
                folderPath="car-makers"
                label="Brand Logo (optional)"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">
                  {saving ? 'Saving…' : editingMaker ? 'Save Changes' : 'Add Brand'}
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
