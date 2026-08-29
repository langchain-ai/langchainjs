import { z } from "zod";
import { createAgent, tool } from "langchain";

const DEFAULT_PREFLIGHT_URL = "https://x402station.io/api/v1/preflight-trial";

const HARD_BLOCK_WARNINGS = new Set([
  "dead",
  "zombie",
  "decoy_price_extreme",
  "never_paid_zombie",
  "dead_7d",
  "mostly_dead",
]);

const BLOCK_ACTIONS = new Set(["block", "deny", "reject", "do_not_pay"]);

type PreflightResponse = {
  ok?: boolean;
  warnings?: string[];
  risk_score?: number;
  recommended_action?: string;
  [key: string]: unknown;
};

function getPreflightUrl() {
  return process.env.X402STATION_PREFLIGHT_URL ?? DEFAULT_PREFLIGHT_URL;
}

async function requestPreflight(url: string): Promise<PreflightResponse> {
  const response = await fetch(getPreflightUrl(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(
      `x402station preflight returned HTTP ${response.status}: ${await response.text()}`
    );
  }

  return response.json() as Promise<PreflightResponse>;
}

function decidePaymentAction(preflight: PreflightResponse) {
  const warnings = preflight.warnings ?? [];
  const hardBlocks = warnings.filter((warning) =>
    HARD_BLOCK_WARNINGS.has(warning)
  );
  const recommendedAction = preflight.recommended_action?.toLowerCase();
  const blocked =
    preflight.ok === false ||
    hardBlocks.length > 0 ||
    (recommendedAction ? BLOCK_ACTIONS.has(recommendedAction) : false);

  return {
    blocked,
    hardBlocks,
    warnings,
    riskScore: preflight.risk_score ?? null,
    recommendedAction:
      preflight.recommended_action ?? (blocked ? "do_not_pay" : "policy_check"),
  };
}

export const preflightX402EndpointTool = tool(
  async ({ url }: { url: string }) => {
    const preflight = await requestPreflight(url);
    const decision = decidePaymentAction(preflight);

    return JSON.stringify(
      {
        url,
        ...decision,
        guidance: decision.blocked
          ? "Do not sign PAYMENT-SIGNATURE for this endpoint."
          : "No hard block was returned. Continue only if your budget and provider policy allow it.",
        preflight,
      },
      null,
      2
    );
  },
  {
    name: "preflight_x402_endpoint",
    description:
      "Check an x402 endpoint with x402station before any agent signs PAYMENT-SIGNATURE. Hard-blocks dead, zombie, decoy, never-paid, and mostly-dead endpoints; softer warnings like proxy_markup are policy inputs.",
    schema: z.object({
      url: z.string().url().describe("The x402 endpoint URL to check."),
    }),
  }
);

export const x402PaymentSystemPrompt = `Before any tool or workflow signs PAYMENT-SIGNATURE for an x402 endpoint, call preflight_x402_endpoint with the exact endpoint URL. If the tool returns blocked=true, do not pay and do not retry the same URL. Treat proxy_markup, slow, new_provider, or other non-blocking warnings as policy inputs for the user's budget and provider rules.`;

export function createX402PreflightAgent() {
  return createAgent({
    model: "openai:gpt-4o-mini",
    tools: [preflightX402EndpointTool],
    systemPrompt: x402PaymentSystemPrompt,
  });
}

export async function run() {
  const targetUrl =
    process.env.TARGET_X402_URL ?? "https://x402.quicknode.com/base-mainnet/";
  const result = await preflightX402EndpointTool.invoke({ url: targetUrl });

  console.log(result);
}
