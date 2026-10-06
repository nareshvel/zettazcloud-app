import React from 'react';
import ModalBase from '@/components/ui/ModalBase'; 
import { Button } from '@/components/ui/button';   

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  confirmButtonVariant?: 'primary' | 'danger' | 'warning'; 
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  confirmButtonVariant = 'primary',
}) => {
  // isOpen is handled by ModalBase

  let confirmBtnVariant: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" = "default";
  let confirmBtnCustomClasses = "";

  switch (confirmButtonVariant) {
    case 'danger':
      confirmBtnVariant = 'destructive';
      break;
    case 'warning':
      // For warning, we might use 'default' variant and add custom yellow styling
      // Or, if you have a specific 'warning' variant in your Button component, use that.
      confirmBtnVariant = 'default'; // Or your specific warning variant
      confirmBtnCustomClasses = 'bg-yellow-500 hover:bg-yellow-600 text-white focus-visible:ring-yellow-400'; // Example custom class
      break;
    case 'primary':
    default:
      confirmBtnVariant = 'default'; // Standard primary button
      break;
  }

  const modalFooterContent = (
    <>
      <Button variant="outline" onClick={onClose}>
        {cancelButtonText}
      </Button>
      <Button variant={confirmBtnVariant} onClick={onConfirm} className={confirmBtnCustomClasses}>
        {confirmButtonText}
      </Button>
    </>
  );

  return (
    <ModalBase
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footerContent={modalFooterContent}
      size="md" // Original was max-w-md
    >
      <p className="text-gray-600 dark:text-muted-foreground text-sm whitespace-pre-wrap">{message}</p>
    </ModalBase>
  );
};

export default ConfirmationModal;
