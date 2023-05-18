import { Tool } from "./base.js";
import { renderTemplate } from "../prompts/template.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

const zapierNLABaseDescription: string =
  "A wrapper around Zapier NLA actions. " +
  "The input to this tool is a natural language instruction, " +
  'for example "get the latest email from my bank" or ' +
  '"send a slack message to the #general channel". ' +
  "Each tool will have params associated with it that are specified as a list. You MUST take into account the params when creating the instruction. " +
  "For example, if the params are ['Message_Text', 'Channel'], your instruction should be something like 'send a slack message to the #general channel with the text hello world'. " +
  "Another example: if the params are ['Calendar', 'Search_Term'], your instruction should be something like 'find the meeting in my personal calendar at 3pm'. " +
  "Do not make up params, they will be explicitly specified in the tool description. " +
  "If you do not have enough information to fill in the params, just say 'not enough information provided in the instruction, missing <param>'. " +
  "If you get a none or null response, STOP EXECUTION, do not try to another tool! " +
  "This tool specifically used for: {zapier_description}, " +
  "and has params: {params}";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ZapierValues = Record<string, any>;

export interface ZapiterNLAWrapperParams extends AsyncCallerParams {
  apiKey?: string;
}

export class ZapierNLAWrapper {
  zapierNlaApiKey: string;

  zapierNlaApiBase = "https://nla.zapier.com/api/v1/";

  caller: AsyncCaller;

  constructor(params?: string | ZapiterNLAWrapperParams) {
    const zapierNlaApiKey =
      typeof params === "string" ? params : params?.apiKey;
    const apiKey =
      zapierNlaApiKey ??
      (typeof process !== "undefined"
        ? // eslint-disable-next-line no-process-env
          process.env?.ZAPIER_NLA_API_KEY
        : undefined);
    if (!apiKey) {
      throw new Error("ZAPIER_NLA_API_KEY not set");
    }
    this.zapierNlaApiKey = apiKey;
    this.caller = new AsyncCaller(
      typeof params === "string" ? {} : params ?? {}
    );
  }

  protected _getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": this.zapierNlaApiKey,
    };
  }

  protected async _getActionRequest(
    actionId: string,
    instructions: string,
    params?: ZapierValues
  ): Promise<ZapierValues> {
    const data = params ?? {};
    data.instructions = instructions;
    const headers = this._getHeaders();

    // add api key to params
    const resp = await this.caller.call(
      fetch,
      `${this.zapierNlaApiBase}exposed/${actionId}/execute/`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      }
    );

    if (!resp.ok) {
      throw new Error(
        `Failed to execute action ${actionId} with instructions ${instructions}`
      );
    }

    const jsonResp = await resp.json();

    if (jsonResp.status === "error") {
      throw new Error(`Error from Zapier: ${jsonResp.error}`);
    }

    return jsonResp;
  }

  /**
   * Executes an action that is identified by action_id, must be exposed
   * (enabled) by the current user (associated with the set api_key). Change
   * your exposed actions here: https://nla.zapier.com/demo/start/
   * @param actionId
   * @param instructions
   * @param params
   */
  async runAction(
    actionId: string,
    instructions: string,
    params?: ZapierValues
  ): Promise<ZapierValues> {
    const resp = await this._getActionRequest(actionId, instructions, params);
    return resp.status === "error" ? resp.error : resp.result;
  }

  /**
   * Same as run, but instead of actually executing the action, will
   * instead return a preview of params that have been guessed by the AI in
   * case you need to explicitly review before executing.
   * @param actionId
   * @param instructions
   * @param params
   */
  async previewAction(
    actionId: string,
    instructions: string,
    params?: ZapierValues
  ): Promise<ZapierValues> {
    const data = params ?? {};
    data.preview_only = true;
    const resp = await this._getActionRequest(actionId, instructions, data);
    return resp.input_params;
  }

  /**
   * Returns a list of all exposed (enabled) actions associated with
   * current user (associated with the set api_key). Change your exposed
   * actions here: https://nla.zapier.com/demo/start/
   */
  async listActions(): Promise<ZapierValues[]> {
    const headers = this._getHeaders();
    const resp = await this.caller.call(
      fetch,
      `${this.zapierNlaApiBase}exposed/`,
      {
        method: "GET",
        headers,
      }
    );
    if (!resp.ok) {
      throw new Error("Failed to list actions");
    }
    return (await resp.json()).results;
  }

  /**
   * Same as run, but returns a stringified version of the result.
   * @param actionId
   * @param instructions
   * @param params
   */
  async runAsString(
    actionId: string,
    instructions: string,
    params?: ZapierValues
  ): Promise<string> {
    const result = await this.runAction(actionId, instructions, params);
    return JSON.stringify(result);
  }

  /**
   * Same as preview, but returns a stringified version of the result.
   * @param actionId
   * @param instructions
   * @param params
   */
  async previewAsString(
    actionId: string,
    instructions: string,
    params?: ZapierValues
  ): Promise<string> {
    const result = await this.previewAction(actionId, instructions, params);
    return JSON.stringify(result);
  }

  /**
   * Same as list, but returns a stringified version of the result.
   */
  async listActionsAsString(): Promise<string> {
    const result = await this.listActions();
    return JSON.stringify(result);
  }
}

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
    paramsSchema: ZapierValues,
    params?: ZapierValues
  ) {
    super();
    this.apiWrapper = apiWrapper;
    this.actionId = actionId;
    this.params = params;
    this.name = zapierDescription;
    const paramsSchemaWithoutInstructions = { ...paramsSchema };
    delete paramsSchemaWithoutInstructions.instructions;
    const paramsSchemaKeysString = JSON.stringify(
      Object.keys(paramsSchemaWithoutInstructions)
    );
    this.description = renderTemplate(zapierNLABaseDescription, "f-string", {
      zapier_description: zapierDescription,
      params: paramsSchemaKeysString,
    });
  }

  /** @ignore */
  async _call(arg: string): Promise<string> {
    return this.apiWrapper.runAsString(this.actionId, arg, this.params);
  }
}
