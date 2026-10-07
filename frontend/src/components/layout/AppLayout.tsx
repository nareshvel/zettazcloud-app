 
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import MainLayout from './MainLayout';
import ImpersonationBanner from '@/components/system/ImpersonationBanner';

interface AppLayoutProps {
}

const AppLayout = ({}: AppLayoutProps) => {
  return (
    <MainLayout>
      {/* This content will be placed inside MainLayout's <main> tag */}
      <div className="flex flex-col h-full">
        <ImpersonationBanner />
        <TopBar />
        {/* This div is for the actual page content, with minimal top/left padding.
            Mobile navigation is the bottom tab bar (BottomNav.tsx, mounted by
            MainLayout below <main>); its "More" tab opens the sidebar drawer. */}
        <div className="flex-1 overflow-y-auto pt-2 pb-4">
          <Outlet />
        </div>
      </div>
    </MainLayout>
  );
};

export default AppLayout;
