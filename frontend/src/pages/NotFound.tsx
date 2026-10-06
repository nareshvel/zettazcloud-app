import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-muted/50 px-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
          <AlertCircle className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-foreground">404</h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-muted-foreground">Page not found</p>
        <p className="mt-1 text-gray-500 dark:text-muted-foreground">The page you are looking for doesn't exist or has been moved.</p>
        
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90"
          >
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;