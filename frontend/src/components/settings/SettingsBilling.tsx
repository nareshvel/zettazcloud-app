import React, { useEffect, useState } from 'react';
import { fetchApi } from '@/services/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CreditCard, Clock, AlertTriangle, Check, X } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  priceYearly: number | null;
  currency: string;
  features: Record<string, any> | null;
  limits: Record<string, any> | null;
  isActive: boolean;
}

interface SubscriptionStatus {
  id: string;
  tenantId: string;
  planId: string;
  status: 'active' | 'trial' | 'expired' | 'cancelled' | 'pending';
  startDate: string;
  endDate: string;
  trialEndDate: string | null;
  autoRenew: boolean;
  billingCycle?: 'monthly' | 'yearly';
  cancelAtPeriodEnd?: boolean;
  gracePeriodEndsAt?: string | null;
  stripeCustomerId?: string | null;
  plan?: PlanRow;
}

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  trial: { label: 'Trial', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
  pending: { label: 'Pending', variant: 'outline' },
};

// Human-readable labels for the boolean flags stored in `plans.features`.
// `support` is handled separately since it's a string tier, not a boolean.
const FEATURE_LABELS: Record<string, string> = {
  pointOfSale: 'Point of Sale',
  inventory: 'Inventory Management',
  basicReports: 'Basic Reports',
  advancedReports: 'Advanced Reports',
  customerManagement: 'Customer Management',
  multiUser: 'Multiple Users',
  multiStore: 'Multiple Stores',
  loyaltyProgram: 'Loyalty Program',
  apiAccess: 'API Access',
  customBranding: 'Custom Branding',
};

const LIMIT_LABELS: Record<string, (value: any) => string> = {
  stores: (v) => `${v} store${v === 1 ? '' : 's'}`,
  products: (v) => `${Number(v).toLocaleString()} products`,
  users: (v) => `${v} user${v === 1 ? '' : 's'}`,
  storage: (v) => `${v} storage`,
};

/** Ordered union of every boolean feature key across all plans, so every
 * plan's card lists the same rows and can be compared side by side. */
function collectFeatureKeys(plans: PlanRow[]): string[] {
  const keys: string[] = [];
  for (const plan of plans) {
    for (const key of Object.keys(plan.features || {})) {
      if (key === 'support') continue;
      if (!keys.includes(key)) keys.push(key);
    }
  }
  return keys;
}

/** Renders a plan's limits + support tier + full feature comparison as a
 * bulleted list. `featureKeys` is the union across all plans so every card
 * shows the same rows (checked or not) for easy side-by-side comparison. */
const PlanBullets: React.FC<{ plan: PlanRow; featureKeys: string[]; columns?: 1 | 2 }> = ({ plan, featureKeys, columns = 1 }) => {
  const limits = plan.limits || {};
  const features = plan.features || {};
  const limitEntries = Object.keys(LIMIT_LABELS).filter((key) => limits[key] !== undefined);

  return (
    <ul className={`gap-x-6 gap-y-1.5 text-sm ${columns === 2 ? 'grid grid-cols-1 sm:grid-cols-2' : 'space-y-1.5'}`}>
      {limitEntries.map((key) => (
        <li key={key} className="flex items-center gap-2 text-foreground">
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          {LIMIT_LABELS[key](limits[key])}
        </li>
      ))}
      {features.support && (
        <li className="flex items-center gap-2 text-foreground">
          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
          {String(features.support)} support
        </li>
      )}
      {featureKeys.map((key) => {
        const included = !!features[key];
        return (
          <li key={key} className={`flex items-center gap-2 ${included ? 'text-foreground' : 'text-muted-foreground'}`}>
            {included ? (
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            )}
            {FEATURE_LABELS[key] || key}
          </li>
        );
      })}
    </ul>
  );
};

const SettingsBilling: React.FC = () => {
  const { formatDate } = useLocaleFormat();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [statusRes, plansRes] = await Promise.all([
        fetchApi<SubscriptionStatus>('/subscriptions/status').catch(() => null),
        fetchApi<PlanRow[]>('/subscriptions/plans').catch(() => []),
      ]);
      setSubscription(statusRes);
      setPlans(Array.isArray(plansRes) ? plansRes : []);
    } catch (error) {
      console.error('Failed to load billing info', error);
      toast.error('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trialDaysRemaining = (() => {
    if (!subscription || subscription.status !== 'trial' || !subscription.trialEndDate) return null;
    const end = new Date(subscription.trialEndDate);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  })();

  const handleUpgrade = async (planId: string) => {
    setActionLoading(planId);
    try {
      const res = await fetchApi<{ url: string }>('/subscriptions/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId, billingCycle: 'monthly' }),
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error('Could not start checkout — no redirect URL returned');
      }
    } catch (error: any) {
      console.error('Checkout failed', error);
      toast.error(error?.message || 'Failed to start checkout');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const res = await fetchApi<{ url: string }>('/subscriptions/portal', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (res?.url) {
        window.location.href = res.url;
      } else {
        toast.error('Could not open billing portal — no redirect URL returned');
      }
    } catch (error: any) {
      console.error('Billing portal failed', error);
      toast.error(error?.message || 'Failed to open billing portal');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-64 w-full rounded-md bg-muted animate-pulse" />
      </div>
    );
  }

  const statusMeta = subscription ? STATUS_LABEL[subscription.status] : null;
  const featureKeys = collectFeatureKeys(plans);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your subscription status and plan details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!subscription ? (
            <p className="text-sm text-muted-foreground">No subscription found for your account.</p>
          ) : (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-semibold">{subscription.plan?.name || 'Unknown plan'}</span>
                {statusMeta && <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>}
                {subscription.cancelAtPeriodEnd && (
                  <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Cancels at period end</Badge>
                )}
              </div>

              {subscription.status === 'trial' && trialDaysRemaining !== null && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {trialDaysRemaining > 0
                    ? `${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'} remaining in your trial`
                    : 'Your trial has ended'}
                  {subscription.trialEndDate && ` (ends ${formatDate(subscription.trialEndDate)})`}
                </p>
              )}

              {subscription.gracePeriodEndsAt && (
                <p className="text-sm text-amber-600 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  Payment issue — please update your card by {formatDate(subscription.gracePeriodEndsAt)} to avoid interruption
                </p>
              )}

              {subscription.plan && (
                <div className="pt-1">
                  <PlanBullets plan={subscription.plan} featureKeys={featureKeys} columns={2} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {subscription.stripeCustomerId && (
                  <Button variant="outline" onClick={handleManageBilling} disabled={actionLoading === 'portal'}>
                    {actionLoading === 'portal' ? 'Opening…' : 'Manage Billing'}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{subscription?.plan ? 'Upgrade or Downgrade' : 'Choose a Plan'}</CardTitle>
          <CardDescription>
            {subscription?.stripeCustomerId
              ? 'Switch plans — upgrades apply immediately with prorated billing, downgrades apply at your next renewal.'
              : 'Add a payment method to move off your trial and keep your account active.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans
              .filter((plan) => plan.id !== subscription?.planId)
              .map((plan) => {
                const currentPrice = subscription?.plan?.priceMonthly;
                const isDowngrade = typeof currentPrice === 'number' && plan.priceMonthly < currentPrice;
                const actionLabel = !subscription?.plan
                  ? 'Get Started'
                  : isDowngrade
                    ? 'Downgrade'
                    : 'Upgrade';

                return (
                  <Card key={plan.id} className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-base">{plan.name}</CardTitle>
                      {plan.description && <CardDescription>{plan.description}</CardDescription>}
                    </CardHeader>
                    <CardContent className="flex flex-col flex-1 gap-4">
                      <div className="flex-1">
                        <PlanBullets plan={plan} featureKeys={featureKeys} />
                      </div>
                      <Button
                        className="w-full"
                        variant={isDowngrade ? 'outline' : 'default'}
                        disabled={actionLoading === plan.id}
                        onClick={() => handleUpgrade(plan.id)}
                      >
                        {actionLoading === plan.id ? 'Redirecting…' : actionLabel}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsBilling;
