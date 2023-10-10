import { Runnable, RunnableBatchOptions } from "./base.js";
import { RunnableConfig } from "./config.js";
import { IterableReadableStream } from "../../util/stream.js";
import { CallbackManagerForChainRun } from "../../callbacks/manager.js";
import {
  getBytes,
  getLines,
  getMessages,
} from "../../util/event-source-parse.js";
import { Document } from "../../document.js";
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
} from "../index.js";
import { StringPromptValue } from "../../prompts/base.js";
import { ChatPromptValue } from "../../prompts/chat.js";

type RemoteRunnableOptions = {
  timeout?: number;
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
  if (obj === null) return null;
  if (Array.isArray(obj)) return obj.map(revive);
  if (typeof obj === "object") {
    const keysArr = Object.keys(obj);
    const keys = new Set(keysArr);
    if (isSuperset(keys, new Set(["page_content", "metadata"])))
      return new Document({
        pageContent: obj.page_content,
        metadata: obj.metadata,
      });
    //content, type
    if (isSuperset(keys, new Set(["content", "type", "is_chunk"]))) {
      if (!obj.is_chunk) {
        if (obj.type === "human") {
          return new HumanMessage({
            content: obj.content,
          });
        }
        if (obj.type === "system") {
          return new SystemMessage({
            content: obj.content,
          });
        }
        if (obj.type === "chat") {
          return new ChatMessage({
            content: obj.content,
            role: obj.role,
          });
        }
        if (obj.type === "function") {
          return new FunctionMessage({
            content: obj.content,
            name: obj.name,
          });
        }
        if (obj.type === "ai") {
          return new AIMessage({
            content: obj.content,
          });
        }
      } else {
        if (obj.type === "human") {
          return new HumanMessageChunk({
            content: obj.content,
          });
        }
        if (obj.type === "system") {
          return new SystemMessageChunk({
            content: obj.content,
          });
        }
        if (obj.type === "chat") {
          return new ChatMessageChunk({
            content: obj.content,
            role: obj.role,
          });
        }
        if (obj.type === "function") {
          return new FunctionMessageChunk({
            content: obj.content,
            name: obj.name,
          });
        }
        if (obj.type === "ai") {
          return new AIMessageChunk({
            content: obj.content,
          });
        }
      }
    }
    if (isSuperset(keys, new Set(["text"]))) {
      return new StringPromptValue(obj.text);
    }
    if (isSuperset(keys, new Set(["messages"]))) {
      return new ChatPromptValue({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: obj.messages.map((msg: any) => revive(msg)),
      });
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

function withoutCallbacks(
  options?: RunnableConfig
): Omit<RunnableConfig, "callbacks"> {
  const { callbacks, ...rest } = options ?? {};
  return rest;
}

export class RemoteRunnable<RunInput, RunOutput> extends Runnable<
  RunInput,
  RunOutput
> {
  private url: string;
  private options?: RemoteRunnableOptions;

  lc_namespace = ["langchain", "schema", "runnable", "remote"];

  constructor(url: string, options?: RemoteRunnableOptions) {
    super();
    this.url = url.replace(/\/$/, ""); // remove trailing slash
    this.options = options;
  }

  private async post<Body>(path: string, body: Body) {
    return await fetch(`${this.url}${path}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(this.options?.timeout ?? 5000),
    });
  }

  async invoke(input: RunInput, options?: RunnableConfig): Promise<RunOutput> {
    const response = await this.post<{
      input: RunInput;
      config: RunnableConfig;
      kwargs: {};
    }>("/invoke", {
      input,
      config: withoutCallbacks(options),
      kwargs: {},
    });
    return revive((await response.json()).output) as RunOutput;
  }

  async _batch(
    inputs: RunInput[],
    configs?: RunnableConfig[],
    _?: (CallbackManagerForChainRun | undefined)[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]> {
    if (batchOptions?.returnExceptions) {
      throw new Error("returnExceptions is not supported for remote clients");
    }
    const response = await this.post<{
      inputs: RunInput[];
      config: (RunnableConfig & RunnableBatchOptions)[];
      kwargs: {};
    }>("/batch", {
      inputs,
      config:
        configs ??
        []
          .map(withoutCallbacks)
          .map((config) => ({ ...config, ...batchOptions })),
      kwargs: {},
    });
    const body = await response.json();

    if (!body.output) throw new Error("Invalid response from remote runnable");

    return revive(body.output);
  }

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions?: false }
  ): Promise<RunOutput[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions & { returnExceptions: true }
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
    batchOptions?: RunnableBatchOptions
  ): Promise<(RunOutput | Error)[]>;

  async batch(
    inputs: RunInput[],
    options?: Partial<RunnableConfig> | Partial<RunnableConfig>[],
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

  async stream(
    input: RunInput,
    options?: RunnableConfig
  ): Promise<IterableReadableStream<RunOutput>> {
    const response = await this.post<{
      input: RunInput;
      options: RunnableConfig;
    }>("/stream", {
      input,
      options: options ?? {},
    });
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
        "Could not begin LangServe stream. Please check the given URL and try again."
      );
    }
    const stream = new ReadableStream({
      start(controller) {
        const enqueueLine = getMessages((msg) => {
          if (msg.data) controller.enqueue(deserialize(msg.data));
        });
        const onLine = (
          line: Uint8Array,
          fieldLength: number,
          flush?: boolean
        ) => {
          enqueueLine(line, fieldLength, flush);
          if (flush) controller.close();
        };
        getBytes(body, getLines(onLine));
      },
    });
    return IterableReadableStream.fromReadableStream(stream);
  }
}
