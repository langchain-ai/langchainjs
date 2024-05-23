import { BaseTracer, type Run } from "./base.js";
import {
  BaseCallbackHandlerInput,
  HandleLLMNewTokenCallbackFields,
} from "../callbacks/base.js";
import { IterableReadableStream } from "../utils/stream.js";
import { ChatGenerationChunk, GenerationChunk } from "../outputs.js";
import { AIMessageChunk, BaseMessage } from "../messages/index.js";
import { KVMap } from "langsmith/schemas";
import { Serialized } from "../load/serializable.js";

/**
 * Interface that represents the structure of a log entry in the
 * `EventStreamCallbackHandler`.
 */
type LogEntry = {
  /** ID of the sub-run. */
  id: string;
  /** Name of the object being run. */
  name: string;
  /** Type of the object being run, eg. prompt, chain, llm, etc. */
  type: string;
  /** List of tags for the run. */
  tags: string[];
  /** Key-value pairs of metadata for the run. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  /** ISO-8601 timestamp of when the run started. */
  start_time: string;
  /** List of general output chunks streamed by this run. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streamed_output: any[];
  /** List of LLM tokens streamed by this run, if applicable. */
  streamed_output_str: string[];
  /** Inputs to this run. Not available currently via streamLog. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inputs?: any;
  /** Final output of this run. Only available after the run has finished successfully. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  final_output?: any;
  /** ISO-8601 timestamp of when the run ended. Only available after the run has finished. */
  end_time?: string;
};

type RunState = {
  /** ID of the sub-run. */
  id: string;
  /** List of output chunks streamed by Runnable.stream() */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  streamed_output: any[];
  /** Final output of the run, usually the result of aggregating streamed_output. Only available after the run has finished successfully. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  final_output?: any;
  /**
   * List of sub-runs contained in this run, if any, in the order they were started.
   * If filters were supplied, this list will contain only the runs that matched the filters.
   */
  logs: Record<string, LogEntry>;
  /** Name of the object being run. */
  name: string;
  /** Type of the object being run, eg. prompt, chain, llm, etc. */
  type: string;
};

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
   * - tool -- from tools defined via @tool decorator or inheriting from Tool/BaseTool
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: StreamEventData;
};

type RunInfo = {
  name: string;
  tags: string[];
  metadata: Record<string, any>;
  runType: string;
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

function isChatGenerationChunk(
  x?: ChatGenerationChunk | GenerationChunk
): x is ChatGenerationChunk {
  return x !== undefined && (x as ChatGenerationChunk).message !== undefined;
}


function assignName({ name, serialized }: { name?: string, serialized?: Record<string, any> }): string {
  if (name !== undefined) {
    return name;
  }
  if (serialized?.name !== undefined) {
    return serialized.name;
  } else if (Array.isArray(serialized?.id)) {
    return serialized.id[serialized.id.length - 1];
  }
  return "Unnamed";
}
/**
 * Class that extends the `BaseTracer` class from the
 * `langchain.callbacks.tracers.base` module. It represents a callback
 * handler that logs the execution of runs and emits `RunLog` instances to a
 * `RunLogStream`.
 */
export class EventStreamCallbackHandler extends BaseTracer {
  protected autoClose = true;

  protected includeNames?: string[];

  protected includeTypes?: string[];

  protected includeTags?: string[];

  protected excludeNames?: string[];

  protected excludeTypes?: string[];

  protected excludeTags?: string[];

  protected rootId?: string;

  private keyMapByRunId: Record<string, string> = {};

  private counterMapByRunName: Record<string, number> = {};
  
  private runInfoMap: Map<string, RunInfo> = new Map();

  protected transformStream: TransformStream;

  public writer: WritableStreamDefaultWriter;

  public receiveStream: IterableReadableStream<StreamEvent>;

  name = "log_stream_tracer";

  constructor(fields?: EventStreamCallbackHandlerInput) {
    super({ _awaitHandler: true, ...fields });
    this.autoClose = fields?.autoClose ?? true;
    this.includeNames = fields?.includeNames;
    this.includeTypes = fields?.includeTypes;
    this.includeTags = fields?.includeTags;
    this.excludeNames = fields?.excludeNames;
    this.excludeTypes = fields?.excludeTypes;
    this.excludeTags = fields?.excludeTags;
    this.transformStream = new TransformStream();
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

  _includeRun(run: Run): boolean {
    if (run.id === this.rootId) {
      return false;
    }
    const runTags = run.tags ?? [];
    let include =
      this.includeNames === undefined &&
      this.includeTags === undefined &&
      this.includeTypes === undefined;
    if (this.includeNames !== undefined) {
      include = include || this.includeNames.includes(run.name);
    }
    if (this.includeTypes !== undefined) {
      include = include || this.includeTypes.includes(run.run_type);
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
      include = include && !this.excludeTypes.includes(run.run_type);
    }
    if (this.excludeTags !== undefined) {
      include =
        include && runTags.every((tag) => !this.excludeTags?.includes(tag));
    }
    return include;
  }

  async *tapOutputIterable<T>(
    runId: string,
    output: AsyncGenerator<T>
  ): AsyncGenerator<T> {
    const runInfo = this.runMap.get(runId);
    if (runInfo === undefined) {
      return;
    }
    // Tap an output async iterator to stream its values to the log.
    for await (const chunk of output) {
      // await this.writer.write({
      //   event: StreamEvent = {
      //     "event": f"on_{run_info['run_type']}_stream",
      //     "run_id": str(run_id),
      //     "name": run_info["name"],
      //     "tags": run_info["tags"],
      //     "metadata": run_info["metadata"],
      //     "data": {},
      // }
      // // });
      // event: StreamEvent = {
      //     "event": f"on_{run_info['run_type']}_stream",
      //     "run_id": str(run_id),
      //     "name": run_info["name"],
      //     "tags": run_info["tags"],
      //     "metadata": run_info["metadata"],
      //     "data": {},
      // }
      // self._send({**event, "data": {"chunk": first}}, run_info["run_type"])
      if (this._includeRun(runInfo)) {
        await this.writer.write({
          
        })
      }
      yield chunk;
    }
  }
  
  async send(payload: StreamEvent, run: Run) {
    if (this._includeRun(run)) {
      await this.writer.write(payload);
    }
  }

  async onLLMStart(run: Run): Promise<void> {
    const runName = assignName({ name: run.name, serialized: run.serialized });
    const runType = run.inputs.messages !== undefined ? "chat_model" : "llm"
    this.runInfoMap.set(run.id, {
      tags: run.tags ?? [],
      metadata: run.extra ?? {},
      name: runName,
      runType,
      inputs: run.inputs,
    });
    await this.send({
      event: "on_chat_model_start",
      data: {
        input: run.inputs,
      },
      name: runName,
      tags: run.tags ?? [],
      run_id: run.id,
      metadata: run.extra ?? {}
    }, run);
  }
//   async def on_chat_model_start(
//     self,
//     serialized: Dict[str, Any],
//     messages: List[List[BaseMessage]],
//     *,
//     run_id: UUID,
//     tags: Optional[List[str]] = None,
//     parent_run_id: Optional[UUID] = None,
//     metadata: Optional[Dict[str, Any]] = None,
//     name: Optional[str] = None,
//     **kwargs: Any,
// ) -> None:
//     """Start a trace for an LLM run."""
//     name_ = _assign_name(name, serialized)
//     run_type = "chat_model"
//     self.run_map[run_id] = {
//         "tags": tags or [],
//         "metadata": metadata or {},
//         "name": name_,
//         "run_type": run_type,
//         "inputs": {"messages": messages},
//     }

//     self._send(
//         {
//             "event": "on_chat_model_start",
//             "data": {
//                 "input": {"messages": messages},
//             },
//             "name": name_,
//             "tags": tags or [],
//             "run_id": str(run_id),
//             "metadata": metadata or {},
//         },
//         run_type,
//     )

// async def on_llm_start(
//     self,
//     serialized: Dict[str, Any],
//     prompts: List[str],
//     *,
//     run_id: UUID,
//     tags: Optional[List[str]] = None,
//     parent_run_id: Optional[UUID] = None,
//     metadata: Optional[Dict[str, Any]] = None,
//     name: Optional[str] = None,
//     **kwargs: Any,
// ) -> None:
//     """Start a trace for an LLM run."""
//     name_ = _assign_name(name, serialized)
//     run_type = "llm"
//     self.run_map[run_id] = {
//         "tags": tags or [],
//         "metadata": metadata or {},
//         "name": name_,
//         "run_type": run_type,
//         "inputs": {"prompts": prompts},
//     }

//     self._send(
//         {
//             "event": "on_llm_start",
//             "data": {
//                 "input": {
//                     "prompts": prompts,
//                 }
//             },
//             "name": name_,
//             "tags": tags or [],
//             "run_id": str(run_id),
//             "metadata": metadata or {},
//         },
//         run_type,
//     )

// async def on_llm_new_token(
//     self,
//     token: str,
//     *,
//     chunk: Optional[Union[GenerationChunk, ChatGenerationChunk]] = None,
//     run_id: UUID,
//     parent_run_id: Optional[UUID] = None,
//     **kwargs: Any,
// ) -> None:
//     """Run on new LLM token. Only available when streaming is enabled."""
//     run_info = self.run_map.get(run_id)

//     chunk_: Union[GenerationChunk, BaseMessageChunk]

//     if run_info is None:
//         raise AssertionError(f"Run ID {run_id} not found in run map.")
//     if self.is_tapped.get(run_id):
//         return
//     if run_info["run_type"] == "chat_model":
//         event = "on_chat_model_stream"

//         if chunk is None:
//             chunk_ = AIMessageChunk(content=token)
//         else:
//             chunk_ = cast(ChatGenerationChunk, chunk).message

//     elif run_info["run_type"] == "llm":
//         event = "on_llm_stream"
//         if chunk is None:
//             chunk_ = GenerationChunk(text=token)
//         else:
//             chunk_ = cast(GenerationChunk, chunk)
//     else:
//         raise ValueError(f"Unexpected run type: {run_info['run_type']}")

//     self._send(
//         {
//             "event": event,
//             "data": {
//                 "chunk": chunk_,
//             },
//             "run_id": str(run_id),
//             "name": run_info["name"],
//             "tags": run_info["tags"],
//             "metadata": run_info["metadata"],
//         },
//         run_info["run_type"],
//     )

// async def on_llm_end(
//     self, response: LLMResult, *, run_id: UUID, **kwargs: Any
// ) -> None:
//     """End a trace for an LLM run."""
//     run_info = self.run_map.pop(run_id)
//     inputs_ = run_info["inputs"]

//     generations: Union[List[List[GenerationChunk]], List[List[ChatGenerationChunk]]]
//     output: Union[dict, BaseMessage] = {}

//     if run_info["run_type"] == "chat_model":
//         generations = cast(List[List[ChatGenerationChunk]], response.generations)
//         for gen in generations:
//             if output != {}:
//                 break
//             for chunk in gen:
//                 output = chunk.message
//                 break

//         event = "on_chat_model_end"
//     elif run_info["run_type"] == "llm":
//         generations = cast(List[List[GenerationChunk]], response.generations)
//         output = {
//             "generations": [
//                 [
//                     {
//                         "text": chunk.text,
//                         "generation_info": chunk.generation_info,
//                         "type": chunk.type,
//                     }
//                     for chunk in gen
//                 ]
//                 for gen in generations
//             ],
//             "llm_output": response.llm_output,
//         }
//         event = "on_llm_end"
//     else:
//         raise ValueError(f"Unexpected run type: {run_info['run_type']}")

//     self._send(
//         {
//             "event": event,
//             "data": {"output": output, "input": inputs_},
//             "run_id": str(run_id),
//             "name": run_info["name"],
//             "tags": run_info["tags"],
//             "metadata": run_info["metadata"],
//         },
//         run_info["run_type"],
//     )

// async def on_chain_start(
//     self,
//     serialized: Dict[str, Any],
//     inputs: Dict[str, Any],
//     *,
//     run_id: UUID,
//     tags: Optional[List[str]] = None,
//     parent_run_id: Optional[UUID] = None,
//     metadata: Optional[Dict[str, Any]] = None,
//     run_type: Optional[str] = None,
//     name: Optional[str] = None,
//     **kwargs: Any,
// ) -> None:
//     """Start a trace for a chain run."""
//     name_ = _assign_name(name, serialized)
//     run_type_ = run_type or "chain"
//     run_info: RunInfo = {
//         "tags": tags or [],
//         "metadata": metadata or {},
//         "name": name_,
//         "run_type": run_type_,
//     }

//     data: EventData = {}

//     # Work-around Runnable core code not sending input in some
//     # cases.
//     if inputs != {"input": ""}:
//         data["input"] = inputs
//         run_info["inputs"] = inputs

//     self.run_map[run_id] = run_info

//     self._send(
//         {
//             "event": f"on_{run_type_}_start",
//             "data": data,
//             "name": name_,
//             "tags": tags or [],
//             "run_id": str(run_id),
//             "metadata": metadata or {},
//         },
//         run_type_,
//     )

// async def on_chain_end(
//     self,
//     outputs: Dict[str, Any],
//     *,
//     run_id: UUID,
//     inputs: Optional[Dict[str, Any]] = None,
//     **kwargs: Any,
// ) -> None:
//     """End a trace for a chain run."""
//     run_info = self.run_map.pop(run_id)
//     run_type = run_info["run_type"]

//     event = f"on_{run_type}_end"

//     inputs = inputs or run_info.get("inputs") or {}

//     data: EventData = {
//         "output": outputs,
//         "input": inputs,
//     }

//     self._send(
//         {
//             "event": event,
//             "data": data,
//             "run_id": str(run_id),
//             "name": run_info["name"],
//             "tags": run_info["tags"],
//             "metadata": run_info["metadata"],
//         },
//         run_type,
//     )

// async def on_tool_start(
//     self,
//     serialized: Dict[str, Any],
//     input_str: str,
//     *,
//     run_id: UUID,
//     tags: Optional[List[str]] = None,
//     parent_run_id: Optional[UUID] = None,
//     metadata: Optional[Dict[str, Any]] = None,
//     name: Optional[str] = None,
//     inputs: Optional[Dict[str, Any]] = None,
//     **kwargs: Any,
// ) -> None:
//     """Start a trace for a tool run."""
//     name_ = _assign_name(name, serialized)
//     self.run_map[run_id] = {
//         "tags": tags or [],
//         "metadata": metadata or {},
//         "name": name_,
//         "run_type": "tool",
//         "inputs": inputs,
//     }

//     self._send(
//         {
//             "event": "on_tool_start",
//             "data": {
//                 "input": inputs or {},
//             },
//             "name": name_,
//             "tags": tags or [],
//             "run_id": str(run_id),
//             "metadata": metadata or {},
//         },
//         "tool",
//     )

// async def on_tool_end(self, output: Any, *, run_id: UUID, **kwargs: Any) -> None:
//     """End a trace for a tool run."""
//     run_info = self.run_map.pop(run_id)
//     if "inputs" not in run_info:
//         raise AssertionError(
//             f"Run ID {run_id} is a tool call and is expected to have "
//             f"inputs associated with it."
//         )
//     inputs = run_info["inputs"]

//     self._send(
//         {
//             "event": "on_tool_end",
//             "data": {
//                 "output": output,
//                 "input": inputs,
//             },
//             "run_id": str(run_id),
//             "name": run_info["name"],
//             "tags": run_info["tags"],
//             "metadata": run_info["metadata"],
//         },
//         "tool",
//     )

// async def on_retriever_start(
//     self,
//     serialized: Dict[str, Any],
//     query: str,
//     *,
//     run_id: UUID,
//     parent_run_id: Optional[UUID] = None,
//     tags: Optional[List[str]] = None,
//     metadata: Optional[Dict[str, Any]] = None,
//     name: Optional[str] = None,
//     **kwargs: Any,
// ) -> None:
//     """Run when Retriever starts running."""
//     name_ = _assign_name(name, serialized)
//     run_type = "retriever"
//     self.run_map[run_id] = {
//         "tags": tags or [],
//         "metadata": metadata or {},
//         "name": name_,
//         "run_type": run_type,
//         "inputs": {"query": query},
//     }

//     self._send(
//         {
//             "event": "on_retriever_start",
//             "data": {
//                 "input": {
//                     "query": query,
//                 }
//             },
//             "name": name_,
//             "tags": tags or [],
//             "run_id": str(run_id),
//             "metadata": metadata or {},
//         },
//         run_type,
//     )

// async def on_retriever_end(
//     self, documents: Sequence[Document], *, run_id: UUID, **kwargs: Any
// ) -> None:
//     """Run when Retriever ends running."""
//     run_info = self.run_map.pop(run_id)

//     self._send(
//         {
//             "event": "on_retriever_end",
//             "data": {
//                 "output": documents,
//                 "input": run_info["inputs"],
//             },
//             "run_id": str(run_id),
//             "name": run_info["name"],
//             "tags": run_info["tags"],
//             "metadata": run_info["metadata"],
//         },
//         run_info["run_type"],
//     )
}
