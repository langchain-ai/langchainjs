import { Tool, ToolParams } from "./base.js";

export interface AIPluginToolParams extends ToolParams {
  name: string;
  description: string;
  apiSpec: string;
}

export class AIPluginTool extends Tool implements AIPluginToolParams {
  private _name: string;

  private _description: string;

  apiSpec: string;

  get name() {
    return this._name;
  }

  get description() {
    return this._description;
  }

  constructor(params: AIPluginToolParams) {
    super(params);
    this._name = params.name;
    this._description = params.description;
    this.apiSpec = params.apiSpec;
  }

  /** @ignore */
  async _call(_input: string) {
    return this.apiSpec;
  }

  static async fromPluginUrl(url: string) {
    const aiPluginRes = await fetch(url);
    if (!aiPluginRes.ok) {
      throw new Error(
        `Failed to fetch plugin from ${url} with status ${aiPluginRes.status}`
      );
    }
    const aiPluginJson = await aiPluginRes.json();

    const apiUrlRes = await fetch(aiPluginJson.api.url);
    if (!apiUrlRes.ok) {
      throw new Error(
        `Failed to fetch API spec from ${aiPluginJson.api.url} with status ${apiUrlRes.status}`
      );
    }
    const apiUrlJson = await apiUrlRes.text();

    return new AIPluginTool({
      name: aiPluginJson.name_for_model,
      description: `Call this tool to get the OpenAPI spec (and usage guide) for interacting with the ${aiPluginJson.name_for_human} API. You should only call this ONCE! What is the ${aiPluginJson.name_for_human} API useful for? ${aiPluginJson.description_for_human}`,
      apiSpec: `Usage Guide: ${aiPluginJson.description_for_model}

OpenAPI Spec in JSON or YAML format:\n${apiUrlJson}`,
    });
  }
}
