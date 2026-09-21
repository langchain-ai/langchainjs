import { afterEach, describe, expect, it, vi } from "vitest";

const credentials = {
  type: "service_account",
  project_id: "p",
  private_key_id: "k",
  private_key: "pem",
  client_id: "c",
  client_email: "a@b.c",
  auth_uri: "https://auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://cert",
  client_x509_cert_url: "https://client-cert",
} as const;

describe("NodeApiClient service account auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("sends the resolved access token rather than the pending promise", async () => {
    vi.resetModules();
    vi.stubEnv("GOOGLE_API_KEY", "");
    const getGCPCredentialsAccessToken = vi
      .fn()
      .mockResolvedValue("resolved-access-token");

    vi.doMock("../../utils/gcp-auth.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../utils/gcp-auth.js")>()),
      getGCPCredentialsAccessToken,
    }));

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const { NodeApiClient } = await import("../node.js");
    const client = new NodeApiClient({ credentials });

    await client.fetch(new Request("https://aiplatform.googleapis.com/v1/x"));

    const sent = fetchSpy.mock.calls[0][0] as Request;
    // Interpolating the un-awaited promise used to send
    // `Bearer [object Promise]`, which Google rejects as invalid credentials.
    expect(sent.headers.get("authorization")).toBe(
      "Bearer resolved-access-token"
    );
  });

  it("asks for the Vertex AI scope by default", async () => {
    vi.resetModules();
    vi.stubEnv("GOOGLE_API_KEY", "");
    const getGCPCredentialsAccessToken = vi.fn().mockResolvedValue("token");

    vi.doMock("../../utils/gcp-auth.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../utils/gcp-auth.js")>()),
      getGCPCredentialsAccessToken,
    }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 })
    );

    const { NodeApiClient } = await import("../node.js");
    const client = new NodeApiClient({ credentials });

    await client.fetch(new Request("https://aiplatform.googleapis.com/v1/x"));

    expect(getGCPCredentialsAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ client_email: "a@b.c" }),
      ["https://www.googleapis.com/auth/cloud-platform"]
    );
  });

  it("prefers the scopes configured through googleAuthOptions", async () => {
    vi.resetModules();
    vi.stubEnv("GOOGLE_API_KEY", "");
    const getGCPCredentialsAccessToken = vi.fn().mockResolvedValue("token");

    vi.doMock("../../utils/gcp-auth.js", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../utils/gcp-auth.js")>()),
      getGCPCredentialsAccessToken,
    }));

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 200 })
    );

    const { NodeApiClient } = await import("../node.js");
    const client = new NodeApiClient({
      credentials,
      googleAuthOptions: {
        scopes: ["https://www.googleapis.com/auth/generative-language"],
      },
    });

    await client.fetch(new Request("https://aiplatform.googleapis.com/v1/x"));

    expect(getGCPCredentialsAccessToken).toHaveBeenCalledWith(
      expect.anything(),
      ["https://www.googleapis.com/auth/generative-language"]
    );
  });
});
