import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ExternalLink, 
  CreditCard, 
  Smartphone, 
  DollarSign, 
  CheckCircle, 
  User,
  Settings,
  AlertCircle,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentService } from '@/services/paymentService';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  requiresTerminal: boolean;
  icon: string;
  sortOrder: number;
  isSystemDefault?: boolean;
  terminalEnabled?: boolean;
}

const SettingsPayments = () => {
  const { user } = useAuth();
  // Method/terminal toggles map to payments.edit once the backend write is wired.
  const canEdit = hasPermission(user, 'payments.edit');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load payment methods on component mount
  useEffect(() => {
    loadPaymentMethods();
  }, []);

  const loadPaymentMethods = async () => {
    try {
      setLoading(true);
      const methods = await paymentService.getPaymentMethods();
      
      // Mark system defaults as non-editable
      const enhancedMethods = methods.map((method: PaymentMethod) => ({
        ...method,
        isSystemDefault: ['cash', 'none'].includes(method.code),
        terminalEnabled: method.requiresTerminal
      }));
      
      setPaymentMethods(enhancedMethods);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMethod = async (methodId: string, enabled: boolean) => {
    if (!canEdit) return;
    try {
      setSaving(true);
      // TODO: Implement backend API for updating payment method status
      // await paymentService.updatePaymentMethod(methodId, { isActive: enabled });
      
      setPaymentMethods(prev => 
        prev.map(method => 
          method.id === methodId 
            ? { ...method, isActive: enabled }
            : method
        )
      );
      
      toast.success(`Payment method ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating payment method:', error);
      toast.error('Failed to update payment method');
    } finally {
      setSaving(false);
    }
  };

  const toggleTerminalMode = async (methodId: string, terminalEnabled: boolean) => {
    if (!canEdit) return;
    try {
      setSaving(true);
      // TODO: Implement backend API for updating terminal mode
      // await paymentService.updatePaymentMethod(methodId, { requiresTerminal: terminalEnabled });
      
      setPaymentMethods(prev => 
        prev.map(method => 
          method.id === methodId 
            ? { ...method, requiresTerminal: terminalEnabled, terminalEnabled }
            : method
        )
      );
      
      toast.success(`Terminal mode ${terminalEnabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error updating terminal mode:', error);
      toast.error('Failed to update terminal mode');
    } finally {
      setSaving(false);
    }
  };

  const getMethodIcon = (iconName: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      'cash': <DollarSign className="h-5 w-5" />,
      'credit-card': <CreditCard className="h-5 w-5" />,
      'phone': <Smartphone className="h-5 w-5" />,
      'user': <User className="h-5 w-5" />,
      'check-circle': <CheckCircle className="h-5 w-5" />
    };
    return iconMap[iconName] || <Settings className="h-5 w-5" />;
  };

  const getMethodDescription = (method: PaymentMethod) => {
    const descriptions: { [key: string]: string } = {
      'cash': 'Accept cash payments at the point of sale',
      'card': 'Credit and debit card payments with optional terminal integration',
      'upi': 'UPI payments with optional terminal integration',
      'on_account': 'Charge payments to customer accounts',
      'none': 'For free items or promotional transactions'
    };
    return descriptions[method.code] || 'Payment method';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-muted rounded w-2/3"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-5">
        {/* Payment Methods Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Enable or disable payment methods for your store. Some methods support terminal integration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {paymentMethods.map((method, index) => (
              <div key={method.id}>
                <div className="flex items-center justify-between py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getMethodIcon(method.icon)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-foreground">{method.name}</h4>
                        {method.isSystemDefault && (
                          <Badge variant="secondary" className="text-xs">
                            System Default
                          </Badge>
                        )}
                        {method.code === 'card' || method.code === 'upi' ? (
                          <Badge variant="outline" className="text-xs">
                            Terminal Optional
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-muted-foreground">
                        {getMethodDescription(method)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {/* Terminal Mode Toggle for Card/UPI */}
                    {(method.code === 'card' || method.code === 'upi') && method.isActive && (
                      <div className="flex items-center space-x-2">
                        <Terminal className="h-4 w-4 text-gray-500 dark:text-muted-foreground" />
                        <Switch
                          checked={method.terminalEnabled}
                          onCheckedChange={(checked) => toggleTerminalMode(method.id, checked)}
                          disabled={saving || !canEdit}
                        />
                        <span className="text-xs text-gray-600 dark:text-muted-foreground">
                          {method.terminalEnabled ? 'Terminal' : 'Click to Pay'}
                        </span>
                      </div>
                    )}
                    
                    {/* Enable/Disable Toggle */}
                    <Switch
                      checked={method.isActive}
                      onCheckedChange={(checked) => togglePaymentMethod(method.id, checked)}
                      disabled={method.isSystemDefault || saving || !canEdit}
                    />
                  </div>
                </div>
                {index < paymentMethods.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Gateway Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              Gateway Integrations
            </CardTitle>
            <CardDescription>
              Connect external payment processors for advanced payment processing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Stripe Configuration */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-foreground">Stripe</h4>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">Credit card processing</p>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="stripe-pk">Publishable Key</Label>
                  <Input id="stripe-pk" placeholder="pk_live_..." disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stripe-sk">Secret Key</Label>
                  <Input id="stripe-sk" type="password" placeholder="sk_live_..." disabled />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <a 
                    href="https://dashboard.stripe.com/apikeys" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-primary hover:underline flex items-center"
                  >
                    Get your API keys
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                  <Button disabled size="sm">Connect Stripe</Button>
                </div>
              </div>
            </div>

            {/* PayPal Configuration */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-foreground">PayPal</h4>
                    <p className="text-sm text-gray-600 dark:text-muted-foreground">PayPal payments</p>
                  </div>
                </div>
                <Badge variant="outline">Not Connected</Badge>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="paypal-client-id">Client ID</Label>
                  <Input id="paypal-client-id" placeholder="Your PayPal Client ID" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paypal-secret">Client Secret</Label>
                  <Input id="paypal-secret" type="password" placeholder="Your PayPal Client Secret" disabled />
                </div>
                <div className="flex items-center justify-between pt-2">
                  <a 
                    href="https://developer.paypal.com/developer/applications/" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-sm text-primary hover:underline flex items-center"
                  >
                    Get your credentials
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                  <Button disabled size="sm">Connect PayPal</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-medium text-blue-900">Payment Method Configuration</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>• <strong>System Defaults</strong>: Cash and "No Payment Required" are always available</p>
                  <p>• <strong>Terminal Mode</strong>: Card and UPI can use payment terminals or simple click-to-confirm</p>
                  <p>• <strong>Gateway Integration</strong>: Connect Stripe or PayPal for advanced payment processing</p>
                  <p>• <strong>Account Charges</strong>: Allow customers to charge purchases to their accounts</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPayments;
