import React from 'react';
import packageJson from '../../../package.json';

/**
 * VersionInfo Component
 * Displays the current application version from package.json
 * Only visible in development mode
 */
const VersionInfo: React.FC = () => {
  const isDev = import.meta.env.DEV;
  
  if (!isDev) return null;
  
  return (
    <div className="fixed bottom-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg opacity-50 hover:opacity-100 transition-opacity z-50">
      v{packageJson.version}
    </div>
  );
};

export default VersionInfo;
