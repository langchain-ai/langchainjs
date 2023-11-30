import { gmail_v1, google } from "googleapis";
import { StructuredTool } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";

export interface GmailBaseToolParams {
  credentials?: {
    clientEmail?: string;
    privateKey?: string;
    keyfile?: string;
  };
  scopes?: string[];
}

export abstract class GmailBaseTool extends StructuredTool {
  name = "Gmail";

  description = "A tool to send and view emails through Gmail";

  protected gmail: gmail_v1.Gmail;

  constructor(fields?: Partial<GmailBaseToolParams>) {
    super(...arguments);

    const credentials = fields?.credentials || {};
    credentials.clientEmail =
      credentials.clientEmail ||
      getEnvironmentVariable("GMAIL_CLIENT_EMAIL") ||
      "";
    credentials.privateKey =
      credentials.privateKey ||
      getEnvironmentVariable("GMAIL_PRIVATE_KEY") ||
      "";
    credentials.keyfile =
      credentials.keyfile || getEnvironmentVariable("GMAIL_KEYFILE") || "";

    if (credentials.clientEmail === "") {
      throw new Error("Missing GMAIL_CLIENT_EMAIL to interact with Gmail");
    }
    if (credentials.privateKey === "" && credentials.keyfile === "") {
      throw new Error(
        "Missing GMAIL_PRIVATE_KEY or GMAIL_KEYFILE to interact with Gmail"
      );
    }

    const scopes = fields?.scopes || ["https://mail.google.com/"];

    this.gmail = this.getGmail(
      scopes,
      credentials.clientEmail,
      credentials.privateKey,
      credentials.keyfile
    );
  }

  private getGmail(
    scopes: string[],
    email: string,
    key?: string,
    keyfile?: string
  ) {
    const auth = new google.auth.JWT(email, keyfile, key, scopes);
    return google.gmail({ version: "v1", auth });
  }
}
