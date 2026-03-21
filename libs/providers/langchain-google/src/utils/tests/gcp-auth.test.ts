import { afterEach, describe, expect, it, vi } from "vitest";

describe("gcp-auth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

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
});
