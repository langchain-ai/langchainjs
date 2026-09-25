import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from "@modelcontextprotocol/client";

type StoredTokens = Awaited<ReturnType<OAuthClientProvider["tokens"]>>;
type StoredClient = Awaited<
  ReturnType<OAuthClientProvider["clientInformation"]>
>;

export interface TestOAuthProvider extends OAuthClientProvider {
  /** Every authorization URL the SDK handed to the application. */
  readonly redirects: URL[];
  readonly stored: { tokens?: StoredTokens; client?: StoredClient };
}

const redirectUrl = "http://127.0.0.1:9/callback";

/**
 * An application-owned OAuth provider kept in memory. `state` opts into the
 * SDK sending a `state` parameter; `persistDiscovery` opts into discovery
 * state, the only way a fresh transport learns a 401's metadata URL.
 */
export function createTestOAuthProvider(
  options: { state?: string; persistDiscovery?: boolean } = {}
): TestOAuthProvider {
  const redirects: URL[] = [];
  const stored: TestOAuthProvider["stored"] = {};
  let verifier: string | undefined;
  let discovery: OAuthDiscoveryState | undefined;
  const { state } = options;

  return {
    redirects,
    stored,
    get redirectUrl() {
      return redirectUrl;
    },
    get clientMetadata() {
      return {
        client_name: "oauth-test",
        redirect_uris: [redirectUrl],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      };
    },
    ...(state === undefined ? {} : { state: () => state }),
    clientInformation: () => stored.client,
    saveClientInformation: (info) => {
      stored.client = info;
    },
    tokens: () => stored.tokens,
    saveTokens: (tokens) => {
      stored.tokens = tokens;
    },
    redirectToAuthorization: (url) => {
      redirects.push(url);
    },
    saveCodeVerifier: (value) => {
      verifier = value;
    },
    codeVerifier: () => {
      if (verifier === undefined) throw new Error("no code verifier saved");
      return verifier;
    },
    ...(options.persistDiscovery
      ? {
          saveDiscoveryState: (value: OAuthDiscoveryState) => {
            discovery = value;
          },
          discoveryState: () => discovery,
        }
      : {}),
  };
}

/** Play the user agent: follow the authorization URL to its callback query. */
export async function authorizeInBrowser(url: URL): Promise<URLSearchParams> {
  const response = await fetch(url, { redirect: "manual" });
  const location = response.headers.get("location");
  if (response.status !== 302 || !location)
    throw new Error(`authorization did not redirect (HTTP ${response.status})`);
  return new URL(location).searchParams;
}
