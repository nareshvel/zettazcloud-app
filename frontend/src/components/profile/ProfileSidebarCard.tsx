import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import Avatar from '../ui/Avatar';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { uploadMyAvatar, deleteMyAvatar } from '@/services/profileService';

export interface ProfileSidebarTab {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface ProfileSidebarCardProps {
  name: string;
  email: string;
  userId: string;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  roleLabel?: string | null;
  tabs: ProfileSidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
}

/**
 * Left-column identity + navigation card for the Profile page. Deliberately
 * NOT the "avatar floating over a banner edge" pattern (that's what produced
 * the overlapping name/email bug reported by the user) — the gradient strip,
 * avatar, and text all sit in normal document flow. The avatar is pulled up
 * into the strip with a plain negative top-margin, which only ever eats into
 * empty decorative space, never into sibling content, so it cannot overlap
 * text regardless of name length, avatar size, or viewport width.
 */
const ProfileSidebarCard: React.FC<ProfileSidebarCardProps> = ({
  name,
  email,
  userId,
  avatarUrl,
  onAvatarChange,
  roleLabel,
  tabs,
  activeTab,
  onTabChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleFileSelected = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Image must be under 3 MB.');
      return;
    }
    setUploading(true);
    try {
      const { profilePictureUrl } = await uploadMyAvatar(file);
      onAvatarChange(profilePictureUrl);
      toast.success('Profile photo updated');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await deleteMyAvatar();
      onAvatarChange(null);
      toast.success('Profile photo removed');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to remove photo.');
    } finally {
      setRemoving(false);
    }
  };

  const resolvedAvatarUrl = normalizeImageUrl(avatarUrl);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden lg:sticky lg:top-6">
      {/* Decorative strip — purely background, never holds content, so the
          avatar's negative margin into it can never collide with text. */}
      <div className="h-16 bg-gradient-to-r from-primary-950 via-primary-800 to-primary-700 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-8 -right-8 w-40 h-40 bg-primary-500/20 rounded-full blur-2xl" aria-hidden="true" />
      </div>

      <div className="px-6 pb-5 flex flex-col items-center text-center">
        <div className="relative group -mt-10">
          <div className="rounded-full ring-4 ring-card shadow-lg">
            <Avatar name={name} seed={userId} src={resolvedAvatarUrl} size="lg" />
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || removing}
            title="Change photo"
            className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground border-2 border-card flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          {resolvedAvatarUrl && !uploading && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              title="Remove photo"
              className="absolute top-0 left-0 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shadow-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60 opacity-0 group-hover:opacity-100"
            >
              {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelected(f);
              e.target.value = '';
            }}
          />
        </div>

        <h2 className="mt-3 text-base font-semibold text-foreground leading-tight break-words max-w-full">
          {name || 'User'}
        </h2>
        <p className="text-sm text-muted-foreground break-all">{email}</p>

        {roleLabel && (
          <span className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {roleLabel}
          </span>
        )}
      </div>

      <nav className="border-t border-border p-2">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors text-left
                ${active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default ProfileSidebarCard;
