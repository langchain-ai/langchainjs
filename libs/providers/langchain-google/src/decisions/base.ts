import {
  BaseDecisionModel,
  type ClassifierRequest,
  type ClassifierResponse,
  type Question,
  type State,
} from "@langchain/core/decisions";
import type { Callbacks } from "@langchain/core/callbacks/manager";
import {
  getCallbackManagerForConfig,
  mergeConfigs,
  type RunnableConfig,
} from "@langchain/core/runnables";
import { AsyncCaller } from "@langchain/core/utils/async_caller";
import type { ApiClient } from "../clients/index.js";
import {
  convertDecisionsResponseToClassifierResponse,
  convertQuestionsToDecisionsQuestions,
  convertStateToDecisionsInput,
} from "../converters/decisions/index.js";
import { convertMediaResolutionToInteractions } from "../converters/interactions/params.js";
import {
  formatGoogleApiUrl,
  getPlatformType,
  hasVertexCredentials,
  resolveGoogleApiVersion,
  resolveGoogleEndpoint,
  resolvePlatformFromParams,
  type GooglePlatformType,
} from "../utils/connection.js";
import {
  ConfigurationError,
  decisionBlockedErrorFromErrorBody,
  MalformedOutputError,
  RequestError,
} from "../utils/errors.js";
import type {
  BaseGoogleClassifierParams,
  GoogleClassifierFields,
  GoogleDecisions,
} from "./types.js";

export function normalizeGoogleClassifierParams<
  TParams extends BaseGoogleClassifierParams,
>(
  modelOrParams: string | TParams,
  paramsArg?: Omit<TParams, "model">
): TParams {
  if (typeof modelOrParams === "string") {
    return { ...(paramsArg ?? {}), model: modelOrParams } as TParams;
  }
  if (!modelOrParams || typeof modelOrParams !== "object") {
    throw new ConfigurationError(
      'GoogleClassifier requires a model name (for example, "gemini-decision-1").'
    );
  }
  return { ...modelOrParams };
}

/**
 * Shared abstract base class for Google Gemini Decisions models.
 *
 * Evaluates one or more typed questions (`Noul`, `Choice`, `Score`) in parallel
 * against shared multimodal or structured `State` using Google's Decisions API
 * (`POST /{api_version}/decisions`).
 */
export abstract class BaseGoogleClassifier extends BaseDecisionModel {
  lc_namespace = ["langchain", "classifiers", "google"];

  get _provider(): string {
    return "google";
  }

  callbacks?: Callbacks;

  tags?: string[];

  metadata?: Record<string, unknown>;

  protected caller: AsyncCaller;

  declare protected apiClient: ApiClient;

  protected _platform?: GooglePlatformType;

  protected _endpoint?: string;

  protected _location?: string;

  protected _apiVersion?: string;

  declare protected _customHeaders?: Record<string, string>;

  protected _mediaResolution?: GoogleClassifierFields["mediaResolution"];

  protected _detail?: GoogleClassifierFields["detail"];

  private readonly _hasExplicitVertexCredentials: boolean;

  constructor(
    params: BaseGoogleClassifierParams & {
      apiKey?: string;
      credentials?: unknown;
      googleAuthOptions?: unknown;
    }
  ) {
    const rawModel = typeof params.model === "string" ? params.model : "";
    const model = rawModel.trim();

    // Strip credentials, headers, clients, and runtime callbacks from `lc_kwargs`
    // so `util.inspect` / `console.log` never expose sensitive values.
    const {
      apiKey: _apiKey,
      credentials: _credentials,
      googleAuthOptions: _googleAuthOptions,
      customHeaders: _customHeaders,
      apiClient: _apiClient,
      callbacks: _callbacks,
      onFailedAttempt: _onFailedAttempt,
      ...serializableKwargs
    } = params;

    super({ ...serializableKwargs, model });

    if (model.length === 0) {
      throw new ConfigurationError("GoogleClassifier model must not be empty.");
    }

    if (!params.apiClient) {
      throw new ConfigurationError(
        "BaseGoogleClassifier requires an apiClient. This should be provided automatically by GoogleClassifier constructors. If you are extending BaseGoogleClassifier directly, please provide an apiClient instance."
      );
    }

    Object.defineProperty(this, "apiClient", {
      value: params.apiClient,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(this, "_customHeaders", {
      value: params.customHeaders,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    this.caller = new AsyncCaller(params);
    this.callbacks = params.callbacks;
    this.tags = params.tags;
    this.metadata = params.metadata;

    this._platform = resolvePlatformFromParams(params);
    this._endpoint = params.endpoint;
    this._location = params.location;
    this._apiVersion = params.apiVersion;
    this._mediaResolution = params.mediaResolution;
    this._detail = params.detail;
    this._hasExplicitVertexCredentials = hasVertexCredentials(params);
  }

  protected get platform(): GooglePlatformType {
    return getPlatformType(this._platform, this.apiClient.hasApiKey());
  }

  protected get isVertexExpress(): boolean {
    return (
      this.platform === "gcp" &&
      this.apiClient.hasApiKey() &&
      !this._hasExplicitVertexCredentials
    );
  }

  protected get location(): string {
    return this._location || "global";
  }

  protected get apiVersion(): string {
    return resolveGoogleApiVersion({
      platform: this.platform,
      apiVersion: this._apiVersion,
    });
  }

  protected get endpoint(): string {
    return resolveGoogleEndpoint({
      platform: this.platform,
      endpoint: this._endpoint,
      location: this.location,
      isVertexExpress: this.isVertexExpress,
    });
  }

  protected async buildUrl(): Promise<string> {
    if (this.platform === "gai") {
      return formatGoogleApiUrl({
        endpoint: this.endpoint,
        apiVersion: this.apiVersion,
        suffix: "/decisions",
      });
    }
    if (this.isVertexExpress) {
      return formatGoogleApiUrl({
        endpoint: this.endpoint,
        apiVersion: this.apiVersion,
        pathPrefix: ["publishers/google"],
        suffix: "/decisions",
      });
    }
    const projectId = await this.apiClient.getProjectId();
    return formatGoogleApiUrl({
      endpoint: this.endpoint,
      apiVersion: this.apiVersion,
      pathPrefix: [`projects/${projectId}`, `locations/${this.location}`],
      suffix: "/decisions",
    });
  }

  protected getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this._customHeaders,
    };
  }

  override async invoke<const Q extends Record<string, Question>>(
    input: ClassifierRequest<Q>,
    options?: Partial<RunnableConfig>
  ): Promise<ClassifierResponse<Q>> {
    const hasInstanceDefaults =
      this.callbacks !== undefined ||
      this.tags !== undefined ||
      this.metadata !== undefined;
    const mergedOptions = hasInstanceDefaults
      ? mergeConfigs(
          {
            ...(this.callbacks !== undefined
              ? { callbacks: this.callbacks }
              : {}),
            ...(this.tags !== undefined ? { tags: this.tags } : {}),
            ...(this.metadata !== undefined ? { metadata: this.metadata } : {}),
          },
          options
        )
      : options;
    return super.invoke(input, mergedOptions);
  }

  async _classify(
    state: State,
    questions: Record<string, Question>,
    config?: Partial<RunnableConfig>
  ): Promise<ClassifierResponse> {
    const mediaResolution = convertMediaResolutionToInteractions(
      this._mediaResolution,
      this._detail
    );
    const input = convertStateToDecisionsInput(state, mediaResolution);
    const wireQuestions = convertQuestionsToDecisionsQuestions(
      questions,
      mediaResolution
    );

    const body: GoogleDecisions.CreateDecisionRequest = {
      model: this.model,
      input,
      questions: wireQuestions,
    };

    const url = await this.buildUrl();
    const headers = this.getHeaders();
    const moduleName = this.constructor.name;
    const callbackManager = config
      ? await getCallbackManagerForConfig(config)
      : undefined;
    const runId = callbackManager?.getParentRunId() ?? "";

    await callbackManager?.handleCustomEvent?.(
      `google-request-${moduleName}`,
      { url, headers, body },
      runId
    );

    let response: Response;
    let data: GoogleDecisions.CreateDecisionResponse;

    try {
      const result = await this.caller.callWithOptions(
        { signal: config?.signal },
        async () => {
          const nextResponse = await this.apiClient.fetch(
            new Request(url, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
              signal: config?.signal,
            })
          );

          if (!nextResponse.ok) {
            const reqError = await RequestError.fromResponse(nextResponse);
            if (reqError.statusCode === 400) {
              const safetyError = decisionBlockedErrorFromErrorBody(
                reqError.data
              );
              if (safetyError) {
                throw safetyError;
              }
            }
            throw reqError;
          }

          let parsedBody: GoogleDecisions.CreateDecisionResponse;
          try {
            parsedBody =
              (await nextResponse.json()) as GoogleDecisions.CreateDecisionResponse;
          } catch (cause) {
            throw new MalformedOutputError({
              message:
                "Failed to parse JSON response from Gemini Decisions API.",
              cause,
            });
          }

          return { response: nextResponse, data: parsedBody };
        }
      );
      response = result.response;
      data = result.data;
    } catch (error) {
      await callbackManager?.handleCustomEvent?.(
        `google-response-${moduleName}`,
        { error },
        runId
      );
      throw error;
    }

    await callbackManager?.handleCustomEvent?.(
      `google-response-${moduleName}`,
      {
        data,
        url: response.url,
        headers: Array.from(response.headers.entries()),
        status: response.status,
        statusText: response.statusText,
      },
      runId
    );

    const requestId =
      response.headers.get("x-goog-request-id") ??
      response.headers.get("x-request-id");

    return convertDecisionsResponseToClassifierResponse({
      data,
      model: this.model,
      questions,
      requestId,
    });
  }
}
