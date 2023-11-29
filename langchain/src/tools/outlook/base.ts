import { Tool } from "../base.js";
import { getEnvironmentVariable } from "../../util/env.js";
import { AuthFlowREST } from "./authFlowREST.js";

export interface OutlookCredentials {
  credentials?: {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
}

export class OutlookBase extends Tool {
  name = "Outlook";

  description =
    "A tool to send or read emails or do other features from Outlook.";

  protected clientId: string;
  protected clientSecret: string;
  protected redirectUri: string;

  constructor(
    fields: OutlookCredentials = {
      credentials: {
        clientId: getEnvironmentVariable("OUTLOOK_CLIENT_ID"),
        clientSecret: getEnvironmentVariable("OUTLOOK_CLIENT_SECRET"),
        redirectUri: getEnvironmentVariable("OUTLOOK_REDIRECT_URI"),
      }
    }
  ) {
    super(...arguments);

    if (!fields.credentials) {
      throw new Error("Missing credentials to authenticate to Outlook");
    }

    if (!fields.credentials.clientId) {
      throw new Error(
        "Missing OUTLOOK_CLIENT_ID to interact with Outlook"
      );
    }

    if (!fields.credentials.clientSecret) {
      throw new Error(
        "Missing OUTLOOK_CLIENT_SECRET to interact with Outlook"
      );
    }

    if (!fields.credentials.redirectUri) {
      throw new Error(
        "Missing OUTLOOK_REDIRECT_URI to interact with Outlook"
      );
    }

    this.clientId = fields.credentials.clientId;
    this.clientSecret = fields.credentials.clientSecret;
    this.redirectUri = fields.credentials.redirectUri;
  }

  async getAuth() {
    const authflow = new AuthFlowREST(this.clientId, this.clientSecret, this.redirectUri);
    const accessToken = await authflow.getAccessToken();
    return accessToken;
  }

  async _call(input: string) {
    return input;
  }
}
