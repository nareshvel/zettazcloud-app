import React, { useEffect, useState } from 'react';
import { fetchApi } from '../services/api';
import { Role, parseRolesResponse } from '../services/roleService';

const RolesDebugPage: React.FC = () => {
  const [regularRoles, setRegularRoles] = useState<Role[]>([]);
  const [directRoles, setDirectRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch roles from regular API endpoint
        const regularResponse = await fetchApi<any>('/roles', { method: 'GET' });
        console.log('Regular API response:', regularResponse);
        
        // Fetch roles from direct debug endpoint
        const directResponse = await fetchApi<any>('/direct-debug/roles', { method: 'GET' });
        console.log('Direct debug API response:', directResponse);
        
        // Parse and set regular API roles
        const parsedRegularRoles = parseRolesResponse(regularResponse);
        setRegularRoles(parsedRegularRoles);
        
        // Set direct debug roles
        setDirectRoles(directResponse.roles || []);
      } catch (err) {
        console.error('Error fetching roles:', err);
        setError('Failed to fetch roles. See console for details.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Roles Debug Page</h1>
      
      {loading && <p className="mb-4">Loading roles...</p>}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Regular API Roles</h2>
          <p className="mb-2 text-gray-600 dark:text-muted-foreground">Count: {regularRoles.length}</p>
          <div className="bg-white dark:bg-card shadow rounded p-4">
            <pre className="whitespace-pre-wrap overflow-auto max-h-96">
              {JSON.stringify(regularRoles, null, 2)}
            </pre>
          </div>
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-2">Direct Debug API Roles</h2>
          <p className="mb-2 text-gray-600 dark:text-muted-foreground">Count: {directRoles.length}</p>
          <div className="bg-white dark:bg-card shadow rounded p-4">
            <pre className="whitespace-pre-wrap overflow-auto max-h-96">
              {JSON.stringify(directRoles, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RolesDebugPage;
