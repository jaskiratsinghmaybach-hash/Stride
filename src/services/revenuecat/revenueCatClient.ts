/**
 * RevenueCat boundary.
 *
 * Keep subscription/entitlement logic behind this module so the rest of STRIDE
 * does not depend directly on RevenueCat implementation details.
 */

export type StrideEntitlement = "free" | "pro";

export async function initializeRevenueCat(): Promise<void> {
  // TODO: integrate RevenueCat SDK.
}

export async function getEntitlement(): Promise<StrideEntitlement> {
  // TODO: read RevenueCat customer entitlement.
  return "free";
}
