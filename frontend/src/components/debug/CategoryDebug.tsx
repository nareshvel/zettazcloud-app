import React, { useState, useEffect } from 'react';
import { getCategories } from '@/services/api';

const CategoryDebug: React.FC = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [rawResponse, setRawResponse] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testCategoriesAPI = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[CATEGORY DEBUG] Making API call to getCategories...');
      
      // Test the API call
      const result = await getCategories('all'); // Fetch all categories for debugging
      console.log('[CATEGORY DEBUG] API Response:', result);
      
      setCategories(result);
      setRawResponse(JSON.stringify(result, null, 2));
      
      // Log each category's imageUrl property
      result.forEach((category, index) => {
        console.log(`[CATEGORY DEBUG] Category ${index + 1}:`, {
          name: category.name,
          imageUrl: category.imageUrl,
          image_url: (category as any).image_url,
          hasImageUrl: 'imageUrl' in category,
          hasImage_url: 'image_url' in category,
          allKeys: Object.keys(category)
        });
      });
      
    } catch (err) {
      console.error('[CATEGORY DEBUG] API Error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testCategoriesAPI();
  }, []);

  return (
    <div className="p-4 bg-gray-100 dark:bg-muted rounded-lg">
      <h3 className="text-lg font-bold mb-4">Category API Debug</h3>
      
      <button 
        onClick={testCategoriesAPI}
        disabled={loading}
        className="mb-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Categories API'}
      </button>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="mb-4">
        <strong>Categories Count:</strong> {categories.length}
      </div>
      
      {categories.length > 0 && (
        <div className="mb-4">
          <strong>Sample Category Keys:</strong> {Object.keys(categories[0]).join(', ')}
        </div>
      )}
      
      <div className="mb-4">
        <strong>Raw Response:</strong>
        <pre className="mt-2 p-3 bg-gray-200 dark:bg-muted rounded text-xs overflow-auto max-h-40">
          {rawResponse || 'No data'}
        </pre>
      </div>
      
      {categories.map((category, index) => (
        <div key={index} className="mb-2 p-2 bg-white dark:bg-card rounded border">
          <div><strong>Name:</strong> {category.name}</div>
          <div><strong>imageUrl:</strong> {String(category.imageUrl)}</div>
          <div><strong>Type of imageUrl:</strong> {typeof category.imageUrl}</div>
          <div><strong>Has imageUrl property:</strong> {'imageUrl' in category ? 'Yes' : 'No'}</div>
        </div>
      ))}
    </div>
  );
};

export default CategoryDebug;
