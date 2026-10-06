import React from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * Maps a domain status string to a consistent Badge variant across the app.
 * Extend the map as new statuses appear rather than hand-rolling coloured spans.
 */
type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  // generic
  active: 'success', inactive: 'secondary', pending: 'warning', completed: 'success',
  cancelled: 'destructive', voided: 'destructive', refunded: 'secondary',
  // inventory / pieces
  available: 'success', hold: 'warning', sold: 'secondary', returned: 'info', melted: 'destructive',
  // repairs
  received: 'info', in_progress: 'warning', ready: 'success', delivered: 'secondary',
  // old gold
  valued: 'info', credited: 'success', redeemed: 'secondary',
};

const label = (s: string) => s.replace(/_/g, ' ');

const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => (
  <Badge variant={STATUS_VARIANT[status] || 'secondary'} className={`capitalize ${className || ''}`}>
    {label(status)}
  </Badge>
);

export default StatusBadge;
