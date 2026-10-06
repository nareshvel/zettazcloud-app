/**
 * Frontend Image Utilities
 * 
 * Provides consistent image URL handling and fallback logic for the frontend.
 * Works in conjunction with backend ImageService to ensure robust image display.
 */

// Get API base URL for image fallback
const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api';

function computeBackendBase(rawApiBase: string): string {
  try {
    const apiUrl = new URL(rawApiBase);
    // Remove trailing /api from pathname if present
    apiUrl.pathname = apiUrl.pathname.replace(/\/?api\/?$/, '');

    // Guard against malformed hostnames like ".zettaz.com" or empty
    if (!apiUrl.hostname || apiUrl.hostname.startsWith('.')) {
      // Prefer using window.location.origin in browser context
      if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin.replace(/\/$/, '');
      }
      // Fallback to localhost
      return 'http://localhost:5172';
    }

    return apiUrl.toString().replace(/\/$/, '');
  } catch {
    // If RAW_API_BASE is not a valid URL, fallback sensibly
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/$/, '');
    }
    return 'http://localhost:5172';
  }
}

const BACKEND_BASE_URL = computeBackendBase(RAW_API_BASE);

// One-time debug to verify backend base URL in runtime environment
let __imageUtilsDebugLogged = false;
function debugLogOnce(message: string, ...args: any[]) {
  if (__imageUtilsDebugLogged) return;
  __imageUtilsDebugLogged = true;
  try {
    // Use debug level to avoid noisy logs
    // eslint-disable-next-line no-console
    console.debug('[ImageUtils]', message, ...args);
  } catch {}
}
debugLogOnce('BACKEND_BASE_URL computed', BACKEND_BASE_URL, { RAW_API_BASE });

/**
 * Ensure image URL is absolute and properly formatted
 * @param imageUrl - Image URL from API (should already be absolute from backend)
 * @returns Absolute image URL or null
 */
export const normalizeImageUrl = (imageUrl: string | null | undefined): string | null => {
  if (!imageUrl) return null;
  
  // Already absolute URL
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    try {
      const url = new URL(imageUrl);
      // If pointing to localhost/dev backend OR malformed host like ".zettaz.com", rewrite to BACKEND_BASE_URL origin
      if (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        !url.hostname ||
        url.hostname.startsWith('.')
      ) {
        const backend = new URL(BACKEND_BASE_URL);
        url.protocol = backend.protocol;
        url.hostname = backend.hostname;
        url.port = backend.port; // usually empty in production
        debugLogOnce('Rewriting absolute image host to backend origin', { from: imageUrl, to: url.toString() });
        return url.toString();
      }
      return imageUrl;
    } catch {
      // Fall through to relative handling if URL parsing fails
    }
  }
  
  // Relative URL - convert to absolute (fallback safety)
  if (imageUrl.startsWith('/')) {
    return `${BACKEND_BASE_URL}${imageUrl}`;
  }
  
  // Malformed URL - try to fix
  return `${BACKEND_BASE_URL}/${imageUrl}`;
};

/**
 * Get image URL with fallback to placeholder
 * @param imageUrl - Image URL from API
 * @param placeholderText - Text to show in placeholder (optional)
 * @returns Object with imageUrl and isPlaceholder flag
 */
export const getImageWithFallback = (
  imageUrl: string | null | undefined,
  placeholderText?: string
): { imageUrl: string | null; isPlaceholder: boolean; placeholderText?: string } => {
  const normalizedUrl = normalizeImageUrl(imageUrl);
  
  if (normalizedUrl) {
    return {
      imageUrl: normalizedUrl,
      isPlaceholder: false
    };
  }
  
  return {
    imageUrl: null,
    isPlaceholder: true,
    placeholderText: placeholderText || 'No Image'
  };
};

/**
 * Transform API response data to ensure image URLs are properly formatted
 * @param data - API response data (single object or array)
 * @returns Transformed data with normalized image URLs
 */
export const transformApiImageUrls = <T extends Record<string, any>>(data: T | T[]): T | T[] => {
  if (Array.isArray(data)) {
    return data.map(item => transformApiImageUrls(item)) as T[];
  }
  
  if (typeof data === 'object' && data !== null) {
    const transformed = { ...data } as any;
    
    // Transform common image URL fields
    if ('imageUrl' in transformed) {
      transformed.imageUrl = normalizeImageUrl(transformed.imageUrl as string);
    }
    
    if ('image_url' in transformed) {
      transformed.imageUrl = normalizeImageUrl(transformed.image_url as string);
      // Remove snake_case version if camelCase exists
      if ('imageUrl' in transformed) {
        delete transformed.image_url;
      }
    }
    
    return transformed as T;
  }
  
  return data;
};

/**
 * Check if an image URL is valid and accessible
 * @param imageUrl - Image URL to check
 * @returns Promise<boolean> - True if image is accessible
 */
export const isImageAccessible = async (imageUrl: string | null): Promise<boolean> => {
  if (!imageUrl) return false;
  
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    console.warn('[ImageUtils] Image accessibility check failed:', imageUrl, error);
    return false;
  }
};

/**
 * Generate a placeholder image URL or data URI
 * @param width - Placeholder width
 * @param height - Placeholder height
 * @param text - Text to display in placeholder
 * @param backgroundColor - Background color (hex)
 * @param textColor - Text color (hex)
 * @returns Data URI for placeholder image
 */
export const generatePlaceholderImage = (
  width: number = 200,
  height: number = 200,
  text: string = 'No Image',
  backgroundColor: string = '#f3f4f6',
  textColor: string = '#6b7280'
): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  
  // Fill background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // Add text
  ctx.fillStyle = textColor;
  ctx.font = `${Math.min(width, height) / 8}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2);
  
  return canvas.toDataURL();
};

/**
 * Image component props helper
 * @param imageUrl - Image URL from API
 * @param alt - Alt text
 * @param className - CSS classes
 * @returns Props object for image component
 */
export const getImageProps = (
  imageUrl: string | null | undefined,
  alt: string = 'Image',
  className: string = ''
) => {
  const { imageUrl: normalizedUrl, isPlaceholder, placeholderText } = getImageWithFallback(imageUrl, alt);
  
  if (isPlaceholder) {
    return {
      src: generatePlaceholderImage(200, 200, placeholderText),
      alt: placeholderText || alt,
      className: `${className} image-placeholder`,
      'data-placeholder': true
    };
  }
  
  return {
    src: normalizedUrl,
    alt,
    className,
    'data-placeholder': false
  };
};
