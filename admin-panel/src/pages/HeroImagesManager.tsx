import React, { useState, useEffect, useRef } from 'react';
import { ImagePlus, Trash2, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';

interface HeroImage {
  id: string;
  url: string;
  sortOrder: number;
}

/**
 * Curates the photo strip that slides behind the homepage hero headline.
 *
 * Hand-picked shots, not automatic inventory images — the band is the first
 * thing every visitor sees, so it should show the best-looking cars. When
 * this list is empty the customer site falls back to inventory photos, so
 * the hero never renders bare.
 */
const HeroImagesManager: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [images, setImages] = useState<HeroImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/hero-images');
      setImages(res.data || []);
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to load hero images', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchImages(); }, []);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = '';

    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await imageCompression(file, {
          maxSizeMB: 1.2,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        }).catch(() => file);

        const base64 = await fileToBase64(compressed);
        const uploadRes = await api.post('/upload/images', {
          images: [base64],
          folderPath: 'galimotors/hero',
        });
        const url = uploadRes.data.images?.[0]?.url;
        if (url) {
          await api.post('/hero-images', { url, sortOrder: images.length });
        }
      }
      await fetchImages();
    } catch (err: any) {
      await showAlert({
        title: 'Upload Failed',
        message: err.response?.data?.message || 'Could not upload the image. Please try again.',
        variant: 'error',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await showConfirm({
      title: 'Remove Hero Image',
      message: 'Remove this photo from the homepage hero?',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    try {
      await api.delete(`/hero-images/${id}`);
      await fetchImages();
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to remove the image', variant: 'error' });
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    try {
      await api.patch('/hero-images/reorder', {
        order: next.map((img, i) => ({ id: img.id, sortOrder: i })),
      });
    } catch {
      await showAlert({ title: 'Error', message: 'Failed to save the new order', variant: 'error' });
      fetchImages();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Homepage Hero</h1>
          <p className="text-text-secondary text-sm mt-1">
            Hand-picked photos that slide behind the homepage headline. Wide
            shots of your best-looking cars work best.
          </p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />}
          {uploading ? 'Uploading…' : 'Add Photos'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-secondary">Loading…</div>
      ) : images.length === 0 ? (
        <div className="card-widget p-12 text-center">
          <p className="text-text-secondary font-medium">
            No hero photos yet — the homepage is falling back to inventory
            pictures. Add a few wide shots of your best cars.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((img, i) => (
            <div key={img.id} className="card-widget overflow-hidden group">
              <div className="aspect-[16/9] bg-muted">
                <img src={img.url} alt={`Hero ${i + 1}`} className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-between p-3">
                <span className="text-xs font-bold text-text-tertiary">#{i + 1}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-2 hover:bg-muted rounded-lg text-text-secondary disabled:opacity-30"
                    title="Move earlier"
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1}
                    className="p-2 hover:bg-muted rounded-lg text-text-secondary disabled:opacity-30"
                    title="Move later"
                  >
                    <ArrowDown size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(img.id)}
                    className="p-2 hover:bg-danger-light hover:text-danger rounded-lg text-text-secondary"
                    title="Remove"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroImagesManager;
