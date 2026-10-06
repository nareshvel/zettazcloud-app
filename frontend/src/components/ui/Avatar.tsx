import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<AvatarSize, string> = {
  xs: 'h-7 w-7 text-xs',
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-20 w-20 text-2xl',
  xl: 'h-28 w-28 text-4xl',
};

// A small, fixed palette so initials avatars stay on-brand instead of
// producing arbitrary/clashing colors. Chosen to read well with white text
// in both light and dark mode.
const PALETTE = [
  '#08145a', // brand navy
  '#1d2c62',
  '#3a53a8',
  '#0f766e', // teal
  '#7c3aed', // violet
  '#be123c', // rose
  '#b45309', // amber
  '#0369a1', // sky
];

/** Deterministic hash so the same name/id always maps to the same color. */
function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps {
  /** Full name used to derive initials + a deterministic color. */
  name?: string | null;
  /** Stable identifier (e.g. user id) preferred over name for color derivation, when available. */
  seed?: string | null;
  /** Real uploaded photo URL, if any. Falls back to initials when absent. */
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Reusable avatar: shows the real uploaded photo when `src` is set,
 * otherwise a deterministic initials fallback (same name/id always gets
 * the same background color, not randomized per render).
 */
const Avatar: React.FC<AvatarProps> = ({ name, seed, src, size = 'md', className = '' }) => {
  const initials = getInitials(name);
  const colorKey = seed || name || '?';
  const bgColor = PALETTE[hashString(colorKey) % PALETTE.length];

  const base = `inline-flex items-center justify-center shrink-0 rounded-full font-semibold text-white overflow-hidden select-none ${SIZE_CLASSES[size]} ${className}`;

  if (src) {
    return (
      <span className={`${base} bg-muted`}>
        <img src={src} alt={name || 'Avatar'} className="h-full w-full object-cover" />
      </span>
    );
  }

  return (
    <span className={base} style={{ backgroundColor: bgColor }} aria-label={name || 'User avatar'}>
      {initials}
    </span>
  );
};

export default Avatar;
