import { BaseCallbackHandlerInput } from "@langchain/core/callbacks/base";
import { BaseTracer, Run } from "@langchain/core/tracers/base";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { Document } from "@langchain/core/documents";
import { BaseMessage, isAIMessage } from "@langchain/core/messages";
import { ChatGeneration } from "@langchain/core/outputs";
import { KVMap } from "langsmith/schemas";

export type DatadogLLMObsSpanKind =
  | "llm"
  | "workflow"
  | "agent"
  | "tool"
  | "task"
  | "embedding"
  | "retrieval";

export type DatadogLLMObsIO =
  | { value: string }
  | {
      documents: {
        text?: string;
        id?: string;
        name?: string;
        score: string | number;
      }[];
    }
  | { messages: { content: string; role?: string }[] };

export interface DatadogLLMObsSpan {
  span_id: string;
  trace_id: string;
  parent_id: string;
  session_id?: string;
  name: string;
  start_ns: number;
  duration: number;
  error: number;
  status: string;
  tags?: string[];
  meta: {
    kind: DatadogLLMObsSpanKind;
    model_name?: string;
    model_provider?: string;
    temperature?: string;
    input: DatadogLLMObsIO;
    output: DatadogLLMObsIO | undefined;
  };
  metrics: { [key: string]: number };
}

export interface DatadogLLMObsRequestBody {
  data: {
    type: "span";
    attributes: {
      ml_app: string;
      tags: string[];
      spans: DatadogLLMObsSpan[];
      session_id?: string;
    };
  };
}

export type FormatDocument<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Metadata extends Record<string, any> = Record<string, any>,
> = (document: Document<Metadata>) => {
  text: string;
  id: string;
  name: string;
  score: number;
};

export interface DatadogLLMObsTracerFields extends BaseCallbackHandlerInput {
  mlApp: string;
  userId?: string;
  userHandle?: string;
  sessionId?: string;
  env?: string;
  service?: string;
  tags?: Record<string, string | undefined>;
  ddApiKey?: string;
  ddLLMObsEndpoint?: string;
  formatDocument?: FormatDocument;
}

export class DatadogLLMObsTracer
  extends BaseTracer
  implements DatadogLLMObsTracerFields
{
  name = "datadog_tracer";

  ddLLMObsEndpoint?: string;

  protected endpoint =
    getEnvironmentVariable("DD_LLMOBS_ENDPOINT") ||
    "https://api.datadoghq.com/api/unstable/llm-obs/v1/trace/spans";

  protected headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  mlApp: string;

  sessionId?: string;

  tags: Record<string, string | undefined> = {};

  formatDocument?: FormatDocument;

  constructor(fields: DatadogLLMObsTracerFields) {
    super(fields);
    const {
      mlApp,
      userHandle,
      userId,
      sessionId,
      service,
      env,
      tags,
      ddLLMObsEndpoint,
      ddApiKey,
      formatDocument,
    } = fields;

    const apiKey = ddApiKey || getEnvironmentVariable("DD_API_KEY");

    if (apiKey) {
      this.headers["DD-API-KEY"] = apiKey;
    }

    this.mlApp = mlApp;
    this.sessionId = sessionId;
    this.ddLLMObsEndpoint = ddLLMObsEndpoint;
    this.formatDocument = formatDocument;

    this.tags = {
      ...tags,
      env: env || "not-set",
      service: service || "not-set",
      user_handle: userHandle,
      user_id: userId,
    };
  }

  protected async persistRun(_run: Run): Promise<void> {
    try {
      const spans = this.convertRunToDDSpans(_run);

      const response = await fetch(this.ddLLMObsEndpoint || this.endpoint, {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(this.formatRequestBody(spans)),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
    } catch (error) {
      console.error(`Error writing spans to Datadog: ${error}`);
    }
  }

  protected convertRunToDDSpans(run: Run): DatadogLLMObsSpan[] {
    const spans = [this.langchainRunToDatadogLLMObsSpan(run)];

    if (run.child_runs) {
      run.child_runs.forEach((childRun) => {
        spans.push(...this.convertRunToDDSpans(childRun));
      });
    }

    return spans.flatMap((span) => (span ? [span] : []));
  }

  protected formatRequestBody(
    spans: DatadogLLMObsSpan[]
  ): DatadogLLMObsRequestBody {
    return {
      data: {
        type: "span",
        attributes: {
          ml_app: this.mlApp,
          tags: Object.entries(this.tags)
            .filter(([, value]) => value)
            .map(([key, value]) => `${key}:${value}`),
          spans,
          session_id: this.sessionId,
        },
      },
    };
  }

  protected uuidToBigInt(uuid: string): string {
    const hexString = uuid.replace(/-/g, "");
    const first64Bits = hexString.slice(0, 16);
    const bigIntValue = BigInt("0x" + first64Bits).toString();

    return bigIntValue;
  }

  protected milisecondsToNanoseconds(ms: number): number {
    return ms * 1e6;
  }

  protected toDatadogSpanKind(kind: string): DatadogLLMObsSpanKind | null {
    switch (kind) {
      case "llm":
        return "llm";
      case "tool":
        return "tool";
      case "chain":
        return "workflow";
      case "retriever":
        return "retrieval";
      default:
        return null;
    }
  }

  protected transformInput(
    inputs: KVMap,
    spanKind: DatadogLLMObsSpanKind
  ): DatadogLLMObsIO {
    if (spanKind === "llm") {
      if (inputs?.messages) {
        return {
          messages: inputs?.messages?.flatMap((messages: BaseMessage[]) =>
            messages.map((message) => ({
              content: message.content,
              role: message?._getType?.() ?? undefined,
            }))
          ),
        };
      }

      if (inputs?.prompts) {
        return { value: inputs.prompts.join("\n") };
      }
    }

    return { value: JSON.stringify(inputs) };
  }

  protected transformOutput(
    outputs: KVMap | undefined,
    spanKind: DatadogLLMObsSpanKind
  ): {
    output: DatadogLLMObsIO | undefined;
    tokensMetadata: Record<string, number>;
  } {
    const tokensMetadata: Record<string, number> = {};

    if (!outputs) {
      return { output: undefined, tokensMetadata };
    }

    if (spanKind === "llm") {
      return {
        output: {
          messages: outputs?.generations?.flatMap(
            (generations: ChatGeneration[]) =>
              generations.map(({ message, text }) => {
                if (isAIMessage(message) && message?.usage_metadata) {
                  tokensMetadata.prompt_tokens =
                    message.usage_metadata.input_tokens;
                  tokensMetadata.completion_tokens =
                    message.usage_metadata.output_tokens;
                  tokensMetadata.total_tokens =
                    message.usage_metadata.total_tokens;
                }

                return {
                  content: message?.content ?? text,
                  role: message?._getType?.(),
                };
              })
          ),
        },
        tokensMetadata,
      };
    }

    if (spanKind === "retrieval") {
      return {
        output: {
          documents: outputs?.documents.map((document: Document) => {
            if (typeof this.formatDocument === "function") {
              return this.formatDocument(document);
            }

            return {
              text: document.pageContent,
              id: document.metadata?.id,
              name: document.metadata?.name,
              score: document.metadata?.score,
            };
          }),
        },
        tokensMetadata,
      };
    }

    if (outputs?.output) {
      return {
        output: { value: JSON.stringify(outputs.output) },
        tokensMetadata,
      };
    }

    return { output: { value: JSON.stringify(outputs) }, tokensMetadata };
  }

  protected langchainRunToDatadogLLMObsSpan(
    run: Run
  ): DatadogLLMObsSpan | null {
    if (!run.end_time || !run.trace_id) {
      return null;
    }

    const spanId = this.uuidToBigInt(run.id);
    const traceId = this.uuidToBigInt(run.trace_id);
    const parentId = run.parent_run_id
      ? this.uuidToBigInt(run.parent_run_id)
      : "undefined";
    const spanKind = this.toDatadogSpanKind(run.run_type);

    if (spanKind === null) {
      return null;
    }

    const input = this.transformInput(run.inputs, spanKind);
    const { output, tokensMetadata } = this.transformOutput(
      run.outputs,
      spanKind
    );

    const startTimeNs = Number(this.milisecondsToNanoseconds(run.start_time));
    const endTimeNs = Number(this.milisecondsToNanoseconds(run.end_time));
    const durationNs = endTimeNs - startTimeNs;

    if (durationNs <= 0) {
      return null;
    }

    const spanName =
      (run.serialized as { kwargs: { name?: string } })?.kwargs?.name ??
      run.name;
    const spanError = run.error ? 1 : 0;
    const spanStatus = run.error ? "error" : "ok";

    const meta = {
      kind: spanKind,
      input,
      output,
      model_name: run.extra?.metadata?.ls_model_name,
      model_provider: run.extra?.metadata?.ls_provider,
      temperature: run.extra?.metadata?.ls_temperature,
    };

    return {
      parent_id: parentId,
      trace_id: traceId,
      span_id: spanId,
      name: spanName,
      error: spanError,
      status: spanStatus,
      tags: [...(run.tags?.length ? run.tags : [])],
      meta,
      start_ns: startTimeNs,
      duration: durationNs,
      metrics: tokensMetadata,
    };
  }
}
