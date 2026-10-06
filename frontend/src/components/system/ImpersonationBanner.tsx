/**
 * ImpersonationBanner — shown while a platform admin is acting inside a
 * tenant workspace via /platform/tenants/:id/impersonate.
 *
 * The impersonation JWT carries an `imp` claim; the original platform token
 * is stashed in sessionStorage so "Exit" restores it without a fresh login.
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, X } from 'lucide-react';
import { decodeToken } from '@/utils/jwt';

export const IMPERSONATOR_TOKEN_KEY = 'platform_impersonator_token';

const ImpersonationBanner = () => {
  const navigate = useNavigate();
  const imp = useMemo(() => {
    try {
      const token = localStorage.getItem('auth_token');
      const payload = token ? decodeToken(token) : null;
      return (payload as { imp?: { email?: string; reason?: string } } | null)?.imp || null;
    } catch {
      return null;
    }
  }, []);

  if (!imp) return null;

  const exitImpersonation = () => {
    const original = sessionStorage.getItem(IMPERSONATOR_TOKEN_KEY);
    sessionStorage.removeItem(IMPERSONATOR_TOKEN_KEY);
    if (original) {
      localStorage.setItem('auth_token', original);
      localStorage.removeItem('currentUser');
      localStorage.removeItem('user');
    }
    navigate('/system');
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-6 py-2">
      <p className="flex items-center gap-2 text-sm text-amber-900">
        <Eye className="h-4 w-4" />
        Viewing tenant workspace{imp.email ? ` as ${imp.email}` : ''}
        {imp.reason && <span className="text-amber-700">— {imp.reason}</span>}
      </p>
      <button
        onClick={exitImpersonation}
        className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100"
      >
        <X className="h-3.5 w-3.5" />Exit impersonation
      </button>
    </div>
  );
};

export default ImpersonationBanner;
