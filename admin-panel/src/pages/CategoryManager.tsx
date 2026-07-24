import React, { useState, useEffect } from 'react';
import { Plus, X, Edit, Trash2, GripVertical, Save } from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  emoji: string;
  color: string;
  bgColor: string;
  rankBoost: number;
  sortOrder: number;
  carCount?: number;
}

const CategoryManager: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    emoji: '•',
    color: '#13293D',
    bgColor: '#E8EEF4',
    rankBoost: 0,
  });

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to load categories',
        variant: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      emoji: '•',
      color: '#13293D',
      bgColor: '#E8EEF4',
      rankBoost: 0,
    });
    setEditingCategory(null);
    setShowAddForm(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      await showAlert({
        title: 'Validation',
        message: 'Category name is required',
        variant: 'warning'
      });
      return;
    }

    try {
      await api.post('/categories', {
        ...form,
        rankBoost: Number(form.rankBoost),
      });
      resetForm();
      await fetchCategories();
      await showAlert({
        title: 'Success',
        message: 'Category created successfully',
        variant: 'success'
      });
    } catch (error: any) {
      console.error('Failed to create category', error);
      await showAlert({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create category',
        variant: 'error'
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    try {
      await api.patch(`/categories/${editingCategory.id}`, {
        ...form,
        rankBoost: Number(form.rankBoost),
      });
      resetForm();
      await fetchCategories();
      await showAlert({
        title: 'Success',
        message: 'Category updated successfully',
        variant: 'success'
      });
    } catch (error: any) {
      console.error('Failed to update category', error);
      await showAlert({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update category',
        variant: 'error'
      });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete Category',
      message: 'Are you sure you want to delete this category? Cars with this category will not be affected.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/categories/${id}`);
      await fetchCategories();
      await showAlert({
        title: 'Success',
        message: 'Category deleted successfully',
        variant: 'success'
      });
    } catch (error: any) {
      console.error('Failed to delete category', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to delete category',
        variant: 'error'
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      description: category.description || '',
      emoji: category.emoji,
      color: category.color,
      bgColor: category.bgColor,
      rankBoost: category.rankBoost,
    });
    setShowAddForm(true);
  };

  const handleDragStart = (id: string) => {
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropReorder = async (dropId: string) => {
    if (!draggingId || draggingId === dropId) {
      setDraggingId(null);
      return;
    }

    const dragIndex = categories.findIndex(c => c.id === draggingId);
    const dropIndex = categories.findIndex(c => c.id === dropId);

    if (dragIndex === -1 || dropIndex === -1) return;

    const newCategories = [...categories];
    const [draggedItem] = newCategories.splice(dragIndex, 1);
    newCategories.splice(dropIndex, 0, draggedItem);

    // Update sort orders
    const reorderData = newCategories.map((cat, idx) => ({
      id: cat.id,
      sortOrder: idx + 1
    }));

    try {
      await api.patch('/categories/reorder', { order: reorderData });
      setCategories(newCategories);
      setDraggingId(null);
      await showAlert({
        title: 'Success',
        message: 'Categories reordered',
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to reorder', error);
      await showAlert({
        title: 'Error',
        message: 'Failed to reorder categories',
        variant: 'error'
      });
      fetchCategories();
    }
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Category Management</h1>
          <p className="text-text-secondary text-sm mt-1">Create and organize category badges for cars</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} /> Add Category
        </button>
      </div>

      <div className="card-widget p-4">
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="filter-select w-full"
        />
      </div>

      {showAddForm && (
        <div className="card-widget p-6 space-y-4 bg-gradient-to-br from-surface to-muted">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-text-primary">
              {editingCategory ? '✏️ Edit Category' : '➕ Add New Category'}
            </h2>
            <button onClick={resetForm} className="p-2 hover:bg-coral-light hover:text-coral rounded-lg transition">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={editingCategory ? handleUpdate : handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Category Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="filter-select w-full bg-surface"
                  placeholder="e.g., Best Seller"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Emoji Badge</label>
                <input
                  type="text"
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="filter-select w-full bg-surface text-lg text-center"
                  placeholder="🏆"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-2">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="filter-select w-full h-20 bg-surface resize-none"
                placeholder="Brief description of this category..."
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 w-12 cursor-pointer border border-border rounded-lg"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="filter-select flex-1 bg-surface"
                    placeholder="#FFFFFF"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Background</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={form.bgColor}
                    onChange={(e) => setForm({ ...form, bgColor: e.target.value })}
                    className="h-10 w-12 cursor-pointer border border-border rounded-lg"
                  />
                  <input
                    type="text"
                    value={form.bgColor}
                    onChange={(e) => setForm({ ...form, bgColor: e.target.value })}
                    className="filter-select flex-1 bg-surface"
                    placeholder="#D9A404"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-2">Search Boost</label>
                <input
                  type="number"
                  value={form.rankBoost}
                  onChange={(e) => setForm({ ...form, rankBoost: Number(e.target.value) })}
                  className="filter-select w-full bg-surface"
                  placeholder="0"
                  min="0"
                  max="100"
                />
                <p className="text-xs text-text-tertiary mt-1">Higher = better search ranking</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-muted to-gray-50 p-4 rounded-lg border border-border flex items-center justify-center gap-4">
              <span className="text-xs font-semibold text-text-tertiary">LIVE PREVIEW</span>
              <div
                style={{
                  backgroundColor: form.bgColor,
                  color: form.color,
                }}
                className="px-4 py-2 rounded-full font-bold text-sm shadow-sm"
              >
                {form.emoji} {form.name || 'Category'}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 border border-border rounded-lg hover:bg-muted text-text-primary font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2 px-5 py-2.5"
              >
                <Save size={16} /> {editingCategory ? 'Update' : 'Create'} Category
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-coral-light border-t-coral rounded-full animate-spin" />
            <p className="text-text-secondary">Loading categories...</p>
          </div>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="card-widget p-12 text-center">
          <p className="text-text-secondary font-medium">
            {categories.length === 0 ? '📦 No categories yet. Create one to get started.' : '🔍 No categories match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((category) => (
            <div
              key={category.id}
              draggable
              onDragStart={() => handleDragStart(category.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDropReorder(category.id)}
              className={`card-widget p-4 flex items-center gap-4 hover:shadow-md hover:border-coral-light transition cursor-move ${
                draggingId === category.id ? 'opacity-50 bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <GripVertical size={20} className="text-text-tertiary flex-shrink-0" />

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div
                    style={{
                      backgroundColor: category.bgColor,
                      color: category.color,
                    }}
                    className="px-3 py-1.5 rounded-full text-sm font-bold shadow-sm"
                  >
                    {category.emoji} {category.name}
                  </div>
                  <span className="text-xs bg-coral-light text-coral px-2.5 py-1 rounded-full font-semibold">
                    +{category.rankBoost} rank
                  </span>
                </div>
                {category.description && (
                  <p className="text-sm text-text-secondary mb-1">{category.description}</p>
                )}
                <p className="text-xs text-text-tertiary">
                  📊 {category.carCount || 0} car{category.carCount !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => handleEdit(category)}
                  className="p-2.5 hover:bg-coral-light hover:text-coral rounded-lg text-text-secondary transition font-medium"
                  title="Edit"
                >
                  <Edit size={18} />
                </button>
                <button
                  onClick={() => handleDelete(category.id)}
                  className="p-2.5 hover:bg-danger-light hover:text-danger rounded-lg text-text-secondary transition font-medium"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
