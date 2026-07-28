import React, { useRef, useState } from 'react';
import { Upload, X, ImageIcon } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { api } from '../../lib/api';

/**
 * Image field for catalogue records (maker logos, body-type icons):
 * live preview + real file upload to Cloudinary + an optional URL paste
 * for the rare copy-from-web case. Replaces the old paste-a-URL-only
 * text inputs nobody could use from a phone.
 */
const LogoUploadField: React.FC<{
  value: string;
  onChange: (url: string) => void;
  folderPath: string;
  label?: string;
}> = ({ value, onChange, folderPath, label = 'Logo' }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [broken, setBroken] = useState(false);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      let compressed: File | Blob = file;
      try {
        compressed = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 800, useWebWorker: true });
      } catch { /* keep original */ }
      const base64 = await fileToBase64(compressed instanceof File ? compressed : new File([compressed], file.name, { type: compressed.type || file.type }));
      const res = await api.post('/upload/images', { images: [base64], folderPath });
      const url = res.data.images?.[0]?.url;
      if (!url) throw new Error('no url returned');
      setBroken(false);
      onChange(url);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed — try again or paste an image URL.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-600">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 shrink-0 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center overflow-hidden">
          {value && !broken ? (
            <img src={value} alt="" className="w-full h-full object-contain p-1.5" onError={() => setBroken(true)} />
          ) : (
            <ImageIcon size={22} className="text-gray-300" />
          )}
        </div>
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 bg-dark text-white text-xs font-bold rounded-lg hover:bg-dark-muted transition-colors disabled:opacity-60"
            >
              {uploading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
              ) : (
                <><Upload size={13} /> Upload image</>
              )}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setBroken(false); }}
                className="flex items-center gap-1 px-2.5 py-2 bg-gray-100 text-gray-500 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={13} /> Remove
              </button>
            )}
          </div>
          <input
            type="text"
            value={value}
            onChange={e => { onChange(e.target.value); setBroken(false); }}
            placeholder="…or paste an image URL"
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:border-dark outline-none transition-all placeholder:text-gray-400"
          />
        </div>
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
};

export default LogoUploadField;
