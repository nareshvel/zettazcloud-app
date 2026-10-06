/**
 * AttachmentUploader
 * Generic drag-and-drop file uploader that uses /api/attachments.
 * Shows a thumbnail grid for images; file icon for non-images.
 *
 * Props:
 *   entityType  — 'repair_order' | 'product' | 'customer' | 'memo' | 'layaway' | 'product_piece'
 *   entityId    — UUID of the parent record
 *   accept      — MIME types string (default: 'image/*,application/pdf')
 *   maxFiles    — maximum simultaneous upload count (default: 10)
 *   label       — section heading (default: 'Attachments')
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, X, FileText, Loader2, Image } from 'lucide-react';
import { fetchApi } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

interface Attachment {
  id: string;
  file_name: string;
  mime_type: string;
  file_url: string;
  created_at: string;
}

interface Props {
  entityType: string;
  entityId: string;
  accept?: string;
  maxFiles?: number;
  label?: string;
}

export default function AttachmentUploader({
  entityType,
  entityId,
  accept = 'image/*,application/pdf',
  maxFiles = 10,
  label = 'Attachments',
}: Props) {
  const { toast }            = useToast();
  const [files, setFiles]    = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchApi<any>(`/attachments?entity_type=${entityType}&entity_id=${entityId}`)
      .then(r => setFiles((r && r.data) ? r.data : (r || [])))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const uploadFiles = async (fileList: FileList) => {
    const toUpload = Array.from(fileList).slice(0, maxFiles);
    if (!toUpload.length) return;
    setUploading(true);
    let success = 0;
    for (const f of toUpload) {
      const fd = new FormData();
      fd.append('file', f);
      fd.append('entity_type', entityType);
      fd.append('entity_id', entityId);
      try {
        await fetchApi<any>('/attachments', { method: 'POST', body: fd });
        success++;
      } catch (e: any) {
        toast({ title: `Failed to upload ${f.name}`, description: e.message, variant: 'destructive' });
      }
    }
    setUploading(false);
    if (success > 0) { toast({ title: `${success} file(s) uploaded` }); load(); }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;
    try {
      await fetchApi(`/attachments/${id}`, { method: 'DELETE' });
      setFiles(prev => prev.filter(f => f.id !== id));
      toast({ title: 'Deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const isImage = (mime: string) => mime.startsWith('image/');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Image className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
        {files.length > 0 && <span className="text-xs text-muted-foreground">({files.length})</span>}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={e => e.target.files && uploadFiles(e.target.files)}
        />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </div>
        ) : (
          <div className="text-sm text-muted-foreground py-2">
            <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground/60" />
            Drag & drop files here or <span className="text-primary font-medium">click to select</span>
          </div>
        )}
      </div>

      {/* Thumbnail grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading…
        </div>
      ) : files.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {files.map(f => (
            <div key={f.id} className="group relative rounded-lg border overflow-hidden bg-muted/30 aspect-square">
              {isImage(f.mime_type) ? (
                <img
                  src={f.file_url}
                  alt={f.file_name}
                  className="w-full h-full object-cover"
                  onClick={() => window.open(f.file_url, '_blank')}
                />
              ) : (
                <div
                  className="flex flex-col items-center justify-center h-full gap-1 px-1 cursor-pointer"
                  onClick={() => window.open(f.file_url, '_blank')}
                >
                  <FileText className="h-6 w-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground text-center truncate w-full px-1">{f.file_name}</span>
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(f.id, f.file_name); }}
                className="absolute top-1 right-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                title="Delete"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}
