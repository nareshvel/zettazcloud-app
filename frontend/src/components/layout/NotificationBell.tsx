/**
 * NotificationBell
 * Bell icon in the top bar that surfaces upcoming CRM reminders
 * (birthdays / anniversaries in the next 7 days) in a slide-out sidebar.
 */

import { useState, useEffect } from 'react';
import { Bell, Gift, Calendar, Phone, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getUpcomingReminders, type CrmReminder } from '@/services/crmService';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [reminders, setReminders] = useState<CrmReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getUpcomingReminders(7)
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false));
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.classList.remove('overflow-hidden');
    };
  }, [open]);

  const formatDaysAway = (n?: number | null) => {
    if (n === undefined || n === null || Number.isNaN(n)) return 'Soon';
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    return `In ${n} days`;
  };

  const unreadCount = reminders.length;

  return (
    <>
      <button
        title="Notifications"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-full hover:bg-primary-light text-text-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light transition-colors duration-150 ease-in-out"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-rose-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-out sidebar */}
      <div
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => setOpen(false)}
        />

        {/* Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-full max-w-sm bg-card shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <h3 className="text-base font-semibold">Upcoming reminders</h3>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-background-hover text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Close notifications"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading reminders…
              </div>
            ) : reminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm px-6 text-center">
                <Calendar className="h-8 w-8 mb-2 opacity-40" />
                No upcoming reminders.
              </div>
            ) : (
              <div className="space-y-2">
                {reminders.map(r => (
                  <Link
                    key={`${r.id}-${r.reminderType}`}
                    to="/customers"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-background-hover transition-colors border border-border"
                  >
                    <div className={`rounded-full p-2 shrink-0 ${r.reminderType === 'birthday' ? 'bg-rose-100 text-rose-600' : 'bg-purple-100 text-purple-600'}`}>
                      {r.reminderType === 'birthday' ? <Gift className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{r.reminderType}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium text-primary">{formatDaysAway(r.daysAway)}</p>
                      {r.phoneNumber && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                          <Phone className="h-3 w-3" />{r.phoneNumber}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
