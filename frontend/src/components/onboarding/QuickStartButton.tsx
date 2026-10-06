import React, { useState } from 'react';
import { Rocket } from 'lucide-react';
import QuickStartGuide from './QuickStartGuide';

interface QuickStartButtonProps {
  className?: string;
}

const QuickStartButton: React.FC<QuickStartButtonProps> = ({ className = '' }) => {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className={`bg-primary hover:bg-primary-dark text-white font-normal h-9 w-9 sm:w-auto px-0 sm:px-4 rounded-lg flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-opacity-75 ${className}`}
        title="Quick Start Guide"
      >
        <Rocket size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Quick Start</span>
      </button>

      <QuickStartGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
      />
    </>
  );
};

export default QuickStartButton;
