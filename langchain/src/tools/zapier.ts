import { Tool } from "./base.js";
import { renderTemplate } from "../prompts/template.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";
import { getEnvironmentVariable } from "../util/env.js";
import { Serializable } from "../load/serializable.js";

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

export interface ZapierNLAWrapperParams extends AsyncCallerParams {
  /**
   * NLA API Key. Found in the NLA documentation https://nla.zapier.com/docs/authentication/#api-key
   * Can also be set via the environment variable `ZAPIER_NLA_API_KEY`
   */
  apiKey?: string;
  /**
   * NLA OAuth Access Token. Found in the NLA documentation https://nla.zapier.com/docs/authentication/#oauth-credentials
   * Can also be set via the environment variable `ZAPIER_NLA_OAUTH_ACCESS_TOKEN`
   */
  oauthAccessToken?: string;
}

/**
 * A wrapper class for Zapier's Natural Language Actions (NLA). It
 * provides an interface to interact with the 5k+ apps and 20k+ actions on
 * Zapier's platform through a natural language API interface. This
 * includes apps like Gmail, Salesforce, Trello, Slack, Asana, HubSpot,
 * Google Sheets, Microsoft Teams, and many more.
 */
export class ZapierNLAWrapper extends Serializable {
  lc_namespace = ["langchain", "tools", "zapier"];

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      apiKey: "ZAPIER_NLA_API_KEY",
    };
  }

  zapierNlaApiKey?: string;

  zapierNlaOAuthAccessToken?: string;

  zapierNlaApiBase = "https://nla.zapier.com/api/v1/";

  caller: AsyncCaller;

  constructor(params?: ZapierNLAWrapperParams) {
    super(params);

    const zapierNlaOAuthAccessToken = params?.oauthAccessToken;
    const zapierNlaApiKey = params?.apiKey;

    const oauthAccessToken =
      zapierNlaOAuthAccessToken ??
      getEnvironmentVariable("ZAPIER_NLA_OAUTH_ACCESS_TOKEN");
    const apiKey =
      zapierNlaApiKey ?? getEnvironmentVariable("ZAPIER_NLA_API_KEY");
    if (!apiKey && !oauthAccessToken) {
      throw new Error(
        "Neither ZAPIER_NLA_OAUTH_ACCESS_TOKEN or ZAPIER_NLA_API_KEY are set"
      );
    }

    if (oauthAccessToken) {
      this.zapierNlaOAuthAccessToken = oauthAccessToken;
    } else {
      this.zapierNlaApiKey = apiKey;
    }

    this.caller = new AsyncCaller(
      typeof params === "string" ? {} : params ?? {}
    );
  }

  protected _getHeaders(): Record<string, string> {
    const headers: {
      "Content-Type": string;
      Accept: string;
      Authorization?: string;
      "x-api-key"?: string;
    } = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (this.zapierNlaOAuthAccessToken) {
      headers.Authorization = `Bearer ${this.zapierNlaOAuthAccessToken}`;
    } else {
      headers["x-api-key"] = this.zapierNlaApiKey;
    }

    return headers;
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
   * (enabled) by the current user (associated with the set api_key or access token).
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
   * current user (associated with the set api_key or access token).
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
      if (resp.status === 401) {
        if (this.zapierNlaOAuthAccessToken) {
          throw new Error(
            "A 401 Unauthorized error was returned. Check that your access token is correct and doesn't need to be refreshed."
          );
        }
        throw new Error(
          "A 401 Unauthorized error was returned. Check that your API Key is correct."
        );
      }
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

/**
 * A tool that uses the `ZapierNLAWrapper` to run a specific action. It
 * takes in the `ZapierNLAWrapper` instance, an action ID, a description,
 * a schema for the parameters, and optionally the parameters themselves.
 */
export class ZapierNLARunAction extends Tool {
  static lc_name() {
    return "ZapierNLARunAction";
  }

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
