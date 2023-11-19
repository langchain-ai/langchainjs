import { gmail_v1, google } from "googleapis";
import { Tool } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends Tool {
  name = "Gmail";

  description = "A tool to send and view emails through Gmail";

  protected gmail: gmail_v1.Gmail;

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

    this.gmail = this.getGmail(fields.credentials.clientEmail, fields.credentials.privateKey, fields.scopes || []);
  }

  private getGmail(email: string, key: string, scopes: string[] = []) {
    const auth = new google.auth.JWT(
      email,
      undefined,
      key,
      scopes,
    );

    return google.gmail({ version: "v1", auth });
  }
}
