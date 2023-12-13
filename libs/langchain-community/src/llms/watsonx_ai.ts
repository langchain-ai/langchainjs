import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  type BaseLLMCallOptions,
  LLM,
} from "@langchain/core/language_models/llms";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { WatsonApiClient } from "../utils/watsonx-client.js";
import type {
  WatsonModelParameters,
  WatsonxAIParams,
} from "../types/watsonx-types.js";

/**
 * The WatsonxAI class is used to interact with Watsonx AI
 * Inference Endpoint models. It uses IBM Cloud for authentication.
 * This requires your IBM Cloud API Key which is autoloaded if not specified.
 */

export class WatsonxAI extends LLM<BaseLLMCallOptions> {
  static lc_name() {
    return "WatsonxAI";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ibmCloudApiKey: "IBM_CLOUD_API_KEY",
      projectId: "WATSONX_PROJECT_ID",
    };
  }

  modelId = "meta-llama/llama-2-70b-chat";

  modelKwargs?: Record<string, unknown>;

  projectId!: string;

  modelParameters?: WatsonModelParameters;

  private readonly watsonApiClient: WatsonApiClient;

  constructor(fields: WatsonxAIParams) {
    super(fields);

    this.modelId = fields?.modelId ?? this.modelId;
    this.projectId =
      fields?.projectId ?? getEnvironmentVariable("WATSONX_PROJECT_ID") ?? "";
    this.modelParameters = fields.modelParameters;

    const {
      apiKey = getEnvironmentVariable("IBM_CLOUD_API_KEY"),
      apiVersion = "2023-05-29",
      region = "us-south",
    } = fields.clientConfig ?? {};

    if (!apiKey) {
      throw new Error("Missing IBM Cloud API Key");
    }

    if (!this.projectId) {
      throw new Error("Missing WatsonX AI Project ID");
    }

    this.watsonApiClient = new WatsonApiClient({
      apiKey,
      region,
      apiVersion,
    });
  }

  _llmType() {
    return "watsonx_ai";
  }

  /**
   * Calls the WatsonX AI endpoint and retrieves the result.
   * @param {string} prompt The input prompt.
   * @returns {Promise<string>} A promise that resolves to the generated string.
   */
  /** @ignore */
  async _call(
    prompt: string,
    _options: this["ParsedCallOptions"]
  ): Promise<string> {
    return await this.caller.call(async () =>
      this.watsonApiClient.generateText(
        prompt,
        this.projectId,
        this.modelId,
        this.modelParameters
      )
    );
  }

  async *_streamResponseChunks(
    input: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ) {
    const stream = await this.caller.call(async () =>
      this.watsonApiClient.generateTextStream(
        input,
        this.projectId,
        this.modelId,
        this.modelParameters
      )
    );

    for await (const data of stream) {
      const [
        {
          generated_text,
          generated_token_count,
          input_token_count,
          stop_reason,
        },
      ] = data.results;
      const generationChunk = new ChatGenerationChunk({
        text: generated_text,
        message: new AIMessageChunk({ content: generated_text }),
        generationInfo: {
          generated_token_count,
          input_token_count,
          stop_reason,
        },
      });
      yield generationChunk;
      await _runManager?.handleLLMNewToken(generated_text);
    }
  }
}
