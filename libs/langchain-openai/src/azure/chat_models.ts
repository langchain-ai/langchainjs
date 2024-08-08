import { type ClientOptions, AzureOpenAI as AzureOpenAIClient } from "openai";
import {
  LangSmithParams,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "../chat_models.js";
import { OpenAIEndpointConfig, getEndpoint } from "../utils/azure.js";
import {
  AzureOpenAIInput,
  LegacyOpenAIInput,
  OpenAIChatInput,
  OpenAICoreRequestOptions,
} from "../types.js";

/**
 * Azure OpenAI chat model integration.
 *
 * Setup:
 * Install `@langchain/openai` and set the following environment variables:
 *
 * ```bash
 * npm install @langchain/openai
 * export AZURE_OPENAI_API_KEY="your-api-key"
 * export AZURE_OPENAI_API_DEPLOYMENT_NAME="your-deployment-name"
 * export AZURE_OPENAI_API_VERSION="your-version"
 * export AZURE_OPENAI_BASE_PATH="your-base-path"
 * ```
 *
 * ## Key args
 *
 * ### [Init args](/classes/langchain_openai.AzureChatOpenAI.html#constructor)
 *
 * ### [Runtime args](/interfaces/langchain_openai.ChatOpenAICallOptions.html)
 *
 * > See full list of supported init args and their descriptions in the [`constructor`](/classes/langchain_openai.AzureChatOpenAI.html#constructor) section.
 *
 * ## Examples
 * 
 * <details open>
 * <summary><strong>Instantiate</strong></summary>
 * 
 * ```typescript
 * import { AzureChatOpenAI } from '@langchain/openai';
 *
 * const llm = new AzureChatOpenAI({
 *   azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY, // In Node.js defaults to process.env.AZURE_OPENAI_API_KEY
 *   azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME, // In Node.js defaults to process.env.AZURE_OPENAI_API_INSTANCE_NAME
 *   azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME, // In Node.js defaults to process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME
 *   azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION, // In Node.js defaults to process.env.AZURE_OPENAI_API_VERSION
 *   temperature: 0,
 *   maxTokens: undefined,
 *   timeout: undefined,
 *   maxRetries: 2,
 *   // apiKey: "...",
 *   // baseUrl: "...",
 *   // other params...
 * });
 * ```
 * </details>
 * 
 * <br />
 * 
 * <details>
 * <summary><strong>Invoking</strong></summary>
 * 
 * ```typescript
 * const messages = [
 *   {
 *     type: "system" as const,
 *     content: "You are a helpful translator. Translate the user sentence to French.",
 *   },
 *   {
 *     type: "human" as const,
 *     content: "I love programming.",
 *   },
 * ];
 * const result = await llm.invoke(messages);
 * console.log(result);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>Streaming Chunks</strong></summary>
 * 
 * ```typescript
 * for await (const chunk of await llm.stream(messages)) {
 *   console.log(chunk);
 * }
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>Aggregate Streamed Chunks</strong></summary>
 * 
 * ```typescript
 * import { AIMessageChunk } from '@langchain/core/messages';
 * import { concat } from '@langchain/core/utils/stream';
 *
 * const stream = await llm.stream(messages);
 * let full: AIMessageChunk | undefined;
 * for await (const chunk of stream) {
 *   full = !full ? chunk : concat(full, chunk);
 * }
 * console.log(full);
 * ```
 * </details>
 * 
 * <br />
 * 
 * <details>
 * <summary><strong>Bind tools</strong></summary>
 * 
 * ```typescript
 * import { z } from 'zod';
 *
 * const GetWeather = {
 *   name: "GetWeather",
 *   description: "Get the current weather in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const GetPopulation = {
 *   name: "GetPopulation",
 *   description: "Get the current population in a given location",
 *   schema: z.object({
 *     location: z.string().describe("The city and state, e.g. San Francisco, CA")
 *   }),
 * }
 *
 * const llmWithTools = llm.bindTools([GetWeather, GetPopulation]);
 * const aiMsg = await llmWithTools.invoke(
 *   "Which city is hotter today and which is bigger: LA or NY?"
 * );
 * console.log(aiMsg.tool_calls);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>`.withStructuredOutput`</strong></summary>
 * 
 * ```typescript
 * import { z } from 'zod';
 *
 * const Joke = z.object({
 *   setup: z.string().describe("The setup of the joke"),
 *   punchline: z.string().describe("The punchline to the joke"),
 *   rating: z.number().optional().describe("How funny the joke is, from 1 to 10")
 * }).describe('Joke to tell user.');
 *
 * const structuredLlm = llm.withStructuredOutput(Joke);
 * const jokeResult = await structuredLlm.invoke("Tell me a joke about cats");
 * console.log(jokeResult);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>JSON Object Response Format</strong></summary>
 * 
 * ```typescript
 * const jsonLlm = llm.bind({ response_format: { type: "json_object" } });
 * const jsonLlmAiMsg = await jsonLlm.invoke(
 *   "Return a JSON object with key 'randomInts' and a value of 10 random ints in [0-99]"
 * );
 * console.log(jsonLlmAiMsg.content);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>Multimodal</strong></summary>
 * 
 * ```typescript
 * import { HumanMessage } from '@langchain/core/messages';
 *
 * const imageUrl = "https://example.com/image.jpg";
 * const imageData = await fetch(imageUrl).then(res => res.arrayBuffer());
 * const base64Image = Buffer.from(imageData).toString('base64');
 *
 * const message = new HumanMessage({
 *   content: [
 *     { type: "text", text: "describe the weather in this image" },
 *     {
 *       type: "image_url",
 *       image_url: { url: `data:image/jpeg;base64,${base64Image}` },
 *     },
 *   ]
 * });
 *
 * const imageDescriptionAiMsg = await llm.invoke([message]);
 * console.log(imageDescriptionAiMsg.content);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>Usage Metadata</strong></summary>
 * 
 * ```typescript
 * const aiMsgForMetadata = await llm.invoke(messages);
 * console.log(aiMsgForMetadata.usage_metadata);
 * ```
 * </details>
 *
 * <br />
 * 
 * <details>
 * <summary><strong>Logprobs</strong></summary>
 * 
 * ```typescript
 * const logprobsLlm = new ChatOpenAI({ logprobs: true });
 * const aiMsgForLogprobs = await logprobsLlm.invoke(messages);
 * console.log(aiMsgForLogprobs.response_metadata.logprobs);
 * ```
 * </details>
 * 
 * <br />
 *
 * <details>
 * <summary><strong>Response Metadata</strong></summary>
 * 
 * ```typescript
 * const aiMsgForResponseMetadata = await llm.invoke(messages);
 * console.log(aiMsgForResponseMetadata.response_metadata);
 * ```
 * </details>
 */
export class AzureChatOpenAI extends ChatOpenAI {
  _llmType(): string {
    return "azure_openai";
  }

  get lc_aliases(): Record<string, string> {
    return {
      openAIApiKey: "openai_api_key",
      openAIApiVersion: "openai_api_version",
      openAIBasePath: "openai_api_base",
    };
  }

  constructor(
    fields?: Partial<OpenAIChatInput> &
      Partial<AzureOpenAIInput> & {
        openAIApiKey?: string;
        openAIApiVersion?: string;
        openAIBasePath?: string;
        deploymentName?: string;
      } & BaseChatModelParams & {
        configuration?: ClientOptions & LegacyOpenAIInput;
      }
  ) {
    const newFields = fields ? { ...fields } : fields;
    if (newFields) {
      // don't rewrite the fields if they are already set
      newFields.azureOpenAIApiDeploymentName =
        newFields.azureOpenAIApiDeploymentName ?? newFields.deploymentName;
      newFields.azureOpenAIApiKey =
        newFields.azureOpenAIApiKey ?? newFields.openAIApiKey;
      newFields.azureOpenAIApiVersion =
        newFields.azureOpenAIApiVersion ?? newFields.openAIApiVersion;
    }

    super(newFields);
  }

  getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    const params = super.getLsParams(options);
    params.ls_provider = "azure";
    return params;
  }

  protected _getClientOptions(options: OpenAICoreRequestOptions | undefined) {
    if (!this.client) {
      const openAIEndpointConfig: OpenAIEndpointConfig = {
        azureOpenAIApiDeploymentName: this.azureOpenAIApiDeploymentName,
        azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
        azureOpenAIApiKey: this.azureOpenAIApiKey,
        azureOpenAIBasePath: this.azureOpenAIBasePath,
        azureADTokenProvider: this.azureADTokenProvider,
        baseURL: this.clientConfig.baseURL,
      };

      const endpoint = getEndpoint(openAIEndpointConfig);

      const params = {
        ...this.clientConfig,
        baseURL: endpoint,
        timeout: this.timeout,
        maxRetries: 0,
      };

      if (!this.azureADTokenProvider) {
        params.apiKey = openAIEndpointConfig.azureOpenAIApiKey;
      }

      if (!params.baseURL) {
        delete params.baseURL;
      }

      params.defaultHeaders = {
        ...params.defaultHeaders,
        "User-Agent": params.defaultHeaders?.["User-Agent"]
          ? `${params.defaultHeaders["User-Agent"]}: langchainjs-azure-openai-v2`
          : `langchainjs-azure-openai-v2`,
      };

      this.client = new AzureOpenAIClient({
        apiVersion: this.azureOpenAIApiVersion,
        azureADTokenProvider: this.azureADTokenProvider,
        deployment: this.azureOpenAIApiDeploymentName,
        ...params,
      });
    }
    const requestOptions = {
      ...this.clientConfig,
      ...options,
    } as OpenAICoreRequestOptions;
    if (this.azureOpenAIApiKey) {
      requestOptions.headers = {
        "api-key": this.azureOpenAIApiKey,
        ...requestOptions.headers,
      };
      requestOptions.query = {
        "api-version": this.azureOpenAIApiVersion,
        ...requestOptions.query,
      };
    }
    return requestOptions;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    const json = super.toJSON() as unknown;

    function isRecord(obj: unknown): obj is Record<string, unknown> {
      return typeof obj === "object" && obj != null;
    }

    if (isRecord(json) && isRecord(json.kwargs)) {
      delete json.kwargs.azure_openai_base_path;
      delete json.kwargs.azure_openai_api_deployment_name;
      delete json.kwargs.azure_openai_api_key;
      delete json.kwargs.azure_openai_api_version;
      delete json.kwargs.azure_open_ai_base_path;
    }

    return json;
  }
}
