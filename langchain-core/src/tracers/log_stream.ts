import {
  applyPatch,
  type Operation as JSONPatchOperation,
} from "../utils/fast-json-patch/index.js";
import { BaseTracer, type Run } from "./base.js";
import { BaseCallbackHandlerInput } from "../callbacks/base.js";
import { IterableReadableStream } from "../utils/stream.js";

/**
 * Interface that represents the structure of a log entry in the
 * `LogStreamCallbackHandler`.
 */
export type LogEntry = {
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
  /** List of LLM tokens streamed by this run, if applicable. */
  streamed_output_str: string[];
  /** Final output of this run. Only available after the run has finished successfully. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  final_output?: any;
  /** ISO-8601 timestamp of when the run ended. Only available after the run has finished. */
  end_time?: string;
};

export type RunState = {
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
};

/**
 * List of jsonpatch JSONPatchOperations, which describe how to create the run state
 * from an empty dict. This is the minimal representation of the log, designed to
 * be serialized as JSON and sent over the wire to reconstruct the log on the other
 * side. Reconstruction of the state can be done with any jsonpatch-compliant library,
 * see https://jsonpatch.com for more information.
 */
export class RunLogPatch {
  ops: JSONPatchOperation[];

  constructor(fields: { ops: JSONPatchOperation[] }) {
    this.ops = fields.ops;
  }

  concat(other: RunLogPatch) {
    const ops = this.ops.concat(other.ops);
    const states = applyPatch({}, ops);
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new RunLog({
      ops,
      state: states[states.length - 1].newDocument as RunState,
    });
  }
}

export class RunLog extends RunLogPatch {
  state: RunState;

  constructor(fields: { ops: JSONPatchOperation[]; state: RunState }) {
    super(fields);
    this.state = fields.state;
  }

  concat(other: RunLogPatch) {
    const ops = this.ops.concat(other.ops);
    const states = applyPatch(this.state, other.ops);
    return new RunLog({ ops, state: states[states.length - 1].newDocument });
  }
}

export interface LogStreamCallbackHandlerInput
  extends BaseCallbackHandlerInput {
  autoClose?: boolean;
  includeNames?: string[];
  includeTypes?: string[];
  includeTags?: string[];
  excludeNames?: string[];
  excludeTypes?: string[];
  excludeTags?: string[];
}

/**
 * Class that extends the `BaseTracer` class from the
 * `langchain.callbacks.tracers.base` module. It represents a callback
 * handler that logs the execution of runs and emits `RunLog` instances to a
 * `RunLogStream`.
 */
export class LogStreamCallbackHandler extends BaseTracer {
  protected autoClose = true;

  protected includeNames?: string[];

  protected includeTypes?: string[];

  protected includeTags?: string[];

  protected excludeNames?: string[];

  protected excludeTypes?: string[];

  protected excludeTags?: string[];

  private keyMapByRunId: Record<string, string> = {};

  private counterMapByRunName: Record<string, number> = {};

  protected transformStream: TransformStream;

  public writer: WritableStreamDefaultWriter;

  public receiveStream: IterableReadableStream<RunLogPatch>;

  name = "log_stream_tracer";

  constructor(fields?: LogStreamCallbackHandlerInput) {
    super(fields);
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
    if (run.parent_run_id === undefined) {
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

  async onRunCreate(run: Run): Promise<void> {
    if (run.parent_run_id === undefined) {
      await this.writer.write(
        new RunLogPatch({
          ops: [
            {
              op: "replace",
              path: "",
              value: {
                id: run.id,
                streamed_output: [],
                final_output: undefined,
                logs: {},
              },
            },
          ],
        })
      );
    }

    if (!this._includeRun(run)) {
      return;
    }

    if (this.counterMapByRunName[run.name] === undefined) {
      this.counterMapByRunName[run.name] = 0;
    }
    this.counterMapByRunName[run.name] += 1;
    const count = this.counterMapByRunName[run.name];
    this.keyMapByRunId[run.id] =
      count === 1 ? run.name : `${run.name}:${count}`;

    const logEntry: LogEntry = {
      id: run.id,
      name: run.name,
      type: run.run_type,
      tags: run.tags ?? [],
      metadata: run.extra?.metadata ?? {},
      start_time: new Date(run.start_time).toISOString(),
      streamed_output_str: [],
      final_output: undefined,
      end_time: undefined,
    };
    await this.writer.write(
      new RunLogPatch({
        ops: [
          {
            op: "add",
            path: `/logs/${this.keyMapByRunId[run.id]}`,
            value: logEntry,
          },
        ],
      })
    );
  }

  async onRunUpdate(run: Run): Promise<void> {
    try {
      const runName = this.keyMapByRunId[run.id];
      if (runName === undefined) {
        return;
      }
      const ops: JSONPatchOperation[] = [
        {
          op: "add",
          path: `/logs/${runName}/final_output`,
          value: run.outputs,
        },
      ];
      if (run.end_time !== undefined) {
        ops.push({
          op: "add",
          path: `/logs/${runName}/end_time`,
          value: new Date(run.end_time).toISOString(),
        });
      }
      const patch = new RunLogPatch({ ops });
      await this.writer.write(patch);
    } finally {
      if (run.parent_run_id === undefined) {
        const patch = new RunLogPatch({
          ops: [
            {
              op: "replace",
              path: "/final_output",
              value: run.outputs,
            },
          ],
        });
        await this.writer.write(patch);
        if (this.autoClose) {
          await this.writer.close();
        }
      }
    }
  }

  async onLLMNewToken(run: Run, token: string): Promise<void> {
    const runName = this.keyMapByRunId[run.id];
    if (runName === undefined) {
      return;
    }
    const patch = new RunLogPatch({
      ops: [
        {
          op: "add",
          path: `/logs/${runName}/streamed_output_str/-`,
          value: token,
        },
      ],
    });
    await this.writer.write(patch);
  }
}
