import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface NameInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
  title?: string;
  promptText?: string;
  placeholder?: string;
  submitButtonText?: string;
}

const NameInputModal: React.FC<NameInputModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title = 'Enter Name',
  promptText = 'Please enter a name for this order:',
  placeholder = 'Optional order name',
  submitButtonText = 'Save',
}) => {
  const [name, setName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(''); // Reset name when modal opens
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-card p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-gray-200 dark:bg-muted">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <p className="mb-3 text-sm text-gray-600 dark:text-muted-foreground">{promptText}</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            ref={nameInputRef}
            className="w-full px-3 py-2 border border-gray-300 dark:border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring mb-4"
          />
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-border rounded-md hover:bg-gray-100 dark:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
            >
              {submitButtonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NameInputModal;
