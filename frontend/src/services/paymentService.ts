import { fetchApi } from './api';

export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  requiresTerminal: boolean;
  icon: string;
  sortOrder: number;
  created_at?: string;
  updated_at?: string;
}

export interface PaymentMethodUpdate {
  isActive?: boolean;
  requiresTerminal?: boolean;
  name?: string;
}

export interface PaymentGatewayConfig {
  stripe?: {
    publishableKey: string;
    secretKey: string;
    enabled: boolean;
  };
  paypal?: {
    clientId: string;
    clientSecret: string;
    enabled: boolean;
  };
}

// New interfaces for terminal and gateway management
export interface PaymentTerminal {
  id: string;
  terminalType: 'card' | 'phone';
  provider: string;
  terminalId: string;
  deviceName: string;
  isActive: boolean;
  lastConnectedAt?: Date;
  apiEndpoint?: string;
  configuration?: Record<string, any>;
}

export interface PaymentGateway {
  id: string;
  gatewayType: 'stripe' | 'paypal' | 'razorpay' | 'square';
  isActive: boolean;
  isLiveMode: boolean;
  supportedCurrencies: string[];
  webhookEndpoint?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TerminalCreateRequest {
  terminalType: 'card' | 'phone';
  provider: string;
  terminalId: string;
  deviceName: string;
  apiEndpoint?: string;
  apiKey?: string;
  configuration?: Record<string, any>;
}

export interface GatewayCreateRequest {
  gatewayType: 'stripe' | 'paypal' | 'razorpay' | 'square';
  isLiveMode?: boolean;
  configData: {
    publishableKey: string;
    secretKey: string;
    webhookSecret?: string;
  };
  supportedCurrencies?: string[];
}

export interface PaymentIntentRequest {
  saleId: string;
  amount: number;
  currency?: string;
  description?: string;
}

export interface TerminalPaymentRequest {
  saleId: string;
  amount: number;
  currency?: string;
}

class PaymentService {
  /**
   * Get all payment methods for the current tenant
   */
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await fetchApi<PaymentMethod[]>('/payment/methods', { method: 'GET' });
      return response || [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      throw error;
    }
  }

  /**
   * Update a payment method configuration
   */
  async updatePaymentMethod(methodId: string, updates: PaymentMethodUpdate): Promise<PaymentMethod> {
    try {
      const response = await fetchApi<PaymentMethod>(`/payment-methods/${methodId}`, { 
        method: 'PUT',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    } catch (error) {
      console.error('Error updating payment method:', error);
      throw error;
    }
  }

  /**
   * Enable or disable a payment method
   */
  async togglePaymentMethod(methodId: string, enabled: boolean): Promise<void> {
    try {
      await this.updatePaymentMethod(methodId, { isActive: enabled });
    } catch (error) {
      console.error('Error toggling payment method:', error);
      throw error;
    }
  }

  /**
   * Toggle terminal mode for a payment method
   */
  async toggleTerminalMode(methodId: string, requiresTerminal: boolean): Promise<void> {
    try {
      await this.updatePaymentMethod(methodId, { requiresTerminal });
    } catch (error) {
      console.error('Error toggling terminal mode:', error);
      throw error;
    }
  }

  /**
   * Get payment gateway configurations
   */
  async getPaymentGatewayConfig(): Promise<PaymentGatewayConfig> {
    try {
      const response = await fetchApi<PaymentGatewayConfig>('/payment-gateways/config', { method: 'GET' });
      return response || {};
    } catch (error) {
      console.error('Error fetching payment gateway config:', error);
      throw error;
    }
  }

  /**
   * Update payment gateway configuration
   */
  async updatePaymentGatewayConfig(config: Partial<PaymentGatewayConfig>): Promise<PaymentGatewayConfig> {
    try {
      const response = await fetchApi<PaymentGatewayConfig>('/payment-gateways/config', {
        method: 'PUT',
        body: JSON.stringify(config),
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    } catch (error) {
      console.error('Error updating payment gateway config:', error);
      throw error;
    }
  }



  /**
   * Process a payment (for POS integration)
   */
  async processPayment(paymentData: {
    saleId: string;
    paymentMethodId: string;
    amount: number;
    tenderAmount?: number;
    terminalId?: string;
    metadata?: Record<string, any>;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    message?: string;
    change?: number;
  }> {
    try {
      const response = await fetchApi<{
        success: boolean;
        transactionId?: string;
        message?: string;
        change?: number;
      }>('/payments/process', {
        method: 'POST',
        body: JSON.stringify(paymentData),
        headers: { 'Content-Type': 'application/json' }
      });
      return response;
    } catch (error) {
      console.error('Error processing payment:', error);
      throw error;
    }
  }

  /**
   * Get payment transaction details
   */
  async getTransaction(transactionId: string): Promise<any> {
    try {
      const response = await fetchApi<any>(`/payments/transactions/${transactionId}`, { method: 'GET' });
      return response;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw error;
    }
  }

  // === TERMINAL MANAGEMENT ===

  /**
   * Get all payment terminals for the current tenant
   */
  async getTerminals(): Promise<PaymentTerminal[]> {
    try {
      const response = await fetchApi<{ terminals: PaymentTerminal[] }>('/payment-terminals', { method: 'GET' });
      return response?.terminals || [];
    } catch (error) {
      console.error('Error fetching payment terminals:', error);
      throw error;
    }
  }

  /**
   * Add a new payment terminal
   */
  async addTerminal(terminalData: TerminalCreateRequest): Promise<{ success: boolean; terminalId?: string; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; terminalId?: string; message?: string }>('/payment-terminals', {
        method: 'POST',
        body: JSON.stringify(terminalData),
      });
      return response;
    } catch (error) {
      console.error('Error adding payment terminal:', error);
      throw error;
    }
  }

  /**
   * Update payment terminal configuration
   */
  async updateTerminal(terminalId: string, updateData: Partial<TerminalCreateRequest>): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string }>(`/payment-terminals/${terminalId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      return response;
    } catch (error) {
      console.error('Error updating payment terminal:', error);
      throw error;
    }
  }

  /**
   * Delete payment terminal
   */
  async deleteTerminal(terminalId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string }>(`/payment-terminals/${terminalId}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error('Error deleting payment terminal:', error);
      throw error;
    }
  }

  /**
   * Test terminal connection
   */
  async testTerminal(terminalId: string): Promise<{ success: boolean; message?: string; provider?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string; provider?: string }>(`/payment-terminals/${terminalId}/test`, {
        method: 'POST',
      });
      return response;
    } catch (error) {
      console.error('Error testing payment terminal:', error);
      throw error;
    }
  }

  /**
   * Process payment through terminal
   */
  async processTerminalPayment(terminalId: string, paymentData: TerminalPaymentRequest): Promise<{ success: boolean; transactionId?: string; providerTransactionId?: string; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; transactionId?: string; providerTransactionId?: string; message?: string }>(`/payment-terminals/${terminalId}/charge`, {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
      return response;
    } catch (error) {
      console.error('Error processing terminal payment:', error);
      throw error;
    }
  }

  // === GATEWAY MANAGEMENT ===

  /**
   * Get all payment gateways for the current tenant
   */
  async getGateways(): Promise<PaymentGateway[]> {
    try {
      const response = await fetchApi<{ gateways: PaymentGateway[] }>('/payment-gateways', { method: 'GET' });
      return response?.gateways || [];
    } catch (error) {
      console.error('Error fetching payment gateways:', error);
      throw error;
    }
  }

  /**
   * Configure a new payment gateway
   */
  async addGateway(gatewayData: GatewayCreateRequest): Promise<{ success: boolean; gatewayId?: string; webhookEndpoint?: string; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; gatewayId?: string; webhookEndpoint?: string; message?: string }>('/payment-gateways', {
        method: 'POST',
        body: JSON.stringify(gatewayData),
      });
      return response;
    } catch (error) {
      console.error('Error configuring payment gateway:', error);
      throw error;
    }
  }

  /**
   * Update payment gateway configuration
   */
  async updateGateway(gatewayId: string, updateData: Partial<GatewayCreateRequest>): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string }>(`/payment-gateways/${gatewayId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });
      return response;
    } catch (error) {
      console.error('Error updating payment gateway:', error);
      throw error;
    }
  }

  /**
   * Delete payment gateway
   */
  async deleteGateway(gatewayId: string): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string }>(`/payment-gateways/${gatewayId}`, {
        method: 'DELETE',
      });
      return response;
    } catch (error) {
      console.error('Error deleting payment gateway:', error);
      throw error;
    }
  }

  /**
   * Test gateway connection
   */
  async testGatewayConnection(gatewayId: string): Promise<{ success: boolean; message?: string; provider?: string; mode?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; message?: string; provider?: string; mode?: string }>(`/payment-gateways/${gatewayId}/test`, {
        method: 'POST',
      });
      return response;
    } catch (error) {
      console.error('Error testing payment gateway:', error);
      throw error;
    }
  }

  /**
   * Create payment intent for online payment
   */
  async createPaymentIntent(gatewayId: string, paymentData: PaymentIntentRequest): Promise<{ success: boolean; transactionId?: string; paymentIntentId?: string; clientSecret?: string; message?: string }> {
    try {
      const response = await fetchApi<{ success: boolean; transactionId?: string; paymentIntentId?: string; clientSecret?: string; message?: string }>(`/payment-gateways/${gatewayId}/create-intent`, {
        method: 'POST',
        body: JSON.stringify(paymentData),
      });
      return response;
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw error;
    }
  }

  /**
   * Get terminal transaction history
   */
  async getTerminalTransactions(params?: { limit?: number; offset?: number; status?: string; terminalId?: string }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.terminalId) queryParams.append('terminalId', params.terminalId);
      
      const response = await fetchApi<{ transactions: any[] }>(`/payment-terminals/transactions?${queryParams}`, { method: 'GET' });
      return response?.transactions || [];
    } catch (error) {
      console.error('Error fetching terminal transactions:', error);
      throw error;
    }
  }

  /**
   * Get gateway transaction history
   */
  async getGatewayTransactions(params?: { limit?: number; offset?: number; status?: string; gatewayId?: string }): Promise<any[]> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.offset) queryParams.append('offset', params.offset.toString());
      if (params?.status) queryParams.append('status', params.status);
      if (params?.gatewayId) queryParams.append('gatewayId', params.gatewayId);
      
      const response = await fetchApi<{ transactions: any[] }>(`/payment-gateways/transactions?${queryParams}`, { method: 'GET' });
      return response?.transactions || [];
    } catch (error) {
      console.error('Error fetching gateway transactions:', error);
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
export default paymentService;
