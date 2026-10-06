import { fetchApi } from './api';
import axiosInstance from './axiosConfig';

// ── Self-service profile ────────────────────────────────────────────────
export interface UpdateMePayload {
  name?: string;
  phoneNumber?: string;
}

// fetchApi (see api.ts) auto-converts every JSON response from snake_case to
// camelCase, so the object these calls actually resolve to at runtime always
// has camelCase keys (phoneNumber, profilePictureUrl, ...) — never the raw
// snake_case the backend sends on the wire. These types (and the ones below
// for notification preferences / sessions) describe that post-conversion
// shape on purpose. Declaring them in snake_case here previously meant every
// field read (profile.phone_number, prefs.email_payment_failed, etc.) was
// reading a key that didn't exist on the actual object, silently resolving
// to undefined.
export interface MeProfile {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  profilePictureUrl: string | null;
}

export const getMyProfile = async (): Promise<MeProfile> => fetchApi<MeProfile>('/users/me');

export const updateMyProfile = async (payload: UpdateMePayload): Promise<MeProfile> =>
  fetchApi<MeProfile>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const uploadMyAvatar = async (file: File): Promise<{ profilePictureUrl: string }> => {
  const form = new FormData();
  form.append('file', file);
  const res = await axiosInstance.post('/api/users/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = res.data?.data ?? res.data;
  return { profilePictureUrl: data.profilePictureUrl ?? data.profile_picture_url };
};

export const deleteMyAvatar = async (): Promise<void> => {
  await fetchApi('/users/me/avatar', { method: 'DELETE' });
};

// ── Notification preferences ────────────────────────────────────────────
export interface NotificationPreferences {
  id: string;
  userId: string;
  tenantId: string;
  emailPaymentFailed: boolean;
  emailTrialEnding: boolean;
  emailSubscriptionRenewed: boolean;
  emailLowStock: boolean;
  emailNewSaleSummary: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const coerceBooleans = (row: any): NotificationPreferences => ({
  ...row,
  emailPaymentFailed: !!row.emailPaymentFailed,
  emailTrialEnding: !!row.emailTrialEnding,
  emailSubscriptionRenewed: !!row.emailSubscriptionRenewed,
  emailLowStock: !!row.emailLowStock,
  emailNewSaleSummary: !!row.emailNewSaleSummary,
});

export const getNotificationPreferences = async (): Promise<NotificationPreferences> => {
  const data = await fetchApi<any>('/users/me/notification-preferences');
  return coerceBooleans(data);
};

export const updateNotificationPreferences = async (
  partial: Partial<Pick<NotificationPreferences,
    'emailPaymentFailed' | 'emailTrialEnding' | 'emailSubscriptionRenewed' | 'emailLowStock' | 'emailNewSaleSummary'>>
): Promise<NotificationPreferences> => {
  const data = await fetchApi<any>('/users/me/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(partial),
  });
  return coerceBooleans(data);
};

// ── Sessions ─────────────────────────────────────────────────────────────
export interface UserSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
  createdAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export const getMySessions = async (): Promise<UserSession[]> =>
  fetchApi<UserSession[]>('/users/me/sessions');

export const revokeSession = async (sessionId: string): Promise<void> => {
  await fetchApi(`/users/me/sessions/${sessionId}`, { method: 'DELETE' });
};

export const revokeOtherSessions = async (): Promise<{ revokedCount: number }> =>
  fetchApi<{ revokedCount: number }>('/users/me/sessions/revoke-others', { method: 'POST' });

// ── TOTP 2FA ─────────────────────────────────────────────────────────────
export interface TwoFactorStatus {
  enabled: boolean;
}

export interface TwoFactorSetup {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

export interface TwoFactorConfirmResult {
  enabled: true;
  backupCodes: string[];
}

export const getTwoFactorStatus = async (): Promise<TwoFactorStatus> =>
  fetchApi<TwoFactorStatus>('/users/me/2fa/status');

export const setupTwoFactor = async (): Promise<TwoFactorSetup> =>
  fetchApi<TwoFactorSetup>('/users/me/2fa/setup', { method: 'POST' });

export const confirmTwoFactor = async (secret: string, code: string): Promise<TwoFactorConfirmResult> =>
  fetchApi<TwoFactorConfirmResult>('/users/me/2fa/confirm', {
    method: 'POST',
    body: JSON.stringify({ secret, code }),
  });

export const disableTwoFactor = async (password: string): Promise<{ enabled: false }> =>
  fetchApi<{ enabled: false }>('/users/me/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
