import { describe, expect, it, vi } from "vitest";

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

describe("gcp-auth", () => {
  it("does not import jose eagerly when loading the auth helpers", async () => {
    vi.resetModules();
    vi.doMock("jose", () => {
      throw new Error("jose should not load during module import");
    });

    const { normalizeGCPCredentials } = await import("../gcp-auth.js");

    expect(
      normalizeGCPCredentials(
        '{"type":"service_account","project_id":"p","private_key_id":"k","private_key":"pem","client_id":"c","client_email":"a@b.c","auth_uri":"https://auth","token_uri":"https://token","auth_provider_x509_cert_url":"https://cert","client_x509_cert_url":"https://client-cert"}'
      )
    ).toMatchObject({
      project_id: "p",
      private_key_id: "k",
    });
  });

  it("loads jose lazily when a signing helper is called", async () => {
    vi.resetModules();
    const importPKCS8 = vi.fn().mockResolvedValue("imported-key");

    vi.doMock("jose", () => ({
      importPKCS8,
      SignJWT: class {},
      decodeJwt: vi.fn(),
    }));

    const { getGCPPrivateKey } = await import("../gcp-auth.js");

    const result = await getGCPPrivateKey({
      type: "service_account",
      project_id: "p",
      private_key_id: "k",
      private_key: "pem",
      client_id: "c",
      client_email: "a@b.c",
      auth_uri: "https://auth",
      token_uri: "https://token",
      auth_provider_x509_cert_url: "https://cert",
      client_x509_cert_url: "https://client-cert",
    });

    expect(result).toBe("imported-key");
    expect(importPKCS8).toHaveBeenCalledWith("pem", "RS256");
  });

  it("puts the requested scopes on the assertion", async () => {
    vi.resetModules();
    const payloads: Record<string, unknown>[] = [];

    vi.doMock("jose", () => ({
      importPKCS8: vi.fn().mockResolvedValue("imported-key"),
      decodeJwt: vi.fn(),
      SignJWT: class {
        constructor(payload: Record<string, unknown>) {
          payloads.push(payload);
        }

        setIssuer() {
          return this;
        }

        setAudience() {
          return this;
        }

        setSubject() {
          return this;
        }

        setProtectedHeader() {
          return this;
        }

        setIssuedAt() {
          return this;
        }

        setExpirationTime() {
          return this;
        }

        async sign() {
          return "signed-jwt";
        }
      },
    }));

    const { getGCPCustomToken } = await import("../gcp-auth.js");

    await getGCPCustomToken(credentials, [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/generative-language",
    ]);

    // Google requires `scope` on the claim set for a jwt-bearer access token
    // request; without it the exchange fails with an opaque scope error.
    expect(payloads).toEqual([
      {
        scope:
          "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/generative-language",
      },
    ]);
  });

  it("does not reuse a cached token across different scopes", async () => {
    vi.resetModules();
    vi.doMock("jose", () => ({
      importPKCS8: vi.fn().mockResolvedValue("imported-key"),
      decodeJwt: vi.fn(),
      SignJWT: class {
        setIssuer() {
          return this;
        }

        setAudience() {
          return this;
        }

        setSubject() {
          return this;
        }

        setProtectedHeader() {
          return this;
        }

        setIssuedAt() {
          return this;
        }

        setExpirationTime() {
          return this;
        }

        async sign() {
          return "signed-jwt";
        }
      },
    }));

    let issued = 0;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        issued += 1;
        return new Response(
          JSON.stringify({
            access_token: `token-${issued}`,
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

    try {
      const { getGCPCredentialsAccessToken } = await import("../gcp-auth.js");

      const first = await getGCPCredentialsAccessToken(credentials, [
        "https://www.googleapis.com/auth/cloud-platform",
      ]);
      const second = await getGCPCredentialsAccessToken(credentials, [
        "https://www.googleapis.com/auth/generative-language",
      ]);

      // The scopes are baked into the token that comes back, so the second
      // caller must not be served the first caller's token.
      expect(first).toBe("token-1");
      expect(second).toBe("token-2");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
