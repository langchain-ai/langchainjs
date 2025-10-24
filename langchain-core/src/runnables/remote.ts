import { Runnable, RunnableBatchOptions, _coerceToDict } from "./base.js";
import { getCallbackManagerForConfig, type RunnableConfig } from "./config.js";
import { Document } from "../documents/index.js";
import { CallbackManagerForChainRun } from "../callbacks/manager.js";
import { ChatPromptValue, StringPromptValue } from "../prompt_values.js";
import {
  RunLogPatch,
  type LogStreamCallbackHandlerInput,
  type StreamEvent,
  RunLog,
} from "../tracers/log_stream.js";
import {
  AIMessage,
  AIMessageChunk,
  ChatMessage,
  ChatMessageChunk,
  FunctionMessage,
  FunctionMessageChunk,
  HumanMessage,
  HumanMessageChunk,
  SystemMessage,
  SystemMessageChunk,
  ToolMessage,
  ToolMessageChunk,
  isBaseMessage,
} from "../messages/index.js";
import { GenerationChunk, ChatGenerationChunk, RUN_KEY } from "../outputs.js";
import { convertEventStreamToIterableReadableDataStream } from "../utils/event_source_parse.js";
import { IterableReadableStream, concat } from "../utils/stream.js";

type RemoteRunnableOptions = {
  timeout?: number;
  headers?: Record<string, unknown>;
};

function isSuperset(set: Set<string>, subset: Set<string>) {
  for (const elem of subset) {
    if (!set.has(elem)) {
      return false;
    }
  }
  return true;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function revive(obj: any): any {
  if (Array.isArray(obj)) return obj.map(revive);
  if (typeof obj === "object") {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!obj || obj instanceof Date) {
      return obj;
    }
    const keysArr = Object.keys(obj);
    const keys = new Set(keysArr);
    if (isSuperset(keys, new Set(["page_content", "metadata"]))) {
      return new Document({
        pageContent: obj.page_content,
        metadata: obj.metadata,
      });
    }

    if (isSuperset(keys, new Set(["content", "type", "additional_kwargs"]))) {
      if (obj.type === "HumanMessage" || obj.type === "human") {
        return new HumanMessage({
          content: obj.content,
        });
      }
      if (obj.type === "SystemMessage" || obj.type === "system") {
        return new SystemMessage({
          content: obj.content,
        });
      }
      if (obj.type === "ChatMessage" || obj.type === "generic") {
        return new ChatMessage({
          content: obj.content,
          role: obj.role,
        });
      }
      if (obj.type === "FunctionMessage" || obj.type === "function") {
        return new FunctionMessage({
          content: obj.content,
          name: obj.name,
        });
      }
      if (obj.type === "ToolMessage" || obj.type === "tool") {
        return new ToolMessage({
          content: obj.content,
          tool_call_id: obj.tool_call_id,
          status: obj.status,
          artifact: obj.artifact,
        });
      }
      if (obj.type === "AIMessage" || obj.type === "ai") {
        return new AIMessage({
          content: obj.content,
        });
      }
      if (obj.type === "HumanMessageChunk") {
        return new HumanMessageChunk({
          content: obj.content,
        });
      }
      if (obj.type === "SystemMessageChunk") {
        return new SystemMessageChunk({
          content: obj.content,
        });
      }
      if (obj.type === "ChatMessageChunk") {
        return new ChatMessageChunk({
          content: obj.content,
          role: obj.role,
        });
      }
      if (obj.type === "FunctionMessageChunk") {
        return new FunctionMessageChunk({
          content: obj.content,
          name: obj.name,
        });
      }
      if (obj.type === "ToolMessageChunk") {
        return new ToolMessageChunk({
          content: obj.content,
          tool_call_id: obj.tool_call_id,
          status: obj.status,
          artifact: obj.artifact,
        });
      }
      if (obj.type === "AIMessageChunk") {
        return new AIMessageChunk({
          content: obj.content,
        });
      }
    }
    if (isSuperset(keys, new Set(["text", "generation_info", "type"]))) {
      if (obj.type === "ChatGenerationChunk") {
        return new ChatGenerationChunk({
          message: revive(obj.message),
          text: obj.text,
          generationInfo: obj.generation_info,
        });
      } else if (obj.type === "ChatGeneration") {
        return {
          message: revive(obj.message),
          text: obj.text,
          generationInfo: obj.generation_info,
        };
      } else if (obj.type === "GenerationChunk") {
        return new GenerationChunk({
          text: obj.text,
          generationInfo: obj.generation_info,
        });
      } else if (obj.type === "Generation") {
        return {
          text: obj.text,
          generationInfo: obj.generation_info,
        };
      }
    }

    if (isSuperset(keys, new Set(["tool", "tool_input", "log", "type"]))) {
      if (obj.type === "AgentAction") {
        return {
          tool: obj.tool,
          toolInput: obj.tool_input,
          log: obj.log,
        };
      }
    }

    if (isSuperset(keys, new Set(["return_values", "log", "type"]))) {
      if (obj.type === "AgentFinish") {
        return {
          returnValues: obj.return_values,
          log: obj.log,
        };
      }
    }

    if (isSuperset(keys, new Set(["generations", "run", "type"]))) {
      if (obj.type === "LLMResult") {
        return {
          generations: revive(obj.generations),
          llmOutput: obj.llm_output,
          [RUN_KEY]: obj.run,
        };
      }
    }

    if (isSuperset(keys, new Set(["messages"]))) {
      // TODO: Start checking for type: ChatPromptValue and ChatPromptValueConcrete
      // when LangServe bug is fixed
      return new ChatPromptValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: obj.messages.map((msg: any) => revive(msg)),
      });
    }

    if (isSuperset(keys, new Set(["text"]))) {
      // TODO: Start checking for type: StringPromptValue
      // when LangServe bug is fixed
      return new StringPromptValue(obj.text);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerRevive: (key: string) => [string, any] = (key: string) => [
      key,
      revive(obj[key]),
    ];
    const rtn = Object.fromEntries(keysArr.map(innerRevive));
    return rtn;
  }
  return obj;
}
function deserialize<RunOutput>(str: string): RunOutput {
  const obj = JSON.parse(str);
  return revive(obj);
}

function removeCallbacksAndSignal(
  options?: RunnableConfig
): Omit<RunnableConfig, "callbacks" | "signal"> {
  const rest = { ...options };
  delete rest.callbacks;
  delete rest.signal;
  return rest;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize<RunInput>(input: RunInput): any {
  if (Array.isArray(input)) return input.map(serialize);
  if (isBaseMessage(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedMessage: Record<string, any> = {
      content: input.content,
      type: input._getType(),
      additional_kwargs: input.additional_kwargs,
      name: input.name,
      example: false,
    };
    if (ToolMessage.isInstance(input)) {
      serializedMessage.tool_call_id = input.tool_call_id;
    } else if (ChatMessage.isInstance(input)) {
      serializedMessage.role = input.role;
    }
    return serializedMessage;
  }
  if (typeof input === "object") {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (!input || input instanceof Date) {
      return input;
    }
    const keysArr = Object.keys(input);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerSerialize: (key: string) => [string, any] = (key: string) => [
      key,
      serialize((input as Record<string, unknown>)[key]),
    ];
    const rtn = Object.fromEntries(keysArr.map(innerSerialize));
    return rtn;
  }
  return input;
}

/**
 * Client for interacting with LangChain runnables
 * that are hosted as LangServe endpoints.
 *
 * Allows you to interact with hosted runnables using the standard
 * `.invoke()`, `.stream()`, `.streamEvents()`, etc. methods that
 * other runnables support.
 *
 * @deprecated LangServe is no longer actively developed - please consider using LangGraph Platform.
 *
 * @param url - The base URL of the LangServe endpoint.
 * @param options - Optional configuration for the remote runnable, including timeout and headers.
 * @param fetch - Optional custom fetch implementation.
 * @param fetchRequestOptions - Optional additional options for fetch requests.
 */
export class RemoteRunnable<
  RunInput,
  RunOutput,
  CallOptions extends RunnableConfig
> extends Runnable<RunInput, RunOutput, CallOptions> {
  private url: string;

  private options?: RemoteRunnableOptions;

  // Wrap the default fetch call due to issues with illegal invocations
  // from the browser:
  // https://stackoverflow.com/questions/69876859/why-does-bind-fix-failed-to-execute-fetch-on-window-illegal-invocation-err
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchImplementation: (...args: any[]) => any = (...args: any[]) =>
    // @ts-expect-error Broad typing to support a range of fetch implementations
    fetch(...args);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fetchRequestOptions?: Record<string, any>;

  lc_namespace = ["langchain", "schema", "runnable", "remote"];

  constructor(fields: {
    url: string;
    options?: RemoteRunnableOptions;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetch?: (...args: any[]) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fetchRequestOptions?: Record<string, any>;
  }) {
    super(fields);
    const {
      url,
      options,
      fetch: fetchImplementation,
      fetchRequestOptions,
    } = fields;

    this.url = url.replace(/\/$/, ""); // remove trailing slash
    this.options = options;
    this.fetchImplementation = fetchImplementation ?? this.fetchImplementation;
    this.fetchRequestOptions = fetchRequestOptions;
  }

  private async post<Body>(path: string, body: Body, signal?: AbortSignal) {
    return this.fetchImplementation(`${this.url}${path}`, {
      method: "POST",
      body: JSON.stringify(serialize(body)),
      signal: signal ?? AbortSignal.timeout(this.options?.timeout ?? 60000),
      ...this.fetchRequestOptions,
      headers: {
        "Content-Type": "application/json",
        ...this.fetchRequestOptions?.headers,
        ...this.options?.headers,
      },
    });
  }

  async _invoke(
    input: RunInput,
    options?: Partial<CallOptions>,
    _?: CallbackManagerForChainRun
  ) {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const response = await this.post<{
      input: RunInput;
      config?: RunnableConfig;
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
    }>(
      "/invoke",
      {
        input,
        config: removeCallbacksAndSignal(config),
        kwargs: kwargs ?? {},
      },
      config.signal
    );
    if (!response.ok) {
      throw new Error(`${response.status} Error: ${await response.text()}`);
    }
    return revive((await response.json()).output) as RunOutput;
  }

  async invoke(
    input: RunInput,
    options?: Partial<CallOptions>
  ): Promise<RunOutput> {
    return this._callWithConfig(this._invoke, input, options);
  }

  async _batch(
    inputs: RunInput[],
    options?: Partial<CallOptions>[],
    _?: (CallbackManagerForChainRun | undefined)[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("returnExceptions is not supported for remote clients");
    }
    const configsAndKwargsArray = options?.map((opts) =>
      this._separateRunnableConfigFromCallOptions(opts)
    );
    const [configs, kwargs] = configsAndKwargsArray?.reduce(
      ([pc, pk], [c, k]) =>
        [
          [...pc, c],
          [...pk, k],
        ] as [
          RunnableConfig[],
          Omit<Partial<CallOptions>, keyof RunnableConfig>[]
        ],
      [[], []] as [
        RunnableConfig[],
        Omit<Partial<CallOptions>, keyof RunnableConfig>[]
      ]
    ) ?? [undefined, undefined];
    const response = await this.post<{
      inputs: RunInput[];
      config?: (RunnableConfig & RunnableBatchOptions)[];
      kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>[];
    }>(
      "/batch",
      {
        inputs,
        config: (configs ?? [])
          .map(removeCallbacksAndSignal)
          .map((config) => ({ ...config, ...batchOptions })),
        kwargs,
      },
      options?.[0]?.signal
    );
    if (!response.ok) {
      throw new Error(`${response.status} Error: ${await response.text()}`);
    }
    const body = await response.json();

    if (!body.output) throw new Error("Invalid response from remote runnable");

    return revive(body.output);
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<CallOptions> | Partial<CallOptions>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw Error("returnExceptions is not supported for remote clients");
    }
    return this._batchWithConfig(
      this._batch.bind(this),
      inputs,
      options,
      batchOptions
    );
  }

  async *_streamIterator(
    input: RunInput,
    options?: Partial<CallOptions>
  ): AsyncGenerator<RunOutput> {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const callbackManager_ = await getCallbackManagerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      config.runId,
      undefined,
      undefined,
      undefined,
      config.runName
    );
    delete config.runId;
    let finalOutput: RunOutput | undefined;
    let finalOutputSupported = true;
    try {
      const response = await this.post<{
        input: RunInput;
        config?: RunnableConfig;
        kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
      }>(
        "/stream",
        {
          input,
          config: removeCallbacksAndSignal(config),
          kwargs,
        },
        config.signal
      );
      if (!response.ok) {
        const json = await response.json();
        const error = new Error(
          `RemoteRunnable call failed with status code ${response.status}: ${json.message}`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error as any).response = response;
        throw error;
      }
      const { body } = response;
      if (!body) {
        throw new Error(
          "Could not begin remote stream. Please check the given URL and try again."
        );
      }
      const runnableStream =
        convertEventStreamToIterableReadableDataStream(body);
      for await (const chunk of runnableStream) {
        const deserializedChunk = deserialize(chunk) as RunOutput;
        yield deserializedChunk;
        if (finalOutputSupported) {
          if (finalOutput === undefined) {
            finalOutput = deserializedChunk;
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              finalOutput = concat(finalOutput, deserializedChunk as any);
            } catch {
              finalOutput = undefined;
              finalOutputSupported = false;
            }
          }
        }
      }
    } catch (err) {
      await runManager?.handleChainError(err);
      throw err;
    }
    await runManager?.handleChainEnd(finalOutput ?? {});
  }

  async *streamLog(
    input: RunInput,
    options?: Partial<CallOptions>,
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): AsyncGenerator<RunLogPatch> {
    const [config, kwargs] =
      this._separateRunnableConfigFromCallOptions(options);
    const callbackManager_ = await getCallbackManagerForConfig(options);
    const runManager = await callbackManager_?.handleChainStart(
      this.toJSON(),
      _coerceToDict(input, "input"),
      config.runId,
      undefined,
      undefined,
      undefined,
      config.runName
    );
    delete config.runId;
    // The type is in camelCase but the API only accepts snake_case.
    const camelCaseStreamOptions = {
      include_names: streamOptions?.includeNames,
      include_types: streamOptions?.includeTypes,
      include_tags: streamOptions?.includeTags,
      exclude_names: streamOptions?.excludeNames,
      exclude_types: streamOptions?.excludeTypes,
      exclude_tags: streamOptions?.excludeTags,
    };
    let runLog;
    try {
      const response = await this.post<{
        input: RunInput;
        config?: RunnableConfig;
        kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
        diff: false;
      }>(
        "/stream_log",
        {
          input,
          config: removeCallbacksAndSignal(config),
          kwargs,
          ...camelCaseStreamOptions,
          diff: false,
        },
        config.signal
      );
      const { body, ok } = response;
      if (!ok) {
        throw new Error(`${response.status} Error: ${await response.text()}`);
      }
      if (!body) {
        throw new Error(
          "Could not begin remote stream log. Please check the given URL and try again."
        );
      }
      const runnableStream =
        convertEventStreamToIterableReadableDataStream(body);
      for await (const log of runnableStream) {
        const chunk = revive(JSON.parse(log));
        const logPatch = new RunLogPatch({ ops: chunk.ops });
        yield logPatch;
        if (runLog === undefined) {
          runLog = RunLog.fromRunLogPatch(logPatch);
        } else {
          runLog = runLog.concat(logPatch);
        }
      }
    } catch (err) {
      await runManager?.handleChainError(err);
      throw err;
    }
    await runManager?.handleChainEnd(runLog?.state.final_output);
  }

  _streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & { version: "v1" | "v2" },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose"> | undefined
  ): AsyncGenerator<StreamEvent> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const outerThis = this;
    const generator = async function* () {
      const [config, kwargs] =
        outerThis._separateRunnableConfigFromCallOptions(options);
      const callbackManager_ = await getCallbackManagerForConfig(options);
      const runManager = await callbackManager_?.handleChainStart(
        outerThis.toJSON(),
        _coerceToDict(input, "input"),
        config.runId,
        undefined,
        undefined,
        undefined,
        config.runName
      );
      delete config.runId;
      // The type is in camelCase but the API only accepts snake_case.
      const camelCaseStreamOptions = {
        include_names: streamOptions?.includeNames,
        include_types: streamOptions?.includeTypes,
        include_tags: streamOptions?.includeTags,
        exclude_names: streamOptions?.excludeNames,
        exclude_types: streamOptions?.excludeTypes,
        exclude_tags: streamOptions?.excludeTags,
      };
      const events = [];
      try {
        const response = await outerThis.post<{
          input: RunInput;
          config?: RunnableConfig;
          kwargs?: Omit<Partial<CallOptions>, keyof RunnableConfig>;
          diff: false;
        }>(
          "/stream_events",
          {
            input,
            config: removeCallbacksAndSignal(config),
            kwargs,
            ...camelCaseStreamOptions,
            diff: false,
          },
          config.signal
        );
        const { body, ok } = response;
        if (!ok) {
          throw new Error(`${response.status} Error: ${await response.text()}`);
        }
        if (!body) {
          throw new Error(
            "Could not begin remote stream events. Please check the given URL and try again."
          );
        }
        const runnableStream =
          convertEventStreamToIterableReadableDataStream(body);
        for await (const log of runnableStream) {
          const chunk = revive(JSON.parse(log));
          const event = {
            event: chunk.event,
            name: chunk.name,
            run_id: chunk.run_id,
            tags: chunk.tags,
            metadata: chunk.metadata,
            data: chunk.data,
          };
          yield event;
          events.push(event);
        }
      } catch (err) {
        await runManager?.handleChainError(err);
        throw err;
      }
      await runManager?.handleChainEnd(events);
    };
    return generator();
  }

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & { version: "v1" | "v2" },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<StreamEvent>;

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & {
      version: "v1" | "v2";
      encoding: "text/event-stream";
    },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<Uint8Array>;

  streamEvents(
    input: RunInput,
    options: Partial<CallOptions> & {
      version: "v1" | "v2";
      encoding?: "text/event-stream" | undefined;
    },
    streamOptions?: Omit<LogStreamCallbackHandlerInput, "autoClose">
  ): IterableReadableStream<StreamEvent | Uint8Array> {
    if (options.version !== "v1" && options.version !== "v2") {
      throw new Error(
        `Only versions "v1" and "v2" of the events schema is currently supported.`
      );
    }
    if (options.encoding !== undefined) {
      throw new Error("Special encodings are not supported for this runnable.");
    }
    const eventStream = this._streamEvents(input, options, streamOptions);
    return IterableReadableStream.fromAsyncGenerator(eventStream);
  }
}
