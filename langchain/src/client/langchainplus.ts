import { BaseRun, Run, RunType } from "../callbacks/handlers/tracer.js";
import {
  LangChainTracer,
  TracerSession,
} from "../callbacks/handlers/tracer_langchain.js";
import {
  ChainValues,
  LLMResult,
  RunInputs,
  RunOutputs,
  StoredMessage,
} from "../schema/index.js";
import { BaseLanguageModel } from "../base_language/index.js";
import { BaseChain } from "../chains/base.js";
import { BaseLLM } from "../llms/base.js";
import { BaseChatModel } from "../chat_models/base.js";
import { mapStoredMessagesToChatMessages } from "../stores/message/utils.js";
import { AsyncCaller, AsyncCallerParams } from "../util/async_caller.js";

export interface RunResult extends BaseRun {
  name: string;
  session_id: string; // uuid
  parent_run_id?: string; // uuid
}

export interface BaseDataset {
  name: string;
  description: string;
  tenant_id: string;
}

export interface Dataset extends BaseDataset {
  id: string;
  created_at: string;
  modified_at: string;
}

export interface BaseExample {
  dataset_id: string;
  inputs: RunInputs;
  outputs: RunOutputs;
}

export interface ExampleCreate extends BaseExample {
  id?: string;
  created_at: string;
}

export interface Example extends BaseExample {
  id: string;
  created_at: string;
  modified_at: string;
  runs: RunResult[];
}

interface ListRunsParams {
  sessionId?: string;
  sessionName?: string;
  executionOrder?: number;
  runType?: RunType;
  error?: boolean;
}
interface UploadCSVParams {
  csvFile: Blob;
  fileName: string;
  inputKeys: string[];
  outputKeys: string[];
  description?: string;
}

export type DatasetRunResults = Record<
  string,
  (string | LLMResult | ChainValues)[]
>;

// utility functions
const isLocalhost = (url: string): boolean => {
  const strippedUrl = url.replace("http://", "").replace("https://", "");
  const hostname = strippedUrl.split("/")[0].split(":")[0];
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  );
};

const getSeededTenantId = async (
  apiUrl: string,
  apiKey: string | undefined,
  callerOptions: AsyncCallerParams | undefined = undefined
): Promise<string> => {
  // Get the tenant ID from the seeded tenant
  const caller = new AsyncCaller(callerOptions ?? {});
  const url = `${apiUrl}/tenants`;
  let response;

  try {
    response = await caller.call(fetch, url, {
      method: "GET",
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : undefined,
    });
  } catch (err) {
    throw new Error("Unable to get seeded tenant ID. Please manually provide.");
  }
  if (!response.ok) {
    throw new Error(
      `Failed to fetch seeded tenant ID: ${response.status} ${response.statusText}`
    );
  }
  const tenants = await response.json();
  if (!Array.isArray(tenants)) {
    throw new Error(
      `Expected tenants GET request to return an array, but got ${tenants}`
    );
  }
  if (tenants.length === 0) {
    throw new Error("No seeded tenant found");
  }

  return tenants[0].id;
};

const stringifyError = (err: Error | unknown): string => {
  let result: string;
  if (err == null) {
    result = "Error null or undefined";
  } else {
    const error = err as Error;
    result = `Error: ${error?.name}: ${error?.message}`;
  }
  return result;
};

export function isLLM(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): llm is BaseLLM {
  const blm = llm as BaseLanguageModel;
  return (
    typeof blm?._modelType === "function" && blm?._modelType() === "base_llm"
  );
}

export function isChatModel(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): llm is BaseChatModel {
  const blm = llm as BaseLanguageModel;
  return (
    typeof blm?._modelType === "function" &&
    blm?._modelType() === "base_chat_model"
  );
}

export async function isChain(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): Promise<boolean> {
  if (isLLM(llm)) {
    return false;
  }
  const bchFactory = llm as () => Promise<BaseChain>;
  const bch = await bchFactory();
  return (
    typeof bch?._chainType === "function" && bch?._chainType() !== undefined
  );
}

type _ModelType = "llm" | "chatModel" | "chainFactory";

async function getModelOrFactoryType(
  llm: BaseLanguageModel | (() => Promise<BaseChain>)
): Promise<_ModelType> {
  if (isLLM(llm)) {
    return "llm";
  }
  if (isChatModel(llm)) {
    return "chatModel";
  }
  const bchFactory = llm as () => Promise<BaseChain>;
  const bch = await bchFactory();
  if (typeof bch?._chainType === "function") {
    return "chainFactory";
  }
  throw new Error("Unknown model or factory type");
}

export class LangChainPlusClient {
  private apiKey?: string;

  private apiUrl: string;

  private tenantId: string;

  private caller: AsyncCaller;

  constructor(
    apiUrl: string,
    tenantId: string,
    apiKey?: string,
    callerOptions?: AsyncCallerParams
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.tenantId = tenantId;
    this.validateApiKeyIfHosted();
    this.caller = new AsyncCaller(callerOptions ?? {});
  }

  public static async create(
    apiUrl: string,
    apiKey: string | undefined = undefined
  ): Promise<LangChainPlusClient> {
    const tenantId = await getSeededTenantId(apiUrl, apiKey);
    return new LangChainPlusClient(apiUrl, tenantId, apiKey);
  }

  private validateApiKeyIfHosted(): void {
    const isLocal = isLocalhost(this.apiUrl);
    if (!isLocal && !this.apiKey) {
      throw new Error(
        "API key must be provided when using hosted LangChain+ API"
      );
    }
  }

  private get headers(): { [header: string]: string } {
    const headers: { [header: string]: string } = {};
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  private get queryParams(): URLSearchParams {
    return new URLSearchParams({ tenant_id: this.tenantId });
  }

  private async _get<T>(
    path: string,
    queryParams?: URLSearchParams
  ): Promise<T> {
    const params = this.queryParams;
    if (queryParams) {
      queryParams.forEach((value, key) => {
        params.append(key, value);
      });
    }
    const url = `${this.apiUrl}${path}?${params.toString()}`;
    const response = await this.caller.call(fetch, url, {
      method: "GET",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${path}: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as T;
  }

  public async readRun(runId: string): Promise<Run> {
    return await this._get<Run>(`/runs/${runId}`);
  }

  public async listRuns({
    sessionId,
    sessionName,
    executionOrder = 1,
    runType,
    error,
  }: ListRunsParams): Promise<Run[]> {
    const queryParams = new URLSearchParams();
    if (sessionId) {
      queryParams.append("session_id", sessionId);
    }
    if (sessionName) {
      queryParams.append("session_name", sessionName);
    }
    if (executionOrder) {
      queryParams.append("execution_order", executionOrder.toString());
    }
    if (runType) {
      queryParams.append("run_type", runType);
    }
    if (error) {
      queryParams.append("error", error.toString());
    }

    return this._get<Run[]>("/runs", queryParams);
  }

  public async readSession(
    sessionId?: string,
    sessionName?: string
  ): Promise<TracerSession> {
    let path = "/sessions";
    const params = new URLSearchParams();
    if (sessionId !== undefined && sessionName !== undefined) {
      throw new Error("Must provide either sessionName or sessionId, not both");
    } else if (sessionId !== undefined) {
      path += `/${sessionId}`;
    } else if (sessionName !== undefined) {
      params.append("name", sessionName);
    } else {
      throw new Error("Must provide sessionName or sessionId");
    }

    const response = await this._get<TracerSession | TracerSession[]>(
      path,
      params
    );
    let result: TracerSession;
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new Error(
          `Session[id=${sessionId}, name=${sessionName}] not found`
        );
      }
      result = response[0] as TracerSession;
    } else {
      result = response as TracerSession;
    }
    return result;
  }

  public async listSessions(): Promise<TracerSession[]> {
    return this._get<TracerSession[]>("/sessions");
  }

  public async uploadCsv({
    csvFile,
    fileName,
    inputKeys,
    outputKeys,
    description,
  }: UploadCSVParams): Promise<Dataset> {
    const url = `${this.apiUrl}/datasets/upload`;
    const formData = new FormData();
    formData.append("file", csvFile, fileName);
    formData.append("input_keys", inputKeys.join(","));
    formData.append("output_keys", outputKeys.join(","));
    formData.append("tenant_id", this.tenantId);
    if (description) {
      formData.append("description", description);
    }

    const response = await this.caller.call(fetch, url, {
      method: "POST",
      headers: this.headers,
      body: formData,
    });

    if (!response.ok) {
      const result = await response.json();
      if (result.detail && result.detail.includes("already exists")) {
        throw new Error(`Dataset ${fileName} already exists`);
      }
      throw new Error(
        `Failed to upload CSV: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result as Dataset;
  }

  public async createDataset(
    name: string,
    description: string
  ): Promise<Dataset> {
    const response = await this.caller.call(fetch, `${this.apiUrl}/datasets`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        tenant_id: this.tenantId,
      }),
    });

    if (!response.ok) {
      const result = await response.json();
      if (result.detail && result.detail.includes("already exists")) {
        throw new Error(`Dataset ${name} already exists`);
      }
      throw new Error(
        `Failed to create dataset ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result as Dataset;
  }

  public async readDataset(
    datasetId: string | undefined,
    datasetName: string | undefined
  ): Promise<Dataset> {
    let path = "/datasets";
    // limit to 1 result
    const params = new URLSearchParams({ limit: "1" });
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      path += `/${datasetId}`;
    } else if (datasetName !== undefined) {
      params.append("name", datasetName);
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const response = await this._get<Dataset | Dataset[]>(path, params);
    let result: Dataset;
    if (Array.isArray(response)) {
      if (response.length === 0) {
        throw new Error(
          `Dataset[id=${datasetId}, name=${datasetName}] not found`
        );
      }
      result = response[0] as Dataset;
    } else {
      result = response as Dataset;
    }
    return result;
  }

  public async listDatasets(limit = 100): Promise<Dataset[]> {
    const path = "/datasets";
    const params = new URLSearchParams({ limit: limit.toString() });
    const response = await this._get<Dataset[]>(path, params);
    if (!Array.isArray(response)) {
      throw new Error(
        `Expected ${path} to return an array, but got ${response}`
      );
    }
    return response as Dataset[];
  }

  public async deleteDataset(
    datasetId: string | undefined,
    datasetName: string | undefined
  ): Promise<Dataset> {
    let path = "/datasets";
    let datasetId_ = datasetId;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    }
    if (datasetId_ !== undefined) {
      path += `/${datasetId_}`;
    } else {
      throw new Error("Must provide datasetName or datasetId");
    }
    const response = await this.caller.call(fetch, this.apiUrl + path, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to delete ${path}: ${response.status} ${response.statusText}`
      );
    }
    const results = await response.json();
    return results as Dataset;
  }

  public async createExample(
    inputs: RunInputs,
    outputs: RunOutputs = {},
    datasetId: string | undefined = undefined,
    datasetName: string | undefined = undefined,
    createdAt: Date | undefined = undefined
  ): Promise<Example> {
    let datasetId_ = datasetId;
    if (datasetId_ === undefined && datasetName === undefined) {
      throw new Error("Must provide either datasetName or datasetId");
    } else if (datasetId_ !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId_ === undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    }

    const createdAt_ = createdAt || new Date();
    const data: ExampleCreate = {
      dataset_id: datasetId_,
      inputs,
      outputs,
      created_at: createdAt_.toISOString(),
    };

    const response = await this.caller.call(fetch, `${this.apiUrl}/examples`, {
      method: "POST",
      headers: { ...this.headers, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to create example: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    return result as Example;
  }

  public async readExample(exampleId: string): Promise<Example> {
    const path = `/examples/${exampleId}`;
    return await this._get<Example>(path);
  }

  public async listExamples(
    datasetId: string | undefined = undefined,
    datasetName: string | undefined = undefined
  ): Promise<Example[]> {
    let datasetId_;
    if (datasetId !== undefined && datasetName !== undefined) {
      throw new Error("Must provide either datasetName or datasetId, not both");
    } else if (datasetId !== undefined) {
      datasetId_ = datasetId;
    } else if (datasetName !== undefined) {
      const dataset = await this.readDataset(undefined, datasetName);
      datasetId_ = dataset.id;
    } else {
      throw new Error("Must provide a datasetName or datasetId");
    }
    const response = await this._get<Example[]>(
      "/examples",
      new URLSearchParams({ dataset_id: datasetId_ })
    );
    if (!Array.isArray(response)) {
      throw new Error(
        `Expected /examples to return an array, but got ${response}`
      );
    }
    return response as Example[];
  }

  public async deleteExample(exampleId: string): Promise<Example> {
    const path = `/examples/${exampleId}`;
    const response = await this.caller.call(fetch, this.apiUrl + path, {
      method: "DELETE",
      headers: this.headers,
    });
    if (!response.ok) {
      throw new Error(
        `Failed to delete ${path}: ${response.status} ${response.statusText}`
      );
    }
    const result = await response.json();
    return result as Example;
  }

  protected async runLLM(
    example: Example,
    tracer: LangChainTracer,
    llm: BaseLLM,
    numRepetitions = 1
  ): Promise<(LLMResult | string)[]> {
    const results: (LLMResult | string)[] = await Promise.all(
      Array.from({ length: numRepetitions }).map(async () => {
        try {
          const prompt = example.inputs.prompt as string;
          return llm.generate([prompt], undefined, [tracer]);
        } catch (e) {
          console.error(e);
          return stringifyError(e);
        }
      })
    );
    return results;
  }

  protected async runChain(
    example: Example,
    tracer: LangChainTracer,
    chainFactory: () => Promise<BaseChain>,
    numRepetitions = 1
  ): Promise<(ChainValues | string)[]> {
    const results: (ChainValues | string)[] = await Promise.all(
      Array.from({ length: numRepetitions }).map(async () => {
        try {
          const chain = await chainFactory();
          return chain.call(example.inputs, [tracer]);
        } catch (e) {
          console.error(e);
          return stringifyError(e);
        }
      })
    );
    return results;
  }

  protected async runChatModel(
    example: Example,
    tracer: LangChainTracer,
    chatModel: BaseChatModel,
    numRepetitions = 1
  ): Promise<(LLMResult | string)[]> {
    const results: (LLMResult | string)[] = await Promise.all(
      Array.from({ length: numRepetitions }).map(async () => {
        try {
          const messages = example.inputs.messages as StoredMessage[];
          return chatModel.generate(
            [mapStoredMessagesToChatMessages(messages)],
            undefined,
            [tracer]
          );
        } catch (e) {
          console.error(e);
          return stringifyError(e);
        }
      })
    );
    return results;
  }

  public async runOnDataset(
    datasetName: string,
    llmOrChainFactory: BaseLanguageModel | (() => Promise<BaseChain>),
    numRepetitions = 1,
    sessionName: string | undefined = undefined
  ): Promise<DatasetRunResults> {
    const examples = await this.listExamples(undefined, datasetName);
    let sessionName_: string;
    if (sessionName === undefined) {
      const currentTime = new Date().toISOString();
      sessionName_ = `${datasetName}-${llmOrChainFactory.constructor.name}-${currentTime}`;
    } else {
      sessionName_ = sessionName;
    }
    const results: DatasetRunResults = {};
    const modelOrFactoryType = await getModelOrFactoryType(llmOrChainFactory);
    await Promise.all(
      examples.map(async (example) => {
        const tracer = new LangChainTracer({
          exampleId: example.id,
          sessionName: sessionName_,
        });
        if (modelOrFactoryType === "llm") {
          const llm = llmOrChainFactory as BaseLLM;
          const llmResult = await this.runLLM(
            example,
            tracer,
            llm,
            numRepetitions
          );
          results[example.id] = llmResult;
        } else if (modelOrFactoryType === "chainFactory") {
          const chainFactory = llmOrChainFactory as () => Promise<BaseChain>;
          const chainResult = await this.runChain(
            example,
            tracer,
            chainFactory,
            numRepetitions
          );
          results[example.id] = chainResult;
        } else if (modelOrFactoryType === "chatModel") {
          const chatModel = llmOrChainFactory as BaseChatModel;
          const chatModelResult = await this.runChatModel(
            example,
            tracer,
            chatModel,
            numRepetitions
          );
          results[example.id] = chatModelResult;
        } else {
          throw new Error(` llm or chain type: ${llmOrChainFactory}`);
        }
      })
    );
    return results;
  }
}
