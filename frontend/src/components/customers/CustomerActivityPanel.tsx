import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import axiosInstance from '../../services/axiosConfig';

interface ActivityLog {
  id: string;
  customer_id: string;
  user_id: string;
  activity_type: string;
  description: string;
  created_at: string;
  user_first_name?: string;
  user_last_name?: string;
}

interface CustomerActivityPanelProps {
  customerId: string;
}

const ActivityTypeIcons: Record<string, string> = {
  contact_added: '👤',
  contact_updated: '✏️',
  contact_deleted: '🗑️',
  customer_created: '✨',
  customer_updated: '📝',
  payment_received: '💰',
  invoice_sent: '📧',
  note_added: '📌',
  default: '📋'
};

const formatActivityType = (type: string): string => {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const CustomerActivityPanel: React.FC<CustomerActivityPanelProps> = ({ customerId }) => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    if (!customerId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await axiosInstance.get(`/api/customers/${customerId}/activities`);
      if (response.data?.success) {
        setActivities(response.data.data || []);
      } else {
        setError('Failed to load activities');
        console.error('Failed to fetch activities:', response.data?.message);
      }
    } catch (error) {
      setError('An error occurred while loading activities');
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [customerId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  const getActivityIcon = (activityType: string) => {
    return ActivityTypeIcons[activityType] || ActivityTypeIcons.default;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-text-primary">Recent Activity</h3>
        <button 
          onClick={fetchActivities}
          className="text-primary text-sm hover:underline"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-text-secondary">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mx-auto"></div>
          <div className="mt-2">Loading activities...</div>
        </div>
      ) : error ? (
        <div className="py-6 text-center text-danger-text">
          {error}
        </div>
      ) : activities.length === 0 ? (
        <div className="py-6 text-center text-text-secondary">
          No activity records found
        </div>
      ) : (
        <div className="divide-y divide-border">
          {activities.map(activity => (
            <div key={activity.id} className="py-4 flex">
              <div className="w-24 text-sm text-text-secondary">
                {formatDate(activity.created_at)}
                <div className="text-xs">{formatTime(activity.created_at)}</div>
              </div>
              <div className="w-8 flex-shrink-0 flex justify-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {getActivityIcon(activity.activity_type)}
                </div>
              </div>
              <div className="ml-3 flex-1">
                <div className="text-text-primary font-medium">
                  {formatActivityType(activity.activity_type)}
                </div>
                <div className="text-sm text-text-secondary mt-1">
                  {activity.description}
                </div>
                {activity.user_first_name && (
                  <div className="text-xs text-text-secondary mt-1">
                    By {activity.user_first_name} {activity.user_last_name || ''}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerActivityPanel;
