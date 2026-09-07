import { useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { uploadMedia, UploadedMedia } from '../lib/mediaUpload';

interface MediaUploaderProps {
  label: string;
  value: string;
  onChange: (url: string, media: UploadedMedia) => void;
  onClear?: () => void;
  accept: string;
  folder: string;
  hint?: string;
  preview?: 'image' | 'audio' | 'video';
  required?: boolean;
}

export default function MediaUploader({ label, value, onChange, onClear, accept, folder, hint, preview = 'image', required }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const media = await uploadMedia(file, folder);
      if (!media.publicUrl) throw new Error('Le stockage est configuré, mais aucune URL publique R2 n’est disponible. Configure R2_PUBLIC_BASE_URL.');
      onChange(media.publicUrl, media);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec de l’upload.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <label className="text-sm font-bold text-white">{label}{required ? ' *' : ''}</label>
        {value && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} /> R2</span>}
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => void handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="shrink-0 bg-yellow-500 text-black font-bold px-4 py-3 rounded-lg flex items-center gap-2 disabled:opacity-60"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          {uploading ? 'جارٍ الرفع...' : 'رفع إلى R2'}
        </button>
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value, { id: '', key: '', fileName: '', contentType: '', size: 0, kind: preview, status: 'uploaded', publicUrl: e.target.value })}
          placeholder="أو أدخل رابطاً خارجياً"
          className="min-w-0 flex-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-white"
          required={required}
        />
        {value && onClear && (
          <button type="button" onClick={onClear} className="px-3 bg-zinc-800 text-zinc-300 rounded-lg" title="مسح">
            <X size={16} />
          </button>
        )}
      </div>
      {hint && <p className="text-[10px] text-zinc-500">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {value && preview === 'image' && <img src={value} alt="معاينة" className="h-24 w-24 rounded-lg object-cover border border-zinc-700" />}
      {value && preview === 'audio' && <audio src={value} controls className="w-full" />}
      {value && preview === 'video' && <video src={value} controls className="w-full max-h-48 rounded-lg bg-black" />}
    </div>
  );
}
