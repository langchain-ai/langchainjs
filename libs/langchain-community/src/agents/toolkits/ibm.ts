import {
  WatsonXAI,
  convertUtilityToolToWatsonxTool,
} from "@ibm-cloud/watsonx-ai";
import {
  BaseToolkit,
  StructuredTool,
  StructuredToolInterface,
} from "@langchain/core/tools";
import {
  InteropZodObject,
  ZodObjectV3,
  interopSafeParse,
} from "@langchain/core/utils/types";
import {
  authenticateAndSetInstance,
  jsonSchemaToZod,
} from "../../utils/ibm.js";
import { WatsonxAuth, WatsonxInit } from "../../types/ibm.js";

export interface WatsonxToolParams {
  name: string;
  description: string;
  schema?: Record<string, any>;
  service?: WatsonXAI;
  configSchema?: Record<string, any>;
}

export class WatsonxTool extends StructuredTool implements WatsonxToolParams {
  name: string;

  description: string;

  service: WatsonXAI;

  schema: ZodObjectV3;

  configSchema?: InteropZodObject;

  toolConfig?: Record<string, any>;

  constructor(
    fields: WatsonXAI.TextChatParameterFunction,
    service: WatsonXAI,
    configSchema?: WatsonXAI.JsonObject
  ) {
    super();

    this.name = fields?.name;
    this.description = fields?.description || "";
    this.schema = jsonSchemaToZod(fields?.parameters);
    this.configSchema = configSchema
      ? jsonSchemaToZod(configSchema)
      : undefined;

    this.service = service;
  }

  protected async _call(inputObject: Record<string, any>): Promise<string> {
    const { input } = inputObject;
    const response = await this.service.runUtilityAgentToolByName({
      toolId: this.name,
      wxUtilityAgentToolsRunRequest: {
        input: input ?? inputObject,
        tool_name: this.name,
        config: this.toolConfig,
      },
    });

    const result = response?.result.output;
    return new Promise((resolve) => {
      resolve(result ?? "Sorry, the tool did not work as expected");
    });
  }

  set config(config: Record<string, any>) {
    if (!this.configSchema) {
      this.toolConfig = config;
      return;
    }
    const result = interopSafeParse(this.configSchema, config);
    this.toolConfig = result.data;
  }
}

export class WatsonxToolkit extends BaseToolkit {
  tools: WatsonxTool[];

  service: WatsonXAI;

  constructor(fields: WatsonxAuth & WatsonxInit) {
    super();
    const {
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      version,
      disableSSL,
      serviceUrl,
    } = fields;

    const auth = authenticateAndSetInstance({
      watsonxAIApikey,
      watsonxAIAuthType,
      watsonxAIBearerToken,
      watsonxAIUsername,
      watsonxAIPassword,
      watsonxAIUrl,
      disableSSL,
      version,
      serviceUrl,
    });
    if (auth) this.service = auth;
  }

  async loadTools() {
    const { result: tools } = await this.service.listUtilityAgentTools();
    this.tools = tools.resources
      .map((tool) => {
        const { function: watsonxTool } = convertUtilityToolToWatsonxTool(tool);
        if (watsonxTool)
          return new WatsonxTool(watsonxTool, this.service, tool.config_schema);
        else return undefined;
      })
      .filter((item): item is WatsonxTool => item !== undefined);
  }

  static async init(props: WatsonxAuth & WatsonxInit) {
    const instance = new WatsonxToolkit({ ...props });
    await instance.loadTools();
    return instance;
  }

  getTools(): StructuredToolInterface[] {
    return this.tools;
  }

  getTool(toolName: string, config?: Record<string, any>) {
    const selectedTool = this.tools.find((item) => item.name === toolName);
    if (!selectedTool)
      throw new Error("Tool with provided name does not exist");
    if (config) {
      selectedTool.config = config;
    }
    return selectedTool;
  }
}
