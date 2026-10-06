import { useMemo } from 'react';
import { usePrintAgentStatus } from './usePrintAgentStatus';

export interface AppNotification {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'warning';
  /** Route to send the user to when they click the notification. */
  actionPath: string;
  actionLabel: string;
}

/**
 * Central place to assemble the notification list shown under the bell icon
 * (Sales Hub and POS Screen top bars). Currently only surfaces Print Agent
 * pairing problems, but is intentionally a single hook returning a flat list
 * so other notification sources (low stock, pending approvals, etc.) can be
 * added here later without every consumer needing to know about each source
 * individually — they just render whatever this hook returns.
 */
export function useAppNotifications(): AppNotification[] {
  const printAgentStatus = usePrintAgentStatus();

  return useMemo(() => {
    const items: AppNotification[] = [];

    if (printAgentStatus === 'origin-blocked') {
      items.push({
        id: 'print-agent-origin-blocked',
        title: 'Print Agent is blocking this app',
        description: `Zettaz Print Agent is running on this device, but it isn't accepting requests from ${window.location.origin} yet — its allowed-origins list doesn't include this address. Add it in the agent's settings (ZETTAZ_AGENT_ALLOWED_ORIGINS) or open a browser tab pointed at an already-allowed address, then reload.`,
        severity: 'warning',
        actionPath: '/print-agent',
        actionLabel: 'View details',
      });
    } else if (printAgentStatus === 'not-paired') {
      items.push({
        id: 'print-agent-not-paired',
        title: 'Print Agent not paired',
        description: 'Zettaz Print Agent is running on this device but this browser has never been paired with it. Printing to system/network printers will fail until paired.',
        severity: 'warning',
        actionPath: '/print-agent',
        actionLabel: 'Pair now',
      });
    } else if (printAgentStatus === 'invalid-pairing') {
      items.push({
        id: 'print-agent-invalid-pairing',
        title: 'Print Agent pairing expired',
        description: 'This browser’s Print Agent pairing is no longer valid — often after the agent app was reinstalled. Re-pair to restore printing.',
        severity: 'warning',
        actionPath: '/print-agent',
        actionLabel: 'Re-pair',
      });
    }

    return items;
  }, [printAgentStatus]);
}
