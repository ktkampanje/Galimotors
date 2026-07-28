import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X, Edit, Trash2, Check, Search, Trash } from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import LogoUploadField from '../components/ui/LogoUploadField';
import { MakerLogo, type Maker } from './MakerModelManager';

/**
 * One brand's page: its identity (logo, name) and every model under it.
 * Models add inline (type + Enter), rename in place, delete with confirm.
 */
const MakerDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showConfirm, showAlert } = useModal();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [maker, setMaker] = useState<Maker | null>(null);
  const [loading, setLoading] = useState(true);

  const [newModel, setNewModel] = useState('');
  const [addingModel, setAddingModel] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [modelSearch, setModelSearch] = useState('');

  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', logoUrl: '' });
  const [saving, setSaving] = useState(false);

  const fetchMaker = useCallback(async () => {
    try {
      const res = await api.get('/makers');
      const found = (res.data as Maker[]).find(m => m.id === id) || null;
      setMaker(found);
    } catch (error) {
      console.error('Failed to fetch maker', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMaker(); }, [fetchMaker]);

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newModel.trim();
    if (!name || !maker) return;
    if (maker.models.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      await showAlert({ title: 'Already Exists', message: `"${name}" is already a ${maker.name} model.`, variant: 'warning' });
      return;
    }
    setAddingModel(true);
    try {
      await api.post('/models', { name, makerId: maker.id });
      setNewModel('');
      fetchMaker();
    } catch (error: any) {
      await showAlert({ title: 'Could Not Add Model', message: error?.response?.data?.message || 'Please try again.', variant: 'error' });
    } finally {
      setAddingModel(false);
    }
  };

  const handleRename = async (modelId: string) => {
    const name = editingName.trim();
    if (!name) { setEditingModelId(null); return; }
    try {
      await api.put(`/models/${modelId}`, { name, makerId: maker?.id });
      setEditingModelId(null);
      fetchMaker();
    } catch (error: any) {
      await showAlert({ title: 'Rename Failed', message: error?.response?.data?.message || 'Please try again.', variant: 'error' });
    }
  };

  const handleDeleteModel = async (modelId: string, name: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Model',
      message: `Delete "${name}"? Cars already using it keep working, but it disappears from the add-car form.`,
      variant: 'danger',
      confirmLabel: 'Delete Model',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/models/${modelId}`);
      fetchMaker();
    } catch (error: any) {
      await showAlert({ title: 'Delete Failed', message: error?.response?.data?.message || 'It might be linked to existing cars.', variant: 'error' });
    }
  };

  const handleSaveMaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maker || !form.name.trim()) return;
    setSaving(true);
    try {
      await api.put(`/makers/${maker.id}`, { name: form.name.trim(), logoUrl: form.logoUrl.trim() || null });
      setShowEdit(false);
      fetchMaker();
    } catch (error: any) {
      await showAlert({ title: 'Could Not Save', message: error?.response?.data?.message || 'Please try again.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMaker = async () => {
    if (!maker) return;
    const confirmed = await showConfirm({
      title: 'Delete Brand',
      message: `Delete "${maker.name}" and its ${maker.models.length} model${maker.models.length === 1 ? '' : 's'}? This cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete Brand',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/makers/${maker.id}`);
      navigate('/maker-model');
    } catch (error: any) {
      await showAlert({ title: 'Delete Failed', message: error?.response?.data?.message || 'It may be in use by active listings.', variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  if (!maker) {
    return (
      <div className="card-widget p-12 text-center max-w-lg mx-auto mt-12">
        <p className="text-sm font-semibold text-gray-600 mb-4">This brand no longer exists.</p>
        <Link to="/maker-model" className="btn-primary inline-flex items-center gap-2 text-sm font-bold no-underline">
          <ArrowLeft size={15} /> All makers
        </Link>
      </div>
    );
  }

  const q = modelSearch.toLowerCase().trim();
  const models = maker.models
    .filter(m => !q || m.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-5xl mx-auto">
      <Link to="/maker-model" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors no-underline w-fit">
        <ArrowLeft size={15} /> All makers
      </Link>

      {/* Brand header */}
      <div className="card-widget p-5 sm:p-6 flex items-center gap-4 sm:gap-5">
        <MakerLogo maker={maker} className="w-16 h-16 sm:w-20 sm:h-20 shrink-0" size={30} />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 truncate">{maker.name}</h1>
          <p className="text-sm text-gray-500 font-medium">{maker.models.length} model{maker.models.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setForm({ name: maker.name, logoUrl: maker.logoUrl || '' }); setShowEdit(true); }}
            className="btn-secondary flex items-center gap-1.5 text-sm font-bold"
          >
            <Edit size={14} /> <span className="hidden sm:inline">Edit Brand</span>
          </button>
          {isSuper && (
            <button
              onClick={handleDeleteMaker}
              className="p-2.5 rounded-lg border border-gray-200 text-gray-400 hover:text-danger hover:border-danger/30 hover:bg-danger-light transition-colors"
              title="Delete brand"
            >
              <Trash size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Models */}
      <div className="card-widget p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <h2 className="text-sm font-bold text-gray-900">Models</h2>
          {maker.models.length > 10 && (
            <div className="flex items-center bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 w-full sm:w-52">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={modelSearch}
                onChange={e => setModelSearch(e.target.value)}
                placeholder="Filter models…"
                className="bg-transparent border-none outline-none text-[13px] font-medium w-full pl-2 placeholder:text-gray-400"
              />
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Inline add — type and press Enter */}
          <form onSubmit={handleAddModel} className="flex gap-2">
            <input
              type="text"
              value={newModel}
              onChange={e => setNewModel(e.target.value)}
              placeholder={`Add a ${maker.name} model — e.g. Hilux`}
              className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:bg-white outline-none transition-all placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={addingModel || !newModel.trim()}
              className="btn-primary flex items-center gap-1.5 text-sm font-bold disabled:opacity-50"
            >
              <Plus size={15} /> Add
            </button>
          </form>

          {models.length === 0 ? (
            <p className="text-sm font-medium text-gray-400 text-center py-8">
              {q ? `No models match “${modelSearch}”.` : 'No models yet — add the first one above.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {models.map(model => (
                <div key={model.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-gray-200 transition-colors group">
                  {editingModelId === model.id ? (
                    <>
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(model.id); if (e.key === 'Escape') setEditingModelId(null); }}
                        className="flex-1 min-w-0 px-2 py-1 bg-gray-50 border border-dark rounded-lg text-sm font-medium outline-none"
                      />
                      <button onClick={() => handleRename(model.id)} className="p-1.5 text-success hover:bg-success-light rounded-lg transition-colors" title="Save">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setEditingModelId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors" title="Cancel">
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-gray-800 truncate">{model.name}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => { setEditingModelId(model.id); setEditingName(model.name); }}
                          className="p-1.5 text-gray-400 hover:text-dark rounded-lg hover:bg-gray-50 transition-colors"
                          title="Rename"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteModel(model.id, model.name)}
                          className="p-1.5 text-gray-400 hover:text-danger rounded-lg hover:bg-danger-light transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit brand modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowEdit(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-5">Edit Brand</h2>
            <form onSubmit={handleSaveMaker} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Brand Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all"
                />
              </div>
              <LogoUploadField
                value={form.logoUrl}
                onChange={url => setForm(prev => ({ ...prev, logoUrl: url }))}
                folderPath="car-makers"
                label="Brand Logo"
              />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MakerDetail;
