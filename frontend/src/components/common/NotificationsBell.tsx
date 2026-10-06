import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { useAppNotifications } from '@/hooks/useAppNotifications';

interface NotificationsBellProps {
  className?: string;
  buttonClassName?: string;
  iconClassName?: string;
}

/**
 * Generic notification bell — a dropdown listing whatever
 * useAppNotifications() currently has (right now: Print Agent pairing
 * problems only). Badge dot only appears when there's something to act on;
 * clicking an item navigates to fix it and closes the panel. Shared between
 * SalesHubPage and POSScreen so both top bars behave identically.
 */
const NotificationsBell: React.FC<NotificationsBellProps> = ({ className = '', buttonClassName = '', iconClassName = '' }) => {
  const notifications = useAppNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`relative flex items-center justify-center rounded-full transition-shadow ${buttonClassName}`}
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell size={20} className={iconClassName} />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-card/95 backdrop-blur-md rounded-xl shadow-xl z-50 border border-border overflow-hidden">
          <div className="px-4 py-2.5 text-sm font-semibold text-foreground border-b border-border bg-muted/30">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground text-center">
              You're all caught up.
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => { setIsOpen(false); navigate(n.actionPath); }}
                    className="w-full text-left px-4 py-3 hover:bg-accent transition-colors flex items-start gap-2.5"
                  >
                    {n.severity === 'warning'
                      ? <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      : <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{n.description}</p>
                      <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-0.5">
                        {n.actionLabel} <ChevronRight className="h-3 w-3" />
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
