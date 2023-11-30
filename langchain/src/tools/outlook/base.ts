import { Tool } from "../base.js";
import { AuthFlowBase } from "./authFlowBase.js";
import { AuthFlowToken, AuthFlowRefresh } from "./authFlowToken.js";
import { AuthFlowREST } from "./authFlowREST.js";

export class OutlookBase extends Tool {
  name = "Outlook";

  description =
    "A tool to send or read emails or do other features from Outlook.";

  protected authFlow: AuthFlowBase;

  protected accessToken = "";

  constructor(authFlow?: AuthFlowBase, choice?: string) {
    super();
    if (authFlow) {
      this.authFlow = authFlow;
    } else {
      if (choice === "token") {
        this.authFlow = new AuthFlowToken();
      } else if (choice === "refresh") {
        this.authFlow = new AuthFlowRefresh();
      } else if (choice === "rest") {
        this.authFlow = new AuthFlowREST();
      } else {
        throw new Error("Incorrect choice of built-in authFlow.");
      }
    }
  }

  async getAuth() {
    if (!this.accessToken) {
      this.accessToken = await this.authFlow.getAccessToken();
    } else {
      try {
        this.accessToken = await this.authFlow.refreshAccessToken();
      } catch (error) {
        this.accessToken = await this.authFlow.getAccessToken();
      }
    }
    return this.accessToken;
  }

  async _call(input: string) {
    return input;
  }
}
