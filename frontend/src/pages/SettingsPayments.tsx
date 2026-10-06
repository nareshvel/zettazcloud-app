import React, { useState, useEffect } from 'react';
import { fetchApi } from '@/services/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  CreditCard,
  Smartphone,
  DollarSign,
  Settings,
  Plus,
  Edit,
  Trash2,
  TestTube,
  CheckCircle,
  AlertCircle,
  Globe,
  Terminal,
} from "lucide-react";

// Types
interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  requiresTerminal: boolean;
  terminalId?: string;
  gatewayId?: string;
  integrationType: 'none' | 'terminal' | 'gateway';
  icon: string;
  sortOrder: number;
}

interface PaymentTerminal {
  id: string;
  terminalType: 'card' | 'phone';
  provider: string;
  terminalId: string;
  deviceName: string;
  isActive: boolean;
  lastConnectedAt?: Date;
}

interface PaymentGateway {
  id: string;
  gatewayType: 'stripe' | 'paypal' | 'razorpay' | 'square';
  isActive: boolean;
  isLiveMode: boolean;
  supportedCurrencies: string[];
  webhookEndpoint?: string;
}

const SettingsPayments: React.FC = () => {
  // State management
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [terminals, setTerminals] = useState<PaymentTerminal[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('methods');

  // Dialog states
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [gatewayDialogOpen, setGatewayDialogOpen] = useState(false);

  // Form states
  const [terminalForm, setTerminalForm] = useState({
    terminalType: 'card' as 'card' | 'phone',
    provider: '',
    terminalId: '',
    deviceName: '',
    apiEndpoint: '',
    apiKey: '',
  });

  const [gatewayForm, setGatewayForm] = useState({
    gatewayType: 'stripe' as 'stripe' | 'paypal' | 'razorpay' | 'square',
    isLiveMode: false,
    configData: {
      publishableKey: '',
      secretKey: '',
      webhookSecret: '',
    },
    supportedCurrencies: ['USD'],
  });

  // Load data on component mount
  useEffect(() => {
    loadPaymentData();
  }, []);

  const loadPaymentData = async () => {
    try {
      setLoading(true);
      
      // Load payment methods, terminals, and gateways in parallel
      const [methodsData, terminalsData, gatewaysData] = await Promise.all([
        fetchApi<any>('/api/payment-methods'),
        fetchApi<any>('/api/payment-terminals'),
        fetchApi<any>('/api/payment-gateways'),
      ]);

      setPaymentMethods(methodsData.paymentMethods || methodsData.data?.paymentMethods || methodsData || []);
      setTerminals(terminalsData.terminals || terminalsData.data?.terminals || terminalsData || []);
      setGateways(gatewaysData.gateways || gatewaysData.data?.gateways || gatewaysData || []);
    } catch (error) {
      console.error('Error loading payment data:', error);
      toast.error('Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  };

  // Payment method management
  const togglePaymentMethod = async (methodId: string, isActive: boolean) => {
    try {
      await fetchApi<void>(`/api/payment-methods/${methodId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      {
        setPaymentMethods(prev =>
          prev.map(method =>
            method.id === methodId ? { ...method, isActive } : method
          )
        );
        toast.success(`Payment method ${isActive ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Error updating payment method:', error);
      toast.error('Failed to update payment method');
    }
  };

  // Terminal management
  const handleAddTerminal = async () => {
    try {
      await fetchApi<void>('/api/payment-terminals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(terminalForm),
      });

      {
        toast.success('Terminal added successfully');
        setTerminalDialogOpen(false);
        setTerminalForm({
          terminalType: 'card',
          provider: '',
          terminalId: '',
          deviceName: '',
          apiEndpoint: '',
          apiKey: '',
        });
        loadPaymentData();
      }
    } catch (error) {
      console.error('Error adding terminal:', error);
      toast.error('Failed to add terminal');
    }
  };

  const testTerminal = async (terminalId: string) => {
    try {
      const result = await fetchApi<any>(`/api/payment-terminals/${terminalId}/test`, {
        method: 'POST',
      });
      toast.success(`Terminal test successful: ${result.message || 'Success'}`);
      loadPaymentData();
    } catch (error) {
      console.error('Error testing terminal:', error);
      toast.error('Terminal test failed');
    }
  };

  const deleteTerminal = async (terminalId: string) => {
    try {
      await fetchApi<void>(`/api/payment-terminals/${terminalId}`, {
        method: 'DELETE',
      });
      toast.success('Terminal deleted successfully');
      loadPaymentData();
    } catch (error) {
      console.error('Error deleting terminal:', error);
      toast.error('Failed to delete terminal');
    }
  };

  // Gateway management
  const handleAddGateway = async () => {
    try {
      await fetchApi<void>('/api/payment-gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gatewayForm),
      });

      {
        toast.success('Gateway configured successfully');
        setGatewayDialogOpen(false);
        setGatewayForm({
          gatewayType: 'stripe',
          isLiveMode: false,
          configData: {
            publishableKey: '',
            secretKey: '',
            webhookSecret: '',
          },
          supportedCurrencies: ['USD'],
        });
        loadPaymentData();
      }
    } catch (error) {
      console.error('Error configuring gateway:', error);
      toast.error('Failed to configure gateway');
    }
  };

  const testGateway = async (gatewayId: string) => {
    try {
      const result = await fetchApi<any>(`/api/payment-gateways/${gatewayId}/test`, {
        method: 'POST',
      });
      toast.success(`Gateway test successful: ${result.message || 'Success'}`);
    } catch (error) {
      console.error('Error testing gateway:', error);
      toast.error('Gateway test failed');
    }
  };

  // Helper functions
  const getPaymentMethodIcon = (code: string) => {
    switch (code) {
      case 'cash': return <DollarSign className="h-5 w-5" />;
      case 'card': return <CreditCard className="h-5 w-5" />;
      case 'upi': return <Smartphone className="h-5 w-5" />;
      case 'phone': return <Smartphone className="h-5 w-5" />;
      case 'on_account': return <Settings className="h-5 w-5" />;
      case 'none': return <CheckCircle className="h-5 w-5" />;
      default: return <DollarSign className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Settings</h1>
        <p className="text-muted-foreground">
          Manage payment methods, terminals, and gateway integrations
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="methods">Payment Methods</TabsTrigger>
          <TabsTrigger value="terminals">Terminals</TabsTrigger>
          <TabsTrigger value="gateways">Gateways</TabsTrigger>
        </TabsList>

        {/* Payment Methods Tab */}
        <TabsContent value="methods" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Payment Methods Configuration
              </CardTitle>
              <CardDescription>
                Enable or disable payment methods for your POS system. Terminal and gateway integration can be configured in their respective tabs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getPaymentMethodIcon(method.code)}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{method.name}</h3>
                        {method.code === 'cash' || method.code === 'none' || method.code === 'on_account' ? (
                          <Badge variant="secondary">System Default</Badge>
                        ) : null}
                        {method.requiresTerminal && (
                          <Badge variant="outline">Terminal Optional</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {method.code === 'cash' && 'Physical cash payments'}
                        {method.code === 'card' && 'Credit/Debit card payments'}
                        {method.code === 'upi' && 'Phone/Digital wallet payments'}
                        {method.code === 'on_account' && 'Charge to customer account'}
                        {method.code === 'none' && 'No payment required (free items)'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {method.integrationType === 'terminal' && (
                      <Badge variant="default" className="bg-blue-100 text-blue-800">
                        <Terminal className="h-3 w-3 mr-1" />
                        Terminal
                      </Badge>
                    )}
                    {method.integrationType === 'gateway' && (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <Globe className="h-3 w-3 mr-1" />
                        Gateway
                      </Badge>
                    )}
                    <Switch
                      checked={method.isActive}
                      onCheckedChange={(checked) => togglePaymentMethod(method.id, checked)}
                      disabled={method.code === 'cash' || method.code === 'none'}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Information Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
                <div className="space-y-2">
                  <h3 className="font-medium text-blue-900">Payment Method Configuration</h3>
                  <div className="text-sm text-blue-800 space-y-1">
                    <p>• <strong>Cash & No Payment Required:</strong> Always available (system defaults)</p>
                    <p>• <strong>Card & Phone:</strong> Can use terminals for physical payments or click-to-confirm</p>
                    <p>• <strong>Terminal Integration:</strong> Configure hardware terminals in the Terminals tab</p>
                    <p>• <strong>Gateway Integration:</strong> Configure online payment processing in the Gateways tab</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Terminals Tab */}
        <TabsContent value="terminals" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Payment Terminals</h2>
              <p className="text-muted-foreground">Manage physical payment terminals for card and phone processing</p>
            </div>
            <Button onClick={() => setTerminalDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Terminal
            </Button>
          </div>

          <div className="grid gap-4">
            {terminals.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No terminals configured</h3>
                    <p className="text-muted-foreground mb-4">
                      Add payment terminals to enable hardware-based card and phone processing
                    </p>
                    <Button onClick={() => setTerminalDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Terminal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              terminals.map((terminal) => (
                <Card key={terminal.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Terminal className="h-5 w-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{terminal.deviceName}</h3>
                            <Badge variant={terminal.isActive ? "default" : "secondary"}>
                              {terminal.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant="outline">
                              {terminal.terminalType.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {terminal.provider} • ID: {terminal.terminalId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testTerminal(terminal.id)}
                        >
                          <TestTube className="h-4 w-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteTerminal(terminal.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Gateways Tab */}
        <TabsContent value="gateways" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Payment Gateways</h2>
              <p className="text-muted-foreground">Configure online payment processing for Stripe, PayPal, and other providers</p>
            </div>
            <Button onClick={() => setGatewayDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </div>

          <div className="grid gap-4">
            {gateways.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <Globe className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No gateways configured</h3>
                    <p className="text-muted-foreground mb-4">
                      Add payment gateways to enable online payment processing
                    </p>
                    <Button onClick={() => setGatewayDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Gateway
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              gateways.map((gateway) => (
                <Card key={gateway.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Globe className="h-5 w-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium capitalize">{gateway.gatewayType}</h3>
                            <Badge variant={gateway.isActive ? "default" : "secondary"}>
                              {gateway.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Badge variant={gateway.isLiveMode ? "destructive" : "outline"}>
                              {gateway.isLiveMode ? "Live" : "Test"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Currencies: {gateway.supportedCurrencies.join(', ')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testGateway(gateway.id)}
                        >
                          <TestTube className="h-4 w-4 mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Terminal Dialog */}
      <Dialog open={terminalDialogOpen} onOpenChange={setTerminalDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Payment Terminal</DialogTitle>
            <DialogDescription>
              Configure a new payment terminal for card or phone processing
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="terminalType">Terminal Type</Label>
                <Select
                  value={terminalForm.terminalType}
                  onValueChange={(value: 'card' | 'phone') =>
                    setTerminalForm(prev => ({ ...prev, terminalType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card Terminal</SelectItem>
                    <SelectItem value="phone">Phone Terminal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={terminalForm.provider}
                  onValueChange={(value) =>
                    setTerminalForm(prev => ({ ...prev, provider: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {terminalForm.terminalType === 'card' ? (
                      <>
                        <SelectItem value="square">Square Reader</SelectItem>
                        <SelectItem value="stripe">Stripe Terminal</SelectItem>
                        <SelectItem value="clover">Clover</SelectItem>
                        <SelectItem value="ingenico">Ingenico</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="paytm">Paytm Soundbox</SelectItem>
                        <SelectItem value="razorpay">Razorpay POS</SelectItem>
                        <SelectItem value="pinelabs">Pine Labs</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="deviceName">Device Name</Label>
              <Input
                id="deviceName"
                value={terminalForm.deviceName}
                onChange={(e) =>
                  setTerminalForm(prev => ({ ...prev, deviceName: e.target.value }))
                }
                placeholder="e.g., Front Counter Terminal"
              />
            </div>
            <div>
              <Label htmlFor="terminalId">Terminal ID</Label>
              <Input
                id="terminalId"
                value={terminalForm.terminalId}
                onChange={(e) =>
                  setTerminalForm(prev => ({ ...prev, terminalId: e.target.value }))
                }
                placeholder="Provider's terminal identifier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminalDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTerminal}>Add Terminal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gateway Dialog */}
      <Dialog open={gatewayDialogOpen} onOpenChange={setGatewayDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Configure Payment Gateway</DialogTitle>
            <DialogDescription>
              Set up online payment processing with your preferred provider
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="gatewayType">Gateway Provider</Label>
                <Select
                  value={gatewayForm.gatewayType}
                  onValueChange={(value: 'stripe' | 'paypal' | 'razorpay' | 'square') =>
                    setGatewayForm(prev => ({ ...prev, gatewayType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="liveMode"
                  checked={gatewayForm.isLiveMode}
                  onCheckedChange={(checked) =>
                    setGatewayForm(prev => ({ ...prev, isLiveMode: checked }))
                  }
                />
                <Label htmlFor="liveMode">Live Mode</Label>
              </div>
            </div>
            
            {gatewayForm.gatewayType === 'stripe' && (
              <>
                <div>
                  <Label htmlFor="publishableKey">Publishable Key</Label>
                  <Input
                    id="publishableKey"
                    value={gatewayForm.configData.publishableKey}
                    onChange={(e) =>
                      setGatewayForm(prev => ({
                        ...prev,
                        configData: { ...prev.configData, publishableKey: e.target.value }
                      }))
                    }
                    placeholder="pk_test_..."
                  />
                </div>
                <div>
                  <Label htmlFor="secretKey">Secret Key</Label>
                  <Input
                    id="secretKey"
                    type="password"
                    value={gatewayForm.configData.secretKey}
                    onChange={(e) =>
                      setGatewayForm(prev => ({
                        ...prev,
                        configData: { ...prev.configData, secretKey: e.target.value }
                      }))
                    }
                    placeholder="sk_test_..."
                  />
                </div>
              </>
            )}

            {gatewayForm.gatewayType === 'paypal' && (
              <>
                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={gatewayForm.configData.publishableKey}
                    onChange={(e) =>
                      setGatewayForm(prev => ({
                        ...prev,
                        configData: { ...prev.configData, publishableKey: e.target.value }
                      }))
                    }
                    placeholder="AY..."
                  />
                </div>
                <div>
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    value={gatewayForm.configData.secretKey}
                    onChange={(e) =>
                      setGatewayForm(prev => ({
                        ...prev,
                        configData: { ...prev.configData, secretKey: e.target.value }
                      }))
                    }
                    placeholder="EH..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGatewayDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGateway}>Configure Gateway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPayments;
