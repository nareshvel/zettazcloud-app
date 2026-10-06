import React from 'react';
import { Construction } from 'lucide-react'; // Or any other suitable icon

const ComingSoonPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center p-6 bg-background text-text">
      <Construction size={64} className="mb-6 text-primary" />
      <h1 className="text-4xl font-bold mb-3">Coming Soon!</h1>
      <p className="text-lg text-text-secondary mb-2">
        We're working hard to bring this feature to you.
      </p>
      <p className="text-md text-text-tertiary">
        Please check back later.
      </p>
    </div>
  );
};

export default ComingSoonPage;
