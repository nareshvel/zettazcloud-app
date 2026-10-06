import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Laptop, Smartphone, Globe, LogOut, Loader2, MonitorSmartphone } from 'lucide-react';
import { getMySessions, revokeSession, revokeOtherSessions, UserSession } from '@/services/profileService';

function deviceIcon(session: UserSession) {
  const ua = (session.deviceLabel || session.userAgent || '').toLowerCase();
  if (/mobile|android|iphone/.test(ua)) return Smartphone;
  if (/mac|windows|linux/.test(ua)) return Laptop;
  return MonitorSmartphone;
}

function describeDevice(session: UserSession): string {
  if (session.deviceLabel) return session.deviceLabel;
  if (session.userAgent) {
    return session.userAgent.length > 60 ? `${session.userAgent.slice(0, 60)}…` : session.userAgent;
  }
  return 'Unknown device';
}

const SessionsCard: React.FC = () => {
  const [sessions, setSessions] = useState<UserSession[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const load = () => {
    setLoading(true);
    getMySessions()
      .then(setSessions)
      .catch(() => toast.error('Failed to load sessions.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleRevoke = async (id: string) => {
    setRevokingId(id);
    try {
      await revokeSession(id);
      setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
      toast.success('Session revoked');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      const { revokedCount } = await revokeOtherSessions();
      setSessions((prev) => prev?.filter((s) => s.isCurrent) ?? null);
      toast.success(revokedCount > 0 ? `Signed out ${revokedCount} other session${revokedCount === 1 ? '' : 's'}` : 'No other sessions to sign out');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to sign out other sessions.');
    } finally {
      setRevokingOthers(false);
    }
  };

  const others = sessions?.filter((s) => !s.isCurrent) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Active sessions
        </h3>
        {others.length > 0 && (
          <button
            type="button"
            onClick={handleRevokeOthers}
            disabled={revokingOthers}
            className="text-xs font-medium text-destructive hover:text-destructive/80 disabled:opacity-50"
          >
            {revokingOthers ? 'Signing out…' : 'Sign out all other sessions'}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Devices and browsers currently signed in to your account.</p>

      {loading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {!loading && sessions && sessions.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No active sessions found.</p>
      )}

      {!loading && sessions && sessions.length > 0 && (
        <ul className="divide-y divide-border">
          {sessions.map((session) => {
            const Icon = deviceIcon(session);
            return (
              <li key={session.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                      {describeDevice(session)}
                      {session.isCurrent && (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-success-light text-success-text shrink-0">This device</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.ipAddress ? `${session.ipAddress} · ` : ''}
                      Last active {new Date(session.lastActiveAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokingId === session.id}
                    title="Revoke this session"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors shrink-0 disabled:opacity-50"
                  >
                    {revokingId === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                    Revoke
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SessionsCard;
