/**
 * Stripe client for payment processing
 * Currently using mock implementation - replace with actual Stripe when ready
 */

export interface StripeClient {
  createPaymentIntent: (amount: number) => Promise<{ client_secret: string }>;
  confirmPayment: (clientSecret: string) => Promise<{ success: boolean }>;
}

// Mock Stripe client for build compatibility
export const createStripeClient = (): StripeClient => {
  return {
    createPaymentIntent: async (amount: number) => {
      // Mock payment intent creation
      return { client_secret: `pi_mock_${Date.now()}` };
    },
    confirmPayment: async (clientSecret: string) => {
      // Mock payment confirmation
      return { success: true };
    },
  };
};