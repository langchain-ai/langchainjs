import { Tool } from "../base.js";
import { AuthFlowBase } from './authFlowBase.js';

export class OutlookBase extends Tool {
  name = "Outlook";

  description = "A tool to send or read emails or do other features from Outlook.";

  protected authFlow: AuthFlowBase;
  protected accessToken: string = "";

  constructor(authFlow: AuthFlowBase) {
    super();
    this.authFlow = authFlow;
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
