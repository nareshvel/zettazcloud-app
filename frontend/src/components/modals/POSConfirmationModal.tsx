import React from 'react';
import { AlertTriangle } from 'lucide-react'; 
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string | React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonClassName?: string; 
  icon?: React.ReactNode;
}

const POSConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonClassName = 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500', 
  icon = <AlertTriangle size={22} className="text-red-500" />, 
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose(); 
  };

  const modalTitleContent = (
    <div className="flex items-center">
      {icon}
      <span className="ml-2">{title}</span> 
    </div>
  );

  const modalFooterContent = (
    <div className="flex justify-end space-x-3">
      <Button variant="outline" onClick={onClose}>
        {cancelButtonText}
      </Button>
      <Button 
        onClick={handleConfirm} 
        className={confirmButtonClassName} 
      >
        {confirmButtonText}
      </Button>
    </div>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitleContent}
      size="md"
      footerContent={modalFooterContent}
    >
      <div className="p-1 text-sm text-gray-700 dark:text-foreground dark:text-gray-300">
        {typeof message === 'string' ? <p>{message}</p> : message}
      </div>
    </ModalBase>
  );
};

export default POSConfirmationModal;
