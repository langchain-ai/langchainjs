import { ZapierNLAWrapper, ZapierValues } from "../../zapier.js";
import { Tool } from "./base.js";

const zapierNLABaseDescription = `
A wrapper around Zapier NLA actions. The input to this tool is a natural language instruction, 
for example "get the latest email from my bank" or "send a slack message to the #general channel".
This tool specifically used for: `;

export class ZapierNLARunAction extends Tool {
  apiWrapper: ZapierNLAWrapper;

  actionId: string;

  params?: ZapierValues;

  name: string;

  description: string;

  constructor(
    apiWrapper: ZapierNLAWrapper,
    actionId: string,
    zapierDescription: string,
    params?: ZapierValues
  ) {
    super();
    this.apiWrapper = apiWrapper;
    this.actionId = actionId;
    this.params = params;
    this.name = zapierDescription;
    this.description = zapierNLABaseDescription + zapierDescription;
  }

  async _call(arg: string): Promise<string> {
    return this.apiWrapper.runAsString(this.actionId, arg, this.params);
  }
}
