import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import HelpSystem from './HelpSystem';

interface HelpButtonProps {
  contextualTopic?: string;
  className?: string;
}

const HelpButton: React.FC<HelpButtonProps> = ({ contextualTopic, className = '' }) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowHelp(true)}
        className={`flex items-center justify-center p-2 text-gray-600 dark:text-muted-foreground hover:text-primary hover:bg-blue-50 rounded-lg transition-colors ${className}`}
        title="Get Help"
      >
        <HelpCircle size={20} />
      </button>
      
      <HelpSystem
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        contextualTopic={contextualTopic}
      />
    </>
  );
};

export default HelpButton;
