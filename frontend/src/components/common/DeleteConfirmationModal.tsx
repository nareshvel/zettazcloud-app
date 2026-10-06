import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-foreground flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            {title}
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 dark:text-muted-foreground hover:text-gray-600 dark:text-muted-foreground p-1 rounded-full hover:bg-gray-100 dark:bg-muted"
          >
            <X size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-gray-700 dark:text-foreground">{message}</p>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-border rounded-md text-gray-700 dark:text-foreground hover:bg-gray-50 dark:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
