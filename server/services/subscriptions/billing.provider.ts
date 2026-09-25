import type { PlanId } from "@/lib/config/plans";
import { AppError } from "@/server/lib/errors";

/**
 * Billing provider abstraction (Razorpay-ready). The mock provider activates plans
 * immediately so the product can be exercised end-to-end without payments.
 */
export type CheckoutResult = { type: "activated"; periodEnd: Date } | { type: "redirect"; url: string };

export interface BillingProvider {
  readonly name: "mock" | "razorpay";
  startCheckout(input: { tenantId: string; plan: PlanId; email: string }): Promise<CheckoutResult>;
  cancel(input: { tenantId: string; providerSubscriptionId?: string }): Promise<void>;
}

export class MockBillingProvider implements BillingProvider {
  readonly name = "mock" as const;

  async startCheckout(): Promise<CheckoutResult> {
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    return { type: "activated", periodEnd };
  }

  async cancel() {}
}

export class RazorpayBillingProvider implements BillingProvider {
  readonly name = "razorpay" as const;

  async startCheckout(): Promise<CheckoutResult> {
    // Create a Razorpay subscription for the plan and return its hosted checkout URL.
    throw new AppError("INTEGRATION", "Razorpay billing is not configured yet");
  }

  async cancel() {
    throw new AppError("INTEGRATION", "Razorpay billing is not configured yet");
  }
}

export function getBillingProvider(name: "mock" | "razorpay"): BillingProvider {
  return name === "razorpay" ? new RazorpayBillingProvider() : new MockBillingProvider();
}
