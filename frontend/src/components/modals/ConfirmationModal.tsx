import React from 'react';
import { AlertTriangle, CheckCircle, Info, HelpCircle } from 'lucide-react';
import ModalBase from '@/components/ui/ModalBase'; 
import { Button } from '@/components/ui/button'; 

export type ConfirmationModalVariant = 'primary' | 'danger' | 'success' | 'warning' | 'info';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void; 
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmButtonText?: string;
  cancelButtonText?: string;
  variant?: ConfirmationModalVariant;
  customIcon?: React.ReactNode;
  isConfirmLoading?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl'; 
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmButtonText = 'Confirm',
  cancelButtonText = 'Cancel',
  variant = 'primary',
  customIcon,
  isConfirmLoading = false,
  size = 'md', 
}) => {
  
  let confirmButtonVariantStyle: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" = "default";
  let iconContainerClasses = 'mr-3 flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full ';
  let IconComponent: React.ReactNode;

  switch (variant) {
    case 'danger':
      confirmButtonVariantStyle = 'destructive'; 
      iconContainerClasses += 'bg-danger-light text-danger';
      IconComponent = <AlertTriangle size={22} />;
      break;
    case 'success':
      
      iconContainerClasses += 'bg-success-light text-success';
      IconComponent = <CheckCircle size={22} />;
      
      break;
    case 'warning':
      
      iconContainerClasses += 'bg-warning-light text-warning-text';
      IconComponent = <AlertTriangle size={22} />;
      
      break;
    case 'info':
      iconContainerClasses += 'bg-blue-100 text-primary';
      IconComponent = <Info size={22} />;
      break;
    case 'primary':
    default:
      
      iconContainerClasses += 'bg-primary-light text-primary';
      IconComponent = <HelpCircle size={22} />;
      break;
  }

  const finalIcon = customIcon !== undefined ? customIcon : IconComponent;

  const modalBodyContent = (
    <div className="flex items-start">
      {finalIcon && <div className={`${iconContainerClasses} mr-4`}>{finalIcon}</div>}
      <div className="flex-1">
        
        {typeof message === 'string' ? <p className="text-sm text-text-secondary">{message}</p> : message}
      </div>
    </div>
  );

  const modalFooterContent = (
    <>
      <Button
        variant="outline" 
        onClick={onClose}
        disabled={isConfirmLoading}
        className="shadow-sm"
      >
        {cancelButtonText}
      </Button>
      <Button
        variant={confirmButtonVariantStyle} 
        onClick={onConfirm}
        disabled={isConfirmLoading}
        className={`shadow-sm ${variant === 'success' ? 'bg-success text-success-foreground hover:bg-success/90' : ''} ${variant === 'warning' ? 'bg-warning text-warning-foreground hover:bg-warning/90' : ''}`}
      >
        {isConfirmLoading ? (
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : null}
        {isConfirmLoading ? 'Processing...' : confirmButtonText}
      </Button>
    </>
  );

  
  return (
    <ModalBase
      isOpen={isOpen}
      onClose={isConfirmLoading ? () => {} : onClose} 
      title={title} 
      footerContent={modalFooterContent}
      size={size as any} 
    >
      {modalBodyContent}
    </ModalBase>
  );
};

export default ConfirmationModal;
