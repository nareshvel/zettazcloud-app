import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode; // Content for the modal title
  children: React.ReactNode; // Content for the modal body
  footerContent?: React.ReactNode; // Custom content for the footer
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full'; // Tailwind max-width
  dialogClassName?: string; // Allow passing custom classes to the dialog container
  hideHeaderCloseButton?: boolean; // Option to hide the default header close button
  closeOnBackdropClick?: boolean; // If false, clicking the backdrop will not close the modal
}

const ModalBase: React.FC<ModalBaseProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footerContent,
  size = '3xl',
  dialogClassName = '',
  hideHeaderCloseButton = false,
  closeOnBackdropClick = true, // Default to true to maintain original behavior
}) => {
  if (!isOpen) return null;

  const sizeClasses: { [key: string]: string } = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={() => {
        if (closeOnBackdropClick) {
          onClose();
        }
      }}
    >
      <div 
        className={`bg-card rounded-lg shadow-xl w-full ${sizeClasses[size]} ${dialogClassName} mx-auto my-4 sm:my-8 relative flex flex-col max-h-[92vh] sm:max-h-[90vh]`} 
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        {/* Modal Header */}
        <div className="flex-shrink-0 flex justify-between items-center p-4 md:p-5 border-b border-primary/20 bg-primary rounded-t-lg">
          <h3 className="text-xl font-semibold text-white">
            {title}
          </h3>
          {!hideHeaderCloseButton && (
            <Button variant="ghost" onClick={onClose} className="text-primary-foreground hover:bg-primary-foreground/10 p-1">
              <X size={20} />
              <span className="sr-only">Close modal</span>
            </Button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-5 space-y-4 overflow-y-auto flex-grow">
          {children}
        </div>

        {/* Modal Footer */}
        {footerContent !== undefined ? (
          <div className="flex-shrink-0 flex items-center justify-end p-4 md:p-5 border-t border-primary/20 space-x-3 rounded-b-lg">
            {footerContent}
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center justify-end p-4 md:p-5 border-t border-primary/20 space-x-3 bg-primary rounded-b-lg">
            <Button variant="outline" onClick={onClose} className="bg-white dark:bg-card text-primary border-white hover:bg-gray-100 dark:bg-muted hover:text-primary hover:border-gray-100 dark:border-border">
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalBase;
