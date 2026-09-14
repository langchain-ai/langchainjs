import {
  MCPAdapter,
  type AuthProvider,
  type OAuthClientProvider,
} from "../src/index.js";

/**
 * Call from the application's OAuth redirect handler. Reconstruct the provider
 * from the initiating user's saved discovery, PKCE and issuer-bound credentials.
 * callbackParams is the full redirect query, including iss. expectedState comes
 * from the application's one-time authorization attempt, not the redirect query.
 */
export async function completeOAuth(
  serverUrl: string,
  provider: OAuthClientProvider,
  callbackParams: URLSearchParams,
  expectedState: string
) {
  const adapter = new MCPAdapter({
    servers: {
      secure: { url: serverUrl, authProvider: provider },
    },
  });
  try {
    await adapter.finishAuth("secure", callbackParams, expectedState);
    const tools = await adapter.listTools();
    console.log(
      "Authorized tools:",
      tools.map((tool) => tool.name)
    );
    // Invoke tools or run the agent here while the adapter is open.
  } finally {
    await adapter.close();
  }
}

/** Use when an application broker already owns token acquisition and renewal. */
export async function useTokenBroker(
  serverUrl: string,
  provider: AuthProvider
) {
  const adapter = new MCPAdapter({
    servers: {
      secure: { url: serverUrl, authProvider: provider },
    },
  });
  try {
    const tools = await adapter.listTools();
    console.log(
      "Authorized tools:",
      tools.map((tool) => tool.name)
    );
  } finally {
    await adapter.close();
  }
}
