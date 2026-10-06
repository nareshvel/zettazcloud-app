import React from 'react';
import { format } from 'date-fns';
import { ActivityLog } from '../services/activityLogService';

interface ActivityLogItemProps {
  log: ActivityLog;
  onViewDetails: (log: ActivityLog) => void;
}

const ActivityLogItem: React.FC<ActivityLogItemProps> = ({ log, onViewDetails }) => {
  return (
    <div style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
      <div>
        <h3 style={{ fontWeight: 'bold' }}>
          {log.username || `User ID: ${log.user_id}`}
        </h3>
        <p style={{ fontSize: '0.8em', color: '#555' }}>
          {format(new Date(log.timestamp), 'MMM dd, yyyy, p')}
        </p>
      </div>
      <p>
        <strong>Action:</strong> {log.action_type ? log.action_type.replace(/_/g, ' ') : 'UNKNOWN ACTION'}
      </p>
      {log.description && (
        <p>
          {log.description}
        </p>
      )}
      {log.details && (
        <button 
          onClick={() => onViewDetails(log)}
          style={{ marginTop: '5px', color: 'blue', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          View Details
        </button>
      )}
    </div>
  );
};

export default ActivityLogItem;
