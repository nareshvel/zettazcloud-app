/**
 * CRM service — wishlists, birthday/anniversary reminders
 */

import { fetchApi } from './api';

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export interface WishlistItem {
  id: string;
  product_id: string;
  piece_id?: string | null;
  notes?: string | null;
  added_at: string;
  product_name: string;
  selling_price: number | null;
  attributes?: any;
  piece_code?: string | null;
  purity?: string | null;
  piece_price?: number | null;
}

export interface CrmReminder {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string | null;
  anniversaryDate?: string | null;
  reminderType: 'birthday' | 'anniversary';
  daysAway: number;
}

export interface ProfileExtra {
  date_of_birth: string | null;
  anniversary_date: string | null;
}

export async function getWishlist(customerId: string): Promise<WishlistItem[]> {
  return unwrap<WishlistItem[]>(await fetchApi<any>(`/crm/customers/${customerId}/wishlist`));
}

export async function addToWishlist(customerId: string, productId: string, pieceId?: string, notes?: string): Promise<{ id: string }> {
  return unwrap(await fetchApi<any>(`/crm/customers/${customerId}/wishlist`, {
    method: 'POST', body: JSON.stringify({ product_id: productId, piece_id: pieceId, notes }),
  }));
}

export async function removeFromWishlist(customerId: string, itemId: string): Promise<void> {
  await fetchApi(`/crm/customers/${customerId}/wishlist/${itemId}`, { method: 'DELETE' });
}

export async function getUpcomingReminders(days = 7): Promise<CrmReminder[]> {
  return unwrap<CrmReminder[]>(await fetchApi<any>(`/crm/reminders?days=${days}`));
}

export async function getProfileExtra(customerId: string): Promise<ProfileExtra> {
  return unwrap<ProfileExtra>(await fetchApi<any>(`/crm/customers/${customerId}/profile-extra`));
}

export async function saveProfileExtra(customerId: string, data: Partial<ProfileExtra>): Promise<void> {
  await fetchApi(`/crm/customers/${customerId}/profile-extra`, {
    method: 'PUT', body: JSON.stringify(data),
  });
}
