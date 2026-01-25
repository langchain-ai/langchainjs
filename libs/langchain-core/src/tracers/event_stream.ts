import { BaseTracer, type Run } from "./base.js";
import {
  BaseCallbackHandler,
  BaseCallbackHandlerInput,
  CallbackHandlerPrefersStreaming,
} from "../callbacks/base.js";
import { IterableReadableStream } from "../utils/stream.js";
import { AIMessageChunk } from "../messages/ai.js";
import { ChatGeneration, Generation, GenerationChunk } from "../outputs.js";
import { BaseMessage } from "../messages/base.js";

/**
 * Data associated with a StreamEvent.
 */
export type StreamEventData = {
  /**
   * The input passed to the runnable that generated the event.
   * Inputs will sometimes be available at the *START* of the runnable, and
   * sometimes at the *END* of the runnable.
   * If a runnable is able to stream its inputs, then its input by definition
   * won't be known until the *END* of the runnable when it has finished streaming
   * its inputs.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input?: any;

  /**
   * The output of the runnable that generated the event.
   * Outputs will only be available at the *END* of the runnable.
   * For most runnables, this field can be inferred from the `chunk` field,
   * though there might be some exceptions for special cased runnables (e.g., like
   * chat models), which may return more information.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  output?: any;

  /**
   * A streaming chunk from the output that generated the event.
   * chunks support addition in general, and adding them up should result
   * in the output of the runnable that generated the event.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunk?: any;

  /**
   * Error message if the runnable that generated the event failed.
   * This field will only be present if the runnable failed.
   */
  error?: string;
};

/**
 * A streaming event.
 *
 * Schema of a streaming event which is produced from the streamEvents method.
 */
export type StreamEvent = {
  /**
   * Event names are of the format: on_[runnable_type]_(start|stream|end).
   *
   * Runnable types are one of:
   * - llm - used by non chat models
   * - chat_model - used by chat models
   * - prompt --  e.g., ChatPromptTemplate
   * - tool -- LangChain tools
   * - chain - most Runnables are of this type
   *
   * Further, the events are categorized as one of:
   * - start - when the runnable starts
   * - stream - when the runnable is streaming
   * - end - when the runnable ends
   *
   * start, stream and end are associated with slightly different `data` payload.
   *
   * Please see the documentation for `EventData` for more details.
   */
  event: string;
  /** The name of the runnable that generated the event. */
  name: string;
  /**
   * An randomly generated ID to keep track of the execution of the given runnable.
   *
   * Each child runnable that gets invoked as part of the execution of a parent runnable
   * is assigned its own unique ID.
   */
  run_id: string;
  /**
   * Tags associated with the runnable that generated this event.
   * Tags are always inherited from parent runnables.
   */
  tags?: string[];
  /** Metadata associated with the runnable that generated this event. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  /**
   * Event data.
   *
   * The contents of the event data depend on the event type.
   */
  data: StreamEventData;
};

type RunInfo = {
  name: string;
  tags: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  runType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: Record<string, any>;
};

export interface EventStreamCallbackHandlerInput
  extends BaseCallbackHandlerInput {
  autoClose?: boolean;
  includeNames?: string[];
  includeTypes?: string[];
  includeTags?: string[];
  excludeNames?: string[];
  excludeTypes?: string[];
  excludeTags?: string[];
}

function assignName({
  name,
  serialized,
}: {
  name?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serialized?: Record<string, any>;
}): string {
  if (name !== undefined) {
    return name;
  }
  if (serialized?.name !== undefined) {
    return serialized.name;
  } else if (serialized?.id !== undefined && Array.isArray(serialized?.id)) {
    return serialized.id[serialized.id.length - 1];
  }
  return "Unnamed";
}

export const isStreamEventsHandler = (
  handler: BaseCallbackHandler
): handler is EventStreamCallbackHandler =>
  handler.name === "event_stream_tracer";

/**
 * Class that extends the `BaseTracer` class from the
 * `langchain.callbacks.tracers.base` module. It represents a callback
 * handler that logs the execution of runs and emits `RunLog` instances to a
 * `RunLogStream`.
 */
export class EventStreamCallbackHandler
  extends BaseTracer
  implements CallbackHandlerPrefersStreaming
{
  protected autoClose = true;

  protected includeNames?: string[];

  protected includeTypes?: string[];

  protected includeTags?: string[];

  protected excludeNames?: string[];

  protected excludeTypes?: string[];

  protected excludeTags?: string[];

  private runInfoMap: Map<string, RunInfo> = new Map();

  private tappedPromises: Map<string, Promise<void>> = new Map();

  protected transformStream: TransformStream;

  public writer: WritableStreamDefaultWriter;

  public receiveStream: IterableReadableStream<StreamEvent>;

  private readableStreamClosed = false;

  name = "event_stream_tracer";

  lc_prefer_streaming = true;

  constructor(fields?: EventStreamCallbackHandlerInput) {
    super({ _awaitHandler: true, ...fields });
    this.autoClose = fields?.autoClose ?? true;
    this.includeNames = fields?.includeNames;
    this.includeTypes = fields?.includeTypes;
    this.includeTags = fields?.includeTags;
    this.excludeNames = fields?.excludeNames;
    this.excludeTypes = fields?.excludeTypes;
    this.excludeTags = fields?.excludeTags;
    this.transformStream = new TransformStream({
      flush: () => {
        this.readableStreamClosed = true;
      },
    });
    this.writer = this.transformStream.writable.getWriter();
    this.receiveStream = IterableReadableStream.fromReadableStream(
      this.transformStream.readable
    );
  }

  [Symbol.asyncIterator]() {
    return this.receiveStream;
  }

  protected async persistRun(_run: Run): Promise<void> {
    // This is a legacy method only called once for an entire run tree
    // and is therefore not useful here
  }

  _includeRun(run: RunInfo): boolean {
    const runTags = run.tags ?? [];
    let include =
      this.includeNames === undefined &&
      this.includeTags === undefined &&
      this.includeTypes === undefined;
    if (this.includeNames !== undefined) {
      include = include || this.includeNames.includes(run.name);
    }
    if (this.includeTypes !== undefined) {
      include = include || this.includeTypes.includes(run.runType);
    }
    if (this.includeTags !== undefined) {
      include =
        include ||
        runTags.find((tag) => this.includeTags?.includes(tag)) !== undefined;
    }
    if (this.excludeNames !== undefined) {
      include = include && !this.excludeNames.includes(run.name);
    }
    if (this.excludeTypes !== undefined) {
      include = include && !this.excludeTypes.includes(run.runType);
    }
    if (this.excludeTags !== undefined) {
      include =
        include && runTags.every((tag) => !this.excludeTags?.includes(tag));
    }
    return include;
  }

  async *tapOutputIterable<T>(
    runId: string,
    outputStream: AsyncGenerator<T>
  ): AsyncGenerator<T> {
    const firstChunk = await outputStream.next();
    if (firstChunk.done) {
      return;
    }
    const runInfo = this.runInfoMap.get(runId);
    // Run has finished, don't issue any stream events.
    // An example of this is for runnables that use the default
    // implementation of .stream(), which delegates to .invoke()
    // and calls .onChainEnd() before passing it to the iterator.
    if (runInfo === undefined) {
      yield firstChunk.value;
      return;
    }
    // Match format from handlers below
    function _formatOutputChunk(eventType: string, data: unknown) {
      if (eventType === "llm" && typeof data === "string") {
        return new GenerationChunk({ text: data });
      }
      return data;
    }
    let tappedPromise = this.tappedPromises.get(runId);
    // if we are the first to tap, issue stream events
    if (tappedPromise === undefined) {
      let tappedPromiseResolver: (() => void) | undefined;
      tappedPromise = new Promise((resolve) => {
        tappedPromiseResolver = resolve;
      });
      this.tappedPromises.set(runId, tappedPromise);
      try {
        const event: StreamEvent = {
          event: `on_${runInfo.runType}_stream`,
          run_id: runId,
          name: runInfo.name,
          tags: runInfo.tags,
          metadata: runInfo.metadata,
          data: {},
        };
        await this.send(
          {
            ...event,
            data: {
              chunk: _formatOutputChunk(runInfo.runType, firstChunk.value),
            },
          },
          runInfo
        );
        yield firstChunk.value;
        for await (const chunk of outputStream) {
          // Don't yield tool and retriever stream events
          if (runInfo.runType !== "tool" && runInfo.runType !== "retriever") {
            await this.send(
              {
                ...event,
                data: {
                  chunk: _formatOutputChunk(runInfo.runType, chunk),
                },
              },
              runInfo
            );
          }
          yield chunk;
        }
      } finally {
        tappedPromiseResolver?.();
        // Don't delete from the promises map to keep track of which runs have been tapped.
      }
    } else {
      // otherwise just pass through
      yield firstChunk.value;
      for await (const chunk of outputStream) {
        yield chunk;
      }
    }
  }

  async send(payload: StreamEvent, run: RunInfo) {
    if (this.readableStreamClosed) return;
    if (this._includeRun(run)) {
      await this.writer.write(payload);
    }
  }

  async sendEndEvent(payload: StreamEvent, run: RunInfo) {
    const tappedPromise = this.tappedPromises.get(payload.run_id);
    if (tappedPromise !== undefined) {
      // eslint-disable-next-line no-void
      void tappedPromise.then(() => {
        // eslint-disable-next-line no-void
        void this.send(payload, run);
      });
    } else {
      await this.send(payload, run);
    }
  }

  async onLLMStart(run: Run): Promise<void> {
    const runName = assignName(run);
    const runType = run.inputs.messages !== undefined ? "chat_model" : "llm";
    const runInfo = {
      tags: run.tags ?? [],
      metadata: run.extra?.metadata ?? {},
      name: runName,
      runType,
      inputs: run.inputs,
    };
    this.runInfoMap.set(run.id, runInfo);
    const eventName = `on_${runType}_start`;
    await this.send(
      {
        event: eventName,
        data: {
          input: run.inputs,
        },
        name: runName,
        tags: run.tags ?? [],
        run_id: run.id,
        metadata: run.extra?.metadata ?? {},
      },
      runInfo
    );
  }

  async onLLMNewToken(
    run: Run,
    token: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kwargs?: { chunk: any }
  ): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    let chunk;
    let eventName;
    if (runInfo === undefined) {
      throw new Error(`onLLMNewToken: Run ID ${run.id} not found in run map.`);
    }
    // Top-level streaming events are covered by tapOutputIterable
    if (this.runInfoMap.size === 1) {
      return;
    }
    if (runInfo.runType === "chat_model") {
      eventName = "on_chat_model_stream";
      if (kwargs?.chunk === undefined) {
        chunk = new AIMessageChunk({ content: token, id: `run-${run.id}` });
      } else {
        chunk = kwargs.chunk.message;
      }
    } else if (runInfo.runType === "llm") {
      eventName = "on_llm_stream";
      if (kwargs?.chunk === undefined) {
        chunk = new GenerationChunk({ text: token });
      } else {
        chunk = kwargs.chunk;
      }
    } else {
      throw new Error(`Unexpected run type ${runInfo.runType}`);
    }
    await this.send(
      {
        event: eventName,
        data: {
          chunk,
        },
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
      },
      runInfo
    );
  }

  async onLLMEnd(run: Run): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    this.runInfoMap.delete(run.id);
    let eventName: string;
    if (runInfo === undefined) {
      throw new Error(`onLLMEnd: Run ID ${run.id} not found in run map.`);
    }
    const generations: ChatGeneration[][] | Generation[][] | undefined =
      run.outputs?.generations;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let output: BaseMessage | Record<string, any> | undefined;
    if (runInfo.runType === "chat_model") {
      for (const generation of generations ?? []) {
        if (output !== undefined) {
          break;
        }
        output = (generation[0] as ChatGeneration | undefined)?.message;
      }
      eventName = "on_chat_model_end";
    } else if (runInfo.runType === "llm") {
      output = {
        generations: generations?.map((generation) => {
          return generation.map((chunk) => {
            return {
              text: chunk.text,
              generationInfo: chunk.generationInfo,
            };
          });
        }),
        llmOutput: run.outputs?.llmOutput ?? {},
      };
      eventName = "on_llm_end";
    } else {
      throw new Error(`onLLMEnd: Unexpected run type: ${runInfo.runType}`);
    }
    await this.sendEndEvent(
      {
        event: eventName,
        data: {
          output,
          input: runInfo.inputs,
        },
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
      },
      runInfo
    );
  }

  async onChainStart(run: Run): Promise<void> {
    const runName = assignName(run);
    const runType = run.run_type ?? "chain";
    const runInfo: RunInfo = {
      tags: run.tags ?? [],
      metadata: run.extra?.metadata ?? {},
      name: runName,
      runType: run.run_type,
    };
    let eventData: StreamEventData = {};
    // Workaround Runnable core code not sending input when transform streaming.
    if (run.inputs.input === "" && Object.keys(run.inputs).length === 1) {
      eventData = {};
      runInfo.inputs = {};
    } else if (run.inputs.input !== undefined) {
      eventData.input = run.inputs.input;
      runInfo.inputs = run.inputs.input;
    } else {
      eventData.input = run.inputs;
      runInfo.inputs = run.inputs;
    }
    this.runInfoMap.set(run.id, runInfo);
    await this.send(
      {
        event: `on_${runType}_start`,
        data: eventData,
        name: runName,
        tags: run.tags ?? [],
        run_id: run.id,
        metadata: run.extra?.metadata ?? {},
      },
      runInfo
    );
  }

  async onChainEnd(run: Run): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    this.runInfoMap.delete(run.id);
    if (runInfo === undefined) {
      throw new Error(`onChainEnd: Run ID ${run.id} not found in run map.`);
    }
    const eventName = `on_${run.run_type}_end`;
    const inputs = run.inputs ?? runInfo.inputs ?? {};
    const outputs = run.outputs?.output ?? run.outputs;
    const data: StreamEventData = {
      output: outputs,
      input: inputs,
    };
    if (inputs.input && Object.keys(inputs).length === 1) {
      data.input = inputs.input;
      runInfo.inputs = inputs.input;
    }
    await this.sendEndEvent(
      {
        event: eventName,
        data,
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata ?? {},
      },
      runInfo
    );
  }

  async onToolStart(run: Run): Promise<void> {
    const runName = assignName(run);
    const runInfo = {
      tags: run.tags ?? [],
      metadata: run.extra?.metadata ?? {},
      name: runName,
      runType: "tool",
      inputs: run.inputs ?? {},
    };
    this.runInfoMap.set(run.id, runInfo);
    await this.send(
      {
        event: "on_tool_start",
        data: {
          input: run.inputs ?? {},
        },
        name: runName,
        run_id: run.id,
        tags: run.tags ?? [],
        metadata: run.extra?.metadata ?? {},
      },
      runInfo
    );
  }

  async onToolEnd(run: Run): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    this.runInfoMap.delete(run.id);
    if (runInfo === undefined) {
      throw new Error(`onToolEnd: Run ID ${run.id} not found in run map.`);
    }
    if (runInfo.inputs === undefined) {
      throw new Error(
        `onToolEnd: Run ID ${run.id} is a tool call, and is expected to have traced inputs.`
      );
    }
    const output =
      run.outputs?.output === undefined ? run.outputs : run.outputs.output;
    await this.sendEndEvent(
      {
        event: "on_tool_end",
        data: {
          output,
          input: runInfo.inputs,
        },
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
      },
      runInfo
    );
  }

  async onToolError(run: Run): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    this.runInfoMap.delete(run.id);
    if (runInfo === undefined) {
      throw new Error(`onToolEnd: Run ID ${run.id} not found in run map.`);
    }
    if (runInfo.inputs === undefined) {
      throw new Error(
        `onToolEnd: Run ID ${run.id} is a tool call, and is expected to have traced inputs.`
      );
    }

    await this.sendEndEvent(
      {
        event: "on_tool_error",
        data: {
          input: runInfo.inputs,
          error: run.error,
        },
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
      },
      runInfo
    );
  }

  async onRetrieverStart(run: Run): Promise<void> {
    const runName = assignName(run);
    const runType = "retriever";
    const runInfo = {
      tags: run.tags ?? [],
      metadata: run.extra?.metadata ?? {},
      name: runName,
      runType,
      inputs: {
        query: run.inputs.query,
      },
    };
    this.runInfoMap.set(run.id, runInfo);
    await this.send(
      {
        event: "on_retriever_start",
        data: {
          input: {
            query: run.inputs.query,
          },
        },
        name: runName,
        tags: run.tags ?? [],
        run_id: run.id,
        metadata: run.extra?.metadata ?? {},
      },
      runInfo
    );
  }

  async onRetrieverEnd(run: Run): Promise<void> {
    const runInfo = this.runInfoMap.get(run.id);
    this.runInfoMap.delete(run.id);
    if (runInfo === undefined) {
      throw new Error(`onRetrieverEnd: Run ID ${run.id} not found in run map.`);
    }
    await this.sendEndEvent(
      {
        event: "on_retriever_end",
        data: {
          output: run.outputs?.documents ?? run.outputs,
          input: runInfo.inputs,
        },
        run_id: run.id,
        name: runInfo.name,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
      },
      runInfo
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async handleCustomEvent(eventName: string, data: any, runId: string) {
    const runInfo = this.runInfoMap.get(runId);
    if (runInfo === undefined) {
      throw new Error(
        `handleCustomEvent: Run ID ${runId} not found in run map.`
      );
    }
    await this.send(
      {
        event: "on_custom_event",
        run_id: runId,
        name: eventName,
        tags: runInfo.tags,
        metadata: runInfo.metadata,
        data,
      },
      runInfo
    );
  }

  async finish() {
    const pendingPromises = [...this.tappedPromises.values()];
    // eslint-disable-next-line no-void
    void Promise.all(pendingPromises).finally(() => {
      // eslint-disable-next-line no-void
      void this.writer.close();
    });
  }
}
