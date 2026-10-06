import { fetchWithAuth } from '../utils/fetchWithAuth';
import { API_BASE_URL } from '../config';
import { logger } from '../utils/logger';

const buildApiUrl = (endpoint: string): string => {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;
  const base = API_BASE_URL || '';
  const baseEndsWithApi = /\/api\/?$/.test(base);
  const endpointStartsWithApi = endpoint.startsWith('/api');
  if (baseEndsWithApi) return `${base}${endpoint}`;
  const apiPrefix = endpointStartsWithApi ? '' : '/api';
  return `${base}${apiPrefix}${endpoint}`;
};

// This service talks to snake_case JSON backend routes directly (unlike services/api.ts
// which wraps a shared fetchApi that auto-converts case). Convert both ways here so the
// rest of the app can use camelCase consistently.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSnakeCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toSnakeCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(value);
      return acc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>);
  }
  return obj;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toCamelCase = (obj: any): any => {
  if (Array.isArray(obj)) return obj.map(toCamelCase);
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const camelKey = key.replace(/_([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
      acc[camelKey] = toCamelCase(value);
      return acc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as Record<string, any>);
  }
  return obj;
};

const parseResponse = async (response: Response) => {
  const json = await response.json();
  return toCamelCase(json);
};

export interface PrintJob {
  id: string;
  tenantId: string;
  storeId: string;
  stationId?: string;
  printerDeviceId?: string;
  printerName?: string;
  stationName?: string;
  jobType: string;
  documentType: string;
  status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  payload?: any;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface PrintJobStatistics {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  cancelled: number;
}

export interface PrintTemplate {
  id: string;
  tenantId: string;
  storeId?: string;
  name: string;
  templateType: string;
  documentSubtype?: string;
  version: number;
  isPublished: boolean;
  isDefault: boolean;
  blocks?: any;
  styles?: any;
  layoutConfig?: any;
  previewData?: any;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface PrintTemplateVersion {
  id: string;
  templateId: string;
  version: number;
  blocks?: any;
  styles?: any;
  layoutConfig?: any;
  changeDescription?: string;
  createdAt: string;
}

export interface PrinterDevice {
  id: string;
  tenantId: string;
  storeId?: string;
  stationId?: string;
  name: string;
  deviceType: string;
  connectionType: string;
  address?: string;
  port: number;
  capabilities?: any;
  isDefault: boolean;
  isActive: boolean;
}

export interface PrintJobFilters {
  storeId?: string;
  status?: string;
  jobType?: string;
  printerDeviceId?: string;
  limit?: number;
  offset?: number;
}

export const fetchPrintJobs = async (filters: PrintJobFilters = {}): Promise<PrintJob[]> => {
  try {
    const params = new URLSearchParams();
    if (filters.storeId) params.set('store_id', filters.storeId);
    if (filters.status) params.set('status', filters.status);
    if (filters.jobType) params.set('job_type', filters.jobType);
    if (filters.printerDeviceId) params.set('printer_device_id', filters.printerDeviceId);
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.offset) params.set('offset', String(filters.offset));

    const response = await fetchWithAuth(buildApiUrl(`/print-jobs?${params.toString()}`));
    if (!response.ok) throw new Error(`Error fetching print jobs: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data || [];
  } catch (error) {
    logger.error('Error fetching print jobs:', error);
    throw error;
  }
};

export const fetchPrintJobStatistics = async (storeId?: string): Promise<PrintJobStatistics> => {
  try {
    const params = storeId ? `?store_id=${storeId}` : '';
    const response = await fetchWithAuth(buildApiUrl(`/print-jobs/statistics${params}`));
    if (!response.ok) throw new Error(`Error fetching statistics: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error fetching print job statistics:', error);
    throw error;
  }
};

export const retryPrintJob = async (jobId: string): Promise<void> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-jobs/${jobId}/retry`), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Error retrying print job: ${response.statusText}`);
  } catch (error) {
    logger.error('Error retrying print job:', error);
    throw error;
  }
};

export const cancelPrintJob = async (jobId: string): Promise<void> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-jobs/${jobId}/cancel`), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Error cancelling print job: ${response.statusText}`);
  } catch (error) {
    logger.error('Error cancelling print job:', error);
    throw error;
  }
};

export const fetchPrintTemplates = async (filters: { templateType?: string; storeId?: string } = {}): Promise<PrintTemplate[]> => {
  try {
    const params = new URLSearchParams();
    if (filters.templateType) params.set('template_type', filters.templateType);
    if (filters.storeId) params.set('store_id', filters.storeId);
    const response = await fetchWithAuth(buildApiUrl(`/print-templates?${params.toString()}`));
    if (!response.ok) throw new Error(`Error fetching templates: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data || [];
  } catch (error) {
    logger.error('Error fetching print templates:', error);
    throw error;
  }
};

export const fetchPrintTemplate = async (templateId: string): Promise<PrintTemplate> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}`));
    if (!response.ok) throw new Error(`Error fetching template: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error fetching print template:', error);
    throw error;
  }
};

export const savePrintTemplate = async (template: Partial<PrintTemplate>): Promise<PrintTemplate> => {
  try {
    const method = template.id ? 'PUT' : 'POST';
    const url = template.id ? `/print-templates/${template.id}` : '/print-templates';
    const response = await fetchWithAuth(buildApiUrl(url), {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSnakeCase(template)),
    });
    if (!response.ok) throw new Error(`Error saving template: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error saving print template:', error);
    throw error;
  }
};

export const publishPrintTemplate = async (templateId: string): Promise<PrintTemplate> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}/publish`), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Error publishing template: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error publishing template:', error);
    throw error;
  }
};

export const fetchTemplateVersions = async (templateId: string): Promise<PrintTemplateVersion[]> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}/versions`));
    if (!response.ok) throw new Error(`Error fetching versions: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data || [];
  } catch (error) {
    logger.error('Error fetching template versions:', error);
    throw error;
  }
};

export const rollbackPrintTemplate = async (templateId: string, version: number): Promise<PrintTemplate> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}/rollback`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    });
    if (!response.ok) throw new Error(`Error rolling back template: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error rolling back template:', error);
    throw error;
  }
};

export const setDefaultPrintTemplate = async (templateId: string): Promise<PrintTemplate> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}/default`), {
      method: 'POST',
    });
    if (!response.ok) throw new Error(`Error setting default template: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error setting default template:', error);
    throw error;
  }
};

export const deletePrintTemplate = async (templateId: string): Promise<void> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}`), {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Error deleting template: ${response.statusText}`);
  } catch (error) {
    logger.error('Error deleting template:', error);
    throw error;
  }
};

export const duplicatePrintTemplate = async (template: PrintTemplate, newName: string): Promise<PrintTemplate> => {
  try {
    const created = await savePrintTemplate({
      name: newName,
      templateType: template.templateType,
      documentSubtype: template.documentSubtype,
      storeId: template.storeId,
      blocks: template.blocks,
      styles: template.styles,
      layoutConfig: template.layoutConfig,
    });
    return created;
  } catch (error) {
    logger.error('Error duplicating template:', error);
    throw error;
  }
};

export const fetchFixture = async (type: string, name: string): Promise<any> => {
  try {
    const response = await fetchWithAuth(buildApiUrl(`/print-tests/fixtures/${type}/${name}`));
    if (!response.ok) throw new Error(`Error fetching fixture: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data;
  } catch (error) {
    logger.error('Error fetching fixture:', error);
    throw error;
  }
};

export const fetchPrinterDevices = async (storeId?: string): Promise<PrinterDevice[]> => {
  try {
    const params = storeId ? `?store_id=${storeId}` : '';
    const response = await fetchWithAuth(buildApiUrl(`/printer-devices${params}`));
    if (!response.ok) throw new Error(`Error fetching devices: ${response.statusText}`);
    const data = await parseResponse(response);
    return data.data || [];
  } catch (error) {
    logger.error('Error fetching printer devices:', error);
    throw error;
  }
};


/**
 * Replace a template's blocks with the current defaults for its type.
 *
 * DEFAULT_BLOCKS only applies at creation, so an older template never picks up
 * later improvements. The previous version is versioned first, so this is
 * reversible via rollback.
 */
export const resetTemplateToDefaults = async (templateId: string): Promise<PrintTemplate> => {
  const response = await fetchWithAuth(buildApiUrl(`/print-templates/${templateId}/reset-defaults`), {
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Error resetting template: ${response.statusText}`);
  const data = await parseResponse(response);
  return toCamelCase(data.data ?? data) as PrintTemplate;
};
