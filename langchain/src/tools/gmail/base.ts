import { gmail_v1, google } from "googleapis";
import { Tool } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends Tool {
  name = "Gmail";

  description = "A tool to send and view emails through Gmail";

  protected gmail: gmail_v1.Gmail;

  constructor(fields?: Partial<GmailBaseToolParams>) {
    super(...arguments);

    const defaultCredentials = {
      clientEmail: getEnvironmentVariable("GMAIL_CLIENT_EMAIL"),
      privateKey: getEnvironmentVariable("GMAIL_PRIVATE_KEY"),
      keyfile: getEnvironmentVariable("GMAIL_KEYFILE"),
    };

    const credentials = {
      ...defaultCredentials,
      ...(fields?.credentials ?? {}),
    };

    const scopes = fields?.scopes || ["https://mail.google.com/"];

    if (!credentials) {
      throw new Error("Missing credentials to authenticate to Gmail");
    }

    if (!credentials.clientEmail) {
      throw new Error("Missing GMAIL_CLIENT_EMAIL to interact with Gmail");
    }

    if (!credentials.privateKey && !credentials.keyfile) {
      throw new Error(
        "Missing GMAIL_PRIVATE_KEY or GMAIL_KEYFILE to interact with Gmail"
      );
    }

    this.gmail = this.getGmail(
      credentials.clientEmail,
      credentials.privateKey,
      credentials.keyfile,
      scopes
    );
  }

  private getGmail(
    email: string,
    key?: string,
    keyfile?: string,
    scopes: string[] = []
  ) {
    const auth = new google.auth.JWT(email, keyfile, key, scopes);

    return google.gmail({ version: "v1", auth });
  }
}
