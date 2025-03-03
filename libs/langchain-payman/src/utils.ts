import { Paymanai } from "paymanai";

/**
 * Get the Payman client from environment variables or throw error if not found.
 */
export function getEnvironmentPayman(): Paymanai {
  const apiSecret = process.env.PAYMAN_API_SECRET;
  const environment = process.env.PAYMAN_ENVIRONMENT;

  if (!apiSecret) {
    throw new Error(
      "PAYMAN_API_SECRET not found in environment variables."
    );
  }

  return new Paymanai({
    xPaymanAPISecret: apiSecret,
    environment: environment
  });
} 