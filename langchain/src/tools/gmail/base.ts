import { getEnvironmentVariable } from "../../util/env.js";
import { Tool } from "../base.js";
import { google } from "googleapis";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends Tool {
  name: string = "Gmail";
  description: string = "A tool to send and view emails through Gmail";
  protected clientEmail: string;
  protected privateKey: string;
  protected scopes: string[];

  constructor(
    fields: GmailBaseToolParams = {
      credentials: {
        clientEmail: getEnvironmentVariable("GMAIL_CLIENT_EMAIL"),
        privateKey: getEnvironmentVariable("GMAIL_PRIVATE_KEY"),
      },
      scopes: ["https://mail.google.com/"],
    }
  ) {
    super(...arguments);

    if (!fields.credentials) {
      throw new Error("Missing credentials to authenticate to Gmail");
    }

    if (!fields.credentials.clientEmail) {
      throw new Error("Missing GMAIL_CLIENT_EMAIL to interact with Gmail");
    }

    if (!fields.credentials.privateKey) {
      throw new Error("Missing GMAIL_PRIVATE_KEY to interact with Gmail");
    }

    this.clientEmail = fields.credentials.clientEmail;
    this.privateKey = fields.credentials.privateKey;
    this.scopes = fields.scopes || [];
  }

  async getAuth() {
    const auth = new google.auth.JWT(
      this.clientEmail,
      undefined,
      this.privateKey,
      this.scopes
    );

    return auth;
  }
}
