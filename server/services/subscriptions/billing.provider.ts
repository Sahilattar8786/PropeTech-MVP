import type { PlanId } from "@/lib/config/plans";
import { env } from "@/server/lib/env";
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

/**
 * Test-mode billing activates paid plans without payment, so it's refused in production
 * unless ALLOW_TEST_BILLING=true (e.g. a staging deployment).
 */
export function testBillingAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || env().ALLOW_TEST_BILLING === "true";
}

export class MockBillingProvider implements BillingProvider {
  readonly name = "mock" as const;

  async startCheckout(): Promise<CheckoutResult> {
    if (!testBillingAllowed()) {
      throw new AppError("INTEGRATION", "Online payments aren't enabled yet. Contact us to upgrade your plan.");
    }
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
