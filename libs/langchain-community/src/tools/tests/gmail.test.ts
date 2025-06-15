import { jest, expect, describe } from "@jest/globals";
import { GmailGetMessage } from "../gmail/index.js";

jest.mock("googleapis", () => ({
  google: {
    auth: {
      JWT: jest.fn().mockImplementation(() => ({})),
    },
  },
}));

describe("GmailBaseTool using GmailGetMessage", () => {
  it("should be setup with correct parameters", async () => {
    const params = {
      credentials: {
        clientEmail: "test@email.com",
        privateKey: "privateKey",
      },
      scopes: ["gmail_scope1"],
    };
    const instance = new GmailGetMessage(params);
    expect(instance.name).toBe("gmail_get_message");
  });

  it("should throw an error if both privateKey and keyfile are missing", async () => {
    const params = {
      credentials: {},
      scopes: ["gmail_scope1"],
    };

    expect(() => new GmailGetMessage(params)).toThrow();
  });

  it("should throw error with only client_email", async () => {
    const params = {
      credentials: {
        clientEmail: "client_email",
      },
    };

    expect(() => new GmailGetMessage(params)).toThrow();
  });

  it("should throw error with only private_key", async () => {
    const params = {
      credentials: {
        privateKey: "privateKey",
      },
    };

    expect(() => new GmailGetMessage(params)).toThrow();
  });

  it("should throw error with only keyfile", async () => {
    const params = {
      credentials: {
        keyfile: "keyfile",
      },
    };

    expect(() => new GmailGetMessage(params)).toThrow();
  });
});
