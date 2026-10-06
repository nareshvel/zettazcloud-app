import React, { useState, useEffect } from 'react';
import { checkJwtSecretSync } from '@/utils/jwtSync';
import { fetchApi } from '@/services/api';
import { decodeToken } from '@/utils/jwt';

const JwtVerificationTest: React.FC = () => {
  const [secretSyncStatus, setSecretSyncStatus] = useState<{
    isInSync: boolean;
    message: string;
  } | null>(null);
  
  const [token, setToken] = useState<string | null>(null);
  const [tokenDecoded, setTokenDecoded] = useState<any | null>(null);
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Get the current token
    const currentToken = localStorage.getItem('auth_token');
    setToken(currentToken);
    
    if (currentToken) {
      setTokenDecoded(decodeToken(currentToken));
    }
    
    // Check if JWT secrets are in sync
    checkSecretSync();
  }, []);

  const checkSecretSync = async () => {
    try {
      setLoading(true);
      const result = await checkJwtSecretSync();
      setSecretSyncStatus(result);
    } catch (err) {
      setError('Failed to check JWT secret sync');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const verifyToken = async () => {
    if (!token) {
      setError('No token available to verify');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Call the debug endpoint to verify the token
      const result = await fetchApi('/api/debug/verify-token', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      
      setVerificationResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to verify token');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const testProtectedEndpoint = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call a protected endpoint to test authentication
      const result = await fetchApi('/api/users/profile', {
        method: 'GET'
      });
      
      setVerificationResult({
        status: 'success',
        message: 'Successfully accessed protected endpoint',
        data: result
      });
    } catch (err: any) {
      setError(err.message || 'Failed to access protected endpoint');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-card shadow">
      <h2 className="text-xl font-bold mb-4">JWT Verification Diagnostic</h2>
      
      <div className="mb-6">
        <h3 className="font-semibold mb-2">JWT Secret Synchronization</h3>
        {loading && secretSyncStatus === null ? (
          <p className="text-gray-500 dark:text-muted-foreground">Checking secret sync status...</p>
        ) : secretSyncStatus ? (
          <div className={`p-3 rounded ${secretSyncStatus.isInSync ? 'bg-green-100' : 'bg-red-100'}`}>
            <p className={secretSyncStatus.isInSync ? 'text-green-700' : 'text-red-700'}>
              {secretSyncStatus.isInSync ? '✅ ' : '❌ '}
              {secretSyncStatus.message}
            </p>
          </div>
        ) : (
          <p className="text-red-500">Failed to check secret sync status</p>
        )}
        <button 
          onClick={checkSecretSync}
          className="mt-2 px-3 py-1 bg-primary text-white rounded hover:bg-primary/90"
          disabled={loading}
        >
          Check Again
        </button>
      </div>

      <div className="mb-6">
        <h3 className="font-semibold mb-2">Current Token</h3>
        {token ? (
          <>
            <div className="p-2 bg-gray-100 dark:bg-muted rounded overflow-auto max-h-20 mb-2">
              <code className="text-xs break-all">{token}</code>
            </div>
            {tokenDecoded && (
              <div className="mt-2">
                <h4 className="font-medium">Decoded Token:</h4>
                <pre className="p-2 bg-gray-100 dark:bg-muted rounded overflow-auto max-h-40 text-xs">
                  {JSON.stringify(tokenDecoded, null, 2)}
                </pre>
              </div>
            )}
          </>
        ) : (
          <p className="text-red-500">No token found in localStorage</p>
        )}
      </div>

      <div className="mb-6 space-y-2">
        <button 
          onClick={verifyToken}
          className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 mr-2"
          disabled={loading || !token}
        >
          Verify Token with Backend
        </button>
        
        <button 
          onClick={testProtectedEndpoint}
          className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          disabled={loading}
        >
          Test Protected Endpoint
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 rounded mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {verificationResult && (
        <div className="mt-4">
          <h3 className="font-semibold mb-2">Verification Result:</h3>
          <pre className="p-3 bg-gray-100 dark:bg-muted rounded overflow-auto max-h-60 text-xs">
            {JSON.stringify(verificationResult, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-border">
        <h3 className="font-semibold mb-2">Troubleshooting Tips:</h3>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>If verification fails with "invalid signature", confirm frontend and backend JWT secrets match</li>
          <li>Check that your token hasn't expired (exp date in decoded token)</li>
          <li>Ensure the token contains the required fields (id, tenant_id, store_id)</li>
          <li>If all else fails, try logging out and logging back in to get a fresh token</li>
          <li>For development only: Check backend console logs for JWT verification details</li>
        </ul>
      </div>
    </div>
  );
};

export default JwtVerificationTest;
