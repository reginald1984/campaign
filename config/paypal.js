const fetch = require('node-fetch');

class PayPalClient {
  constructor() {
    this.baseURL = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Get OAuth 2.0 access token
  async getAccessToken() {
    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 5 * 60 * 1000) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await fetch(`${this.baseURL}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal auth failed: ${data.error_description}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    
    return this.accessToken;
  }

  // Create PayPal order
  async createOrder(amount, currency = 'USD', returnUrl, cancelUrl) {
    const accessToken = await this.getAccessToken();
    
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString(),
          breakdown: {
            item_total: {
              currency_code: currency,
              value: amount.toString()
            }
          }
        },
        description: 'Campaign Donation',
        custom_id: `donation_${Date.now()}`
      }],
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'Presidential Campaign',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW'
      }
    };

    const response = await fetch(`${this.baseURL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal order creation failed: ${data.message}`);
    }

    return data;
  }

  // Capture PayPal order
  async captureOrder(orderId) {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseURL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal capture failed: ${data.message}`);
    }

    return data;
  }

  // Get order details
  async getOrder(orderId) {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseURL}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal get order failed: ${data.message}`);
    }

    return data;
  }

  // Refund payment
  async refundPayment(captureId, amount, currency = 'USD') {
    const accessToken = await this.getAccessToken();
    
    const refundData = {
      amount: {
        currency_code: currency,
        value: amount.toString()
      }
    };

    const response = await fetch(`${this.baseURL}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(refundData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal refund failed: ${data.message}`);
    }

    return data;
  }

  // Create subscription plan for recurring donations
  async createSubscriptionPlan(name, amount, currency, interval, totalCycles = 0) {
    const accessToken = await this.getAccessToken();
    
    const planData = {
      product_id: 'CAMPAIGN_DONATION_PRODUCT',
      name: name,
      description: `Monthly donation of $${amount} to campaign`,
      status: 'ACTIVE',
      billing_cycles: [{
        frequency: {
          interval_unit: interval.toUpperCase(),
          interval_count: 1
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: totalCycles,
        pricing_scheme: {
          fixed_price: {
            value: amount.toString(),
            currency_code: currency
          }
        }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          value: '0',
          currency_code: currency
        },
        setup_fee_failure_action: 'CONTINUE',
        payment_failure_threshold: 3
      }
    };

    const response = await fetch(`${this.baseURL}/v1/billing/plans`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(planData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal plan creation failed: ${data.message}`);
    }

    return data;
  }

  // Create subscription
  async createSubscription(planId, returnUrl, cancelUrl) {
    const accessToken = await this.getAccessToken();
    
    const subscriptionData = {
      plan_id: planId,
      start_time: new Date().toISOString(),
      subscriber: {
        name: {
          given_name: 'Donor',
          surname: 'Campaign'
        }
      },
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        brand_name: 'Presidential Campaign',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW'
      }
    };

    const response = await fetch(`${this.baseURL}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriptionData)
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal subscription creation failed: ${data.message}`);
    }

    return data;
  }

  // Get subscription details
  async getSubscription(subscriptionId) {
    const accessToken = await this.getAccessToken();
    
    const response = await fetch(`${this.baseURL}/v1/billing/subscriptions/${subscriptionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayPal get subscription failed: ${data.message}`);
    }

    return data;
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId, reason) {
    const accessToken = await this.getAccessToken();
    
    const cancelData = {
      reason: reason
    };

    const response = await fetch(`${this.baseURL}/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cancelData)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(`PayPal subscription cancellation failed: ${data.message}`);
    }

    return true;
  }
}

module.exports = new PayPalClient();