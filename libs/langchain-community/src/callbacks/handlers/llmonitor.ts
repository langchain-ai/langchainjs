import monitor from "llmonitor";
import { LLMonitorOptions, ChatMessage, cJSON } from "llmonitor/types";
import { BaseRun, RunUpdate as BaseRunUpdate, KVMap } from "langsmith/schemas";

import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseMessage } from "@langchain/core/messages";
import { ChainValues } from "@langchain/core/utils/types";
import { LLMResult, Generation } from "@langchain/core/outputs";
import {
  BaseCallbackHandler,
  BaseCallbackHandlerInput,
} from "@langchain/core/callbacks/base";

import { Serialized } from "../../load/serializable.js";

type Role = "user" | "ai" | "system" | "function" | "tool";

// Langchain Helpers
// Input can be either a single message, an array of message, or an array of array of messages (batch requests)

const parseRole = (id: string[]): Role => {
  const roleHint = id[id.length - 1];

  if (roleHint.includes("Human")) return "user";
  if (roleHint.includes("System")) return "system";
  if (roleHint.includes("AI")) return "ai";
  if (roleHint.includes("Function")) return "function";
  if (roleHint.includes("Tool")) return "tool";

  return "ai";
};

type Message = BaseMessage | Generation | string;

type OutputMessage = ChatMessage | string;

const PARAMS_TO_CAPTURE = [
  "stop",
  "stop_sequences",
  "function_call",
  "functions",
  "tools",
  "tool_choice",
  "response_format",
];

export const convertToLLMonitorMessages = (
  input: Message | Message[] | Message[][]
): OutputMessage | OutputMessage[] | OutputMessage[][] => {
  const parseMessage = (raw: Message): OutputMessage => {
    if (typeof raw === "string") return raw;
    // sometimes the message is nested in a "message" property
    if ("message" in raw) return parseMessage(raw.message as Message);

    // Serialize
    const message = JSON.parse(JSON.stringify(raw));

    try {
      // "id" contains an array describing the constructor, with last item actual schema type
      const role = parseRole(message.id);

      const obj = message.kwargs;
      const text = message.text ?? obj.content;

      return {
        role,
        text,
        ...(obj.additional_kwargs ?? {}),
      };
    } catch (e) {
      // if parsing fails, return the original message
      return message.text ?? message;
    }
  };

  if (Array.isArray(input)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Confuses the compiler
    return input.length === 1
      ? convertToLLMonitorMessages(input[0])
      : input.map(convertToLLMonitorMessages);
  }
  return parseMessage(input);
};

const parseInput = (rawInput: Record<string, unknown>) => {
  if (!rawInput) return null;

  const { input, inputs, question } = rawInput;

  if (input) return input;
  if (inputs) return inputs;
  if (question) return question;

  return rawInput;
};

const parseOutput = (rawOutput: Record<string, unknown>) => {
  if (!rawOutput) return null;

  const { text, output, answer, result } = rawOutput;

  if (text) return text;
  if (answer) return answer;
  if (output) return output;
  if (result) return result;

  return rawOutput;
};

const parseExtraAndName = (
  llm: Serialized,
  extraParams?: KVMap,
  metadata?: KVMap
) => {
  const params = {
    ...(extraParams?.invocation_params ?? {}),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore this is a valid property
    ...(llm?.kwargs ?? {}),
    ...(metadata || {}),
  };

  const { model, model_name, modelName, model_id, userId, userProps, ...rest } =
    params;

  const name = model || modelName || model_name || model_id || llm.id.at(-1);

  // Filter rest to only include params we want to capture
  const extra = Object.fromEntries(
    Object.entries(rest).filter(
      ([key]) =>
        PARAMS_TO_CAPTURE.includes(key) ||
        ["string", "number", "boolean"].includes(typeof rest[key])
    )
  ) as cJSON;

  return { name, extra, userId, userProps };
};

export interface Run extends BaseRun {
  id: string;
  child_runs: this[];
  child_execution_order: number;
}

export interface RunUpdate extends BaseRunUpdate {
  events: BaseRun["events"];
}

export interface LLMonitorHandlerFields
  extends BaseCallbackHandlerInput,
    LLMonitorOptions {}

export class LLMonitorHandler
  extends BaseCallbackHandler
  implements LLMonitorHandlerFields
{
  name = "llmonitor_handler";

  monitor: typeof monitor;

  constructor(fields: LLMonitorHandlerFields = {}) {
    super(fields);

    this.monitor = monitor;

    if (fields) {
      const { appId, apiUrl, verbose } = fields;

      this.monitor.init({
        verbose,
        appId: appId ?? getEnvironmentVariable("LLMONITOR_APP_ID"),
        apiUrl: apiUrl ?? getEnvironmentVariable("LLMONITOR_API_URL"),
      });
    }
  }

  async handleLLMStart(
    llm: Serialized,
    prompts: string[],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const { name, extra, userId, userProps } = parseExtraAndName(
      llm,
      extraParams,
      metadata
    );

    await this.monitor.trackEvent("llm", "start", {
      runId,
      parentRunId,
      name,
      input: convertToLLMonitorMessages(prompts),
      extra,
      userId,
      userProps,
      tags,
      runtime: "langchain-js",
    });
  }

  async handleChatModelStart(
    llm: Serialized,
    messages: BaseMessage[][],
    runId: string,
    parentRunId?: string,
    extraParams?: KVMap,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const { name, extra, userId, userProps } = parseExtraAndName(
      llm,
      extraParams,
      metadata
    );

    await this.monitor.trackEvent("llm", "start", {
      runId,
      parentRunId,
      name,
      input: convertToLLMonitorMessages(messages),
      extra,
      userId,
      userProps,
      tags,
      runtime: "langchain-js",
    });
  }

  async handleLLMEnd(output: LLMResult, runId: string): Promise<void> {
    const { generations, llmOutput } = output;

    await this.monitor.trackEvent("llm", "end", {
      runId,
      output: convertToLLMonitorMessages(generations),
      tokensUsage: {
        completion: llmOutput?.tokenUsage?.completionTokens,
        prompt: llmOutput?.tokenUsage?.promptTokens,
      },
    });
  }

  async handleLLMError(error: Error, runId: string): Promise<void> {
    await this.monitor.trackEvent("llm", "error", {
      runId,
      error,
    });
  }

  async handleChainStart(
    chain: Serialized,
    inputs: ChainValues,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const { agentName, userId, userProps, ...rest } = metadata || {};

    // allow the user to specify an agent name
    const name = agentName || chain.id.at(-1);

    // Attempt to automatically detect if this is an agent or chain
    const runType =
      agentName || ["AgentExecutor", "PlanAndExecute"].includes(name)
        ? "agent"
        : "chain";

    await this.monitor.trackEvent(runType, "start", {
      runId,
      parentRunId,
      name,
      userId,
      userProps,
      input: parseInput(inputs) as cJSON,
      extra: rest,
      tags,
      runtime: "langchain-js",
    });
  }

  async handleChainEnd(outputs: ChainValues, runId: string): Promise<void> {
    await this.monitor.trackEvent("chain", "end", {
      runId,
      output: parseOutput(outputs) as cJSON,
    });
  }

  async handleChainError(error: Error, runId: string): Promise<void> {
    await this.monitor.trackEvent("chain", "error", {
      runId,
      error,
    });
  }

  async handleToolStart(
    tool: Serialized,
    input: string,
    runId: string,
    parentRunId?: string,
    tags?: string[],
    metadata?: KVMap
  ): Promise<void> {
    const { toolName, userId, userProps, ...rest } = metadata || {};
    const name = toolName || tool.id.at(-1);

    await this.monitor.trackEvent("tool", "start", {
      runId,
      parentRunId,
      name,
      userId,
      userProps,
      input,
      extra: rest,
      tags,
      runtime: "langchain-js",
    });
  }

  async handleToolEnd(output: string, runId: string): Promise<void> {
    await this.monitor.trackEvent("tool", "end", {
      runId,
      output,
    });
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    await this.monitor.trackEvent("tool", "error", {
      runId,
      error,
    });
  }
}
