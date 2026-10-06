/**
 * Jurisdiction service — client for /api/jurisdiction
 *
 * Supplies the tax/invoice/fiscal rules for the acting store. Consumers should
 * treat every label and flag as data: the app serves any country and duty-free
 * retail, so nothing here may be hardcoded per market.
 */

import { fetchApi } from './api';
import type {
  JurisdictionContext,
  JurisdictionProfile,
  JurisdictionSettingsPatch,
} from '@/types/jurisdiction';

/**
 * Effective jurisdiction context for the acting store.
 * `fetchApi` unwraps `{ status, data }` and converts snake_case to camelCase.
 */
export const getJurisdictionContext = async (): Promise<JurisdictionContext> =>
  fetchApi<JurisdictionContext>('/jurisdiction/current');

/** The shared country catalog — for a settings-screen picker. */
export const listJurisdictionProfiles = async (
  opts: { includeInactive?: boolean } = {},
): Promise<JurisdictionProfile[]> =>
  fetchApi<JurisdictionProfile[]>(
    `/jurisdiction/profiles${opts.includeInactive ? '?all=true' : ''}`,
  );

/**
 * Update the acting store's jurisdiction settings.
 *
 * Note `salesMode` determines whether tax is charged at all — switching a store
 * to `duty_free` zero-rates its sales. Treat it as a financial setting and
 * confirm the change with the user.
 */
export const updateJurisdictionSettings = async (
  patch: JurisdictionSettingsPatch,
): Promise<JurisdictionContext> =>
  fetchApi<JurisdictionContext>('/jurisdiction/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
