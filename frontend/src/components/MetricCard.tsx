import React from 'react';

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactElement;
  footerText: string;
  iconBgClass?: string;
  iconClass?: string;
  footerBgClass?: string;
  footerTextClass?: string;
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  footerText,
  iconBgClass = 'bg-gray-100',
  iconClass = 'text-gray-600',
  footerBgClass = 'bg-gray-200',
  footerTextClass = 'text-gray-700',
  className,
  onClick,
  isClickable,
}) => {
  const cardClasses = [
    'bg-white dark:bg-card shadow-lg rounded-xl overflow-hidden flex flex-col border border-gray-100 dark:border-border hover:shadow-xl transition-shadow duration-200',
    className || '',
    isClickable ? 'cursor-pointer hover:border-primary/30' : '',
  ].join(' ').trim();

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
    >
      {/* Main Content */}
      <div className="p-3 md:p-5 flex-grow bg-gradient-to-br from-white to-gray-50/30">
        <div className="flex flex-col md:flex-row items-start md:justify-between gap-2">
          <div className="flex-grow w-full">
            <h3 className="text-[10px] md:text-xs font-semibold text-gray-600 dark:text-muted-foreground uppercase tracking-wider line-clamp-2">{title}</h3>
            <p className="text-xl md:text-3xl font-bold text-gray-900 dark:text-foreground mt-1 md:mt-2">{value}</p>
          </div>
          <div className={`p-2 md:p-3 rounded-xl ${iconBgClass} self-end md:self-start shadow-sm`}>
            {React.cloneElement(icon, { size: 18, className: `md:w-6 md:h-6 ${iconClass}` })}
          </div>
        </div>
      </div>

      {/* Footer - Hidden on mobile */}
      {footerText && (
        <div className={`hidden md:block px-4 py-2.5 ${footerBgClass} border-t border-gray-100`}>
          <p className={`text-xs font-semibold ${footerTextClass}`}>{footerText}</p>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
