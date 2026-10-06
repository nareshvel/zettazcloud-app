import React, { useState } from 'react';
import Sidebar from './Sidebar';

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed(prevState => {
      return !prevState;
    });
  };

  return (
    <div className="flex h-screen bg-background-main">
      <Sidebar isCollapsed={isSidebarCollapsed} onToggleCollapse={handleToggleSidebarCollapse} />
      {/* Apply dynamic padding to main content area based on sidebar state */}
      {/* Sidebar is 18rem/4rem wide, positioned 0.75rem from top/left with 0.75rem right margin */}
      {/* Expanded: 0.75rem left + 18rem + 0.75rem gap = 19.5rem  */}
      {/* Collapsed: 0.75rem left + 4rem + 0.75rem gap = 5.5rem  */}
      {/* The main tag here is the container for TopBar + Page Content from AppLayout */}
      <main className={`flex-1 overflow-auto pt-0 pb-6 transition-all duration-300 ease-in-out \
                       ${isSidebarCollapsed ? 'md:pl-[5.5rem]' : 'md:pl-[19.5rem]'}`}> 
                       {/* Adjusted to remove explicit gap from here, gap can be part of page content padding if needed */}
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
