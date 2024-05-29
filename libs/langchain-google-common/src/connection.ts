import { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import {
  AsyncCaller,
  AsyncCallerCallOptions,
} from "@langchain/core/utils/async_caller";
import { getRuntimeEnvironment } from "@langchain/core/utils/env";
import { StructuredToolInterface } from "@langchain/core/tools";
import type {
  GoogleAIBaseLLMInput,
  GoogleConnectionParams,
  GoogleLLMModelFamily,
  GooglePlatformType,
  GoogleResponse,
  GoogleLLMResponse,
  GeminiContent,
  GeminiGenerationConfig,
  GeminiRequest,
  GeminiSafetySetting,
  GeminiTool,
  GeminiFunctionDeclaration,
  GoogleAIModelRequestParams,
} from "./types.js";
import {
  GoogleAbstractedClient,
  GoogleAbstractedClientOps,
  GoogleAbstractedClientOpsMethod,
} from "./auth.js";
import { zodToGeminiParameters } from "./utils/zod_to_gemini_parameters.js";

export abstract class GoogleConnection<
  CallOptions extends AsyncCallerCallOptions,
  ResponseType extends GoogleResponse
> {
  caller: AsyncCaller;

  client: GoogleAbstractedClient;

  streaming: boolean;

  constructor(
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    this.caller = caller;
    this.client = client;
    this.streaming = streaming ?? false;
  }

  abstract buildUrl(): Promise<string>;

  abstract buildMethod(): GoogleAbstractedClientOpsMethod;

  async _clientInfoHeaders(): Promise<Record<string, string>> {
    const { userAgent, clientLibraryVersion } = await this._getClientInfo();
    return {
      "User-Agent": userAgent,
      "Client-Info": clientLibraryVersion,
    };
  }

  async _getClientInfo(): Promise<{
    userAgent: string;
    clientLibraryVersion: string;
  }> {
    const env = await getRuntimeEnvironment();
    const langchain = env?.library ?? "langchain-js";
    // TODO: Add an API for getting the current LangChain version
    const langchainVersion = "0";
    const moduleName = await this._moduleName();
    let clientLibraryVersion = `${langchain}/${langchainVersion}`;
    if (moduleName && moduleName.length) {
      clientLibraryVersion = `${clientLibraryVersion}-${moduleName}`;
    }
    return {
      userAgent: clientLibraryVersion,
      clientLibraryVersion: `${langchainVersion}-${moduleName}`,
    };
  }

  async _moduleName(): Promise<string> {
    return this.constructor.name;
  }

  async _request(
    data: unknown | undefined,
    options: CallOptions
  ): Promise<ResponseType> {
    const url = await this.buildUrl();
    const method = this.buildMethod();
    const infoHeaders = (await this._clientInfoHeaders()) ?? {};
    const headers = {
      ...infoHeaders,
    };

    const opts: GoogleAbstractedClientOps = {
      url,
      method,
      headers,
    };
    if (data && method === "POST") {
      opts.data = data;
    }
    if (this.streaming) {
      opts.responseType = "stream";
    } else {
      opts.responseType = "json";
    }

    const callResponse = await this.caller.callWithOptions(
      { signal: options?.signal },
      async () => this.client.request(opts)
    );
    const response: unknown = callResponse; // Done for typecast safety, I guess
    return <ResponseType>response;
  }
}

export abstract class GoogleHostConnection<
    CallOptions extends AsyncCallerCallOptions,
    ResponseType extends GoogleResponse,
    AuthOptions
  >
  extends GoogleConnection<CallOptions, ResponseType>
  implements GoogleConnectionParams<AuthOptions>
{
  // This does not default to a value intentionally.
  // Use the "platform" getter if you need this.
  platformType: GooglePlatformType | undefined;

  endpoint = "us-central1-aiplatform.googleapis.com";

  location = "us-central1";

  apiVersion = "v1";

  constructor(
    fields: GoogleConnectionParams<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(caller, client, streaming);
    this.caller = caller;

    this.platformType = fields?.platformType;
    this.endpoint = fields?.endpoint ?? this.endpoint;
    this.location = fields?.location ?? this.location;
    this.apiVersion = fields?.apiVersion ?? this.apiVersion;
    this.client = client;
  }

  get platform(): GooglePlatformType {
    return this.platformType ?? this.computedPlatformType;
  }

  get computedPlatformType(): GooglePlatformType {
    return "gcp";
  }

  buildMethod(): GoogleAbstractedClientOpsMethod {
    return "POST";
  }
}

export abstract class GoogleAIConnection<
    CallOptions extends BaseLanguageModelCallOptions,
    MessageType,
    AuthOptions
  >
  extends GoogleHostConnection<CallOptions, GoogleLLMResponse, AuthOptions>
  implements GoogleAIBaseLLMInput<AuthOptions>
{
  model: string;

  modelName: string;

  client: GoogleAbstractedClient;

  constructor(
    fields: GoogleAIBaseLLMInput<AuthOptions> | undefined,
    caller: AsyncCaller,
    client: GoogleAbstractedClient,
    streaming?: boolean
  ) {
    super(fields, caller, client, streaming);
    this.client = client;
    this.modelName = fields?.model ?? fields?.modelName ?? this.model;
    this.model = this.modelName;
  }

  get modelFamily(): GoogleLLMModelFamily {
    if (this.model.startsWith("gemini")) {
      return "gemini";
    } else {
      return null;
    }
  }

  get computedPlatformType(): GooglePlatformType {
    if (this.client.clientType === "apiKey") {
      return "gai";
    } else {
      return "gcp";
    }
  }

  abstract buildUrlMethod(): Promise<string>;

  async buildUrlGenerativeLanguage(): Promise<string> {
    const method = await this.buildUrlMethod();
    const url = `https://generativelanguage.googleapis.com/${this.apiVersion}/models/${this.model}:${method}`;
    return url;
  }

  async buildUrlVertex(): Promise<string> {
    const projectId = await this.client.getProjectId();
    const method = await this.buildUrlMethod();
    const url = `https://${this.endpoint}/${this.apiVersion}/projects/${projectId}/locations/${this.location}/publishers/google/models/${this.model}:${method}`;
    return url;
  }

  async buildUrl(): Promise<string> {
    switch (this.platform) {
      case "gai":
        return this.buildUrlGenerativeLanguage();
      default:
        return this.buildUrlVertex();
    }
  }

  abstract formatData(
    input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): unknown;

  async request(
    input: MessageType,
    parameters: GoogleAIModelRequestParams,
    options: CallOptions
  ): Promise<GoogleLLMResponse> {
    const data = this.formatData(input, parameters);
    const response = await this._request(data, options);
    return response;
  }
}

export abstract class AbstractGoogleLLMConnection<
  MessageType,
  AuthOptions
> extends GoogleAIConnection<
  BaseLanguageModelCallOptions,
  MessageType,
  AuthOptions
> {
  async buildUrlMethodGemini(): Promise<string> {
    return this.streaming ? "streamGenerateContent" : "generateContent";
  }

  async buildUrlMethod(): Promise<string> {
    switch (this.modelFamily) {
      case "gemini":
        return this.buildUrlMethodGemini();
      default:
        throw new Error(`Unknown model family: ${this.modelFamily}`);
    }
  }

  abstract formatContents(
    input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): GeminiContent[];

  formatGenerationConfig(
    _input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): GeminiGenerationConfig {
    return {
      temperature: parameters.temperature,
      topK: parameters.topK,
      topP: parameters.topP,
      maxOutputTokens: parameters.maxOutputTokens,
      stopSequences: parameters.stopSequences,
      responseMimeType: parameters.responseMimeType,
    };
  }

  formatSafetySettings(
    _input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): GeminiSafetySetting[] {
    return parameters.safetySettings ?? [];
  }

  formatSystemInstruction(
    _input: MessageType,
    _parameters: GoogleAIModelRequestParams
  ): GeminiContent {
    return {} as GeminiContent;
  }

  // Borrowed from the OpenAI invocation params test
  isStructuredToolArray(tools?: unknown[]): tools is StructuredToolInterface[] {
    return (
      tools !== undefined &&
      tools.every((tool) =>
        Array.isArray((tool as StructuredToolInterface).lc_namespace)
      )
    );
  }

  structuredToolToFunctionDeclaration(
    tool: StructuredToolInterface
  ): GeminiFunctionDeclaration {
    const jsonSchema = zodToGeminiParameters(tool.schema);
    return {
      name: tool.name,
      description: tool.description,
      parameters: jsonSchema,
    };
  }

  structuredToolsToGeminiTools(tools: StructuredToolInterface[]): GeminiTool[] {
    return [
      {
        functionDeclarations: tools.map(
          this.structuredToolToFunctionDeclaration
        ),
      },
    ];
  }

  formatTools(
    _input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): GeminiTool[] {
    const tools: StructuredToolInterface[] | GeminiTool[] | undefined =
      parameters?.tools;
    if (!tools || tools.length === 0) {
      return [];
    }

    if (this.isStructuredToolArray(tools)) {
      return this.structuredToolsToGeminiTools(tools);
    } else {
      if (tools.length === 1 && !tools[0].functionDeclarations?.length) {
        return [];
      }
      return tools as GeminiTool[];
    }
  }

  formatData(
    input: MessageType,
    parameters: GoogleAIModelRequestParams
  ): GeminiRequest {
    const contents = this.formatContents(input, parameters);
    const generationConfig = this.formatGenerationConfig(input, parameters);
    const tools = this.formatTools(input, parameters);
    const safetySettings = this.formatSafetySettings(input, parameters);
    const systemInstruction = this.formatSystemInstruction(input, parameters);

    const ret: GeminiRequest = {
      contents,
      generationConfig,
    };
    if (tools && tools.length) {
      ret.tools = tools;
    }
    if (safetySettings && safetySettings.length) {
      ret.safetySettings = safetySettings;
    }
    if (
      systemInstruction?.role &&
      systemInstruction?.parts &&
      systemInstruction?.parts?.length
    ) {
      ret.systemInstruction = systemInstruction;
    }
    return ret;
  }
}
