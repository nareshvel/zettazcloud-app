import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const StorageDebugger: React.FC = () => {
  const navigate = useNavigate();
  const [storageItems, setStorageItems] = useState<{key: string, value: string}[]>([]);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  
  useEffect(() => {
    refreshStorageItems();
  }, []);
  
  const refreshStorageItems = () => {
    const items: {key: string, value: string}[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        items.push({ key, value });
      }
    }
    setStorageItems(items);
  };
  
  const handleAddItem = () => {
    if (newKey && newValue) {
      localStorage.setItem(newKey, newValue);
      refreshStorageItems();
      setNewKey('');
      setNewValue('');
    }
  };
  
  const handleRemoveItem = (key: string) => {
    localStorage.removeItem(key);
    refreshStorageItems();
  };
  
  const handleSetupTestData = () => {
    // Set up test data for tenant_id and store_id
    localStorage.setItem('tenant_id', '1');
    localStorage.setItem('store_id', '1');
    localStorage.setItem('token', 'test_token');
    refreshStorageItems();
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">LocalStorage Debugger</h1>
      
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Quick Setup</h2>
        <button 
          onClick={handleSetupTestData}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Set Up Test Data (tenant_id=1, store_id=1)
        </button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Add New Item</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Key"
            className="border p-2 rounded"
          />
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Value"
            className="border p-2 rounded"
          />
          <button 
            onClick={handleAddItem}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Add
          </button>
        </div>
      </div>
      
      <div>
        <h2 className="text-lg font-semibold mb-2">Current Items</h2>
        <table className="min-w-full bg-white dark:bg-card border">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b">Key</th>
              <th className="py-2 px-4 border-b">Value</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {storageItems.map((item, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                <td className="py-2 px-4 border-b">{item.key}</td>
                <td className="py-2 px-4 border-b overflow-hidden text-ellipsis max-w-xs">
                  {item.value.length > 50 ? `${item.value.substring(0, 50)}...` : item.value}
                </td>
                <td className="py-2 px-4 border-b">
                  <button 
                    onClick={() => handleRemoveItem(item.key)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-sm"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {storageItems.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-gray-500 dark:text-muted-foreground">
                  No items in localStorage
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6">
        <button 
          onClick={() => navigate(-1)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Back
        </button>
      </div>
    </div>
  );
};

export default StorageDebugger;
