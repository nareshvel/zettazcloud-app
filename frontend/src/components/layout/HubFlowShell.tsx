import { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { Gem } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationsBell from '@/components/common/NotificationsBell';

/**
 * Chromeless top bar + content outlet for pages launched from Sales Hub —
 * Repairs, Old Gold, Savings Schemes, Layaway, Sales Orders, Sales Return
 * (jewelry tenants only; see IndustryAwareLayout.tsx for the industry
 * check that decides whether a route renders this or the regular
 * AppLayout sidebar).
 *
 * Deliberately mirrors POSScreen.tsx's own header exactly (same logo/clock
 * on the left, same Sales Hub / Notifications / user-menu cluster on the
 * right) so Hub, POS, and every Hub-launched page feel like one consistent
 * "counter suite" instead of some screens having a sidebar and others not
 * for no visible reason. The only structural difference from AppLayout is
 * what replaces the sidebar: a single "Back to Sales Hub" link, since that's
 * now the sole way into whichever page rendered here.
 */
const HubFlowShell = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="bg-card/75 backdrop-blur-sm shadow-sm p-4 flex items-center justify-between sticky top-0 z-20 border-b border-border">
        <div className="flex items-center space-x-4">
          <Link to="/sales-hub" className="flex items-center gap-2 shrink-0" aria-label="Back to Sales Hub" title="Back to Sales Hub">
            <img
              src="/images/zettaz-cloud-logo-dark.png"
              alt="Zettaz Cloud"
              className="h-8 block dark:hidden"
              onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png'; }}
            />
            <img
              src="/images/zettaz-cloud-logo-light.png"
              alt="Zettaz Cloud"
              className="h-8 hidden dark:block"
              onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png'; }}
            />
          </Link>
        </div>

        <div className="flex items-center space-x-2 md:space-x-3">
          <Link
            to="/sales-hub"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-muted focus:outline-none transition-colors text-sm font-medium text-gray-700 dark:text-foreground"
            aria-label="Back to Sales Hub"
          >
            <Gem size={18} className="text-gray-600 dark:text-muted-foreground" />
            <span className="hidden sm:inline">Sales Hub</span>
          </Link>

          <NotificationsBell
            buttonClassName="p-1.5 hover:bg-gray-100 dark:bg-muted focus:outline-none focus:bg-gray-100 dark:bg-muted"
            iconClassName="text-gray-600 dark:text-muted-foreground"
          />

          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
                <span className="text-sm font-medium text-primary">
                  {user?.first_name ? user.first_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : '?')}
                </span>
              </div>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-card rounded-md shadow-lg py-1 z-50 border border-border">
                <div className="px-4 py-2 text-sm text-foreground/80 border-b border-border">
                  <p className="font-medium">
                    {user?.first_name && user?.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user?.first_name || user?.username || 'User'}
                  </p>
                  <p className="text-xs">{user?.email || 'user@example.com'}</p>
                </div>

                {user?.role?.toLowerCase() !== 'cashier' && (
                  <Link
                    to="/dashboard"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}

                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Settings
                </Link>
                <div className="border-t border-border my-1"></div>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500 hover:text-white transition-colors duration-150"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-2 pb-4">
        <Outlet />
      </div>
    </div>
  );
};

export default HubFlowShell;
