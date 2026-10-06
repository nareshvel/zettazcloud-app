 
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import MainLayout from './MainLayout';

interface AppLayoutProps {
}

const AppLayout = ({}: AppLayoutProps) => {
  return (
    <MainLayout>
      {/* This content will be placed inside MainLayout's <main> tag */}
      <div className="flex flex-col h-full">
        <TopBar />
        {/* This div is for the actual page content, with minimal top/left padding.
            The fixed hamburger toggle button (Sidebar.tsx, `fixed top-4 left-4`,
            md:hidden) overlaps TopBar's own sticky row above, not this content area
            (content already starts below TopBar's h-16) — see TopBar.tsx's `pl-14`
            fix for the actual overlap. */}
        <div className="flex-1 overflow-y-auto pt-2 pb-4">
          <Outlet />
        </div>
      </div>
    </MainLayout>
  );
};

export default AppLayout;
