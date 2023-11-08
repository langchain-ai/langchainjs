import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { Run } from "openai/resources/beta/threads/index";
import { AssistantCreateParams } from "openai/resources/beta/index.mjs";
import { Runnable } from "../../schema/runnable/base.js";
import { sleep } from "../../util/time.js";
import { RunnableConfig } from "../../schema/runnable/config.js";
import {
  OutputType,
  OpenAIAssistantFinish,
  OpenAIAssistantAction,
  OpenAIToolType,
} from "./schema.js";
import { StructuredTool } from "../../tools/base.js";
import { formatToOpenAIFunction } from "../../tools/convert_to_openai.js";

interface OpenAIAssistantRunnableInput {
  client?: OpenAIClient;
  clientOptions?: ClientOptions;
  assistantId: string;
  asAgent?: boolean;
  pollIntervalMs?: number;
}

export class OpenAIAssistantRunnable<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any>,
  RunOutput extends OutputType
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "beta", "openai_assistant"];

  private client: OpenAIClient;

  assistantId: string;

  pollIntervalMs = 1000;

  asAgent = false;

  constructor(fields: OpenAIAssistantRunnableInput) {
    super();
    this.client = fields.client || new OpenAIClient(fields?.clientOptions);
    this.assistantId = fields.assistantId;
    this.asAgent = fields.asAgent ?? false;
  }

  static async create<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    RunInput extends Record<string, any>,
    RunOutput extends OutputType
  >({
    model,
    name,
    instructions,
    tools,
    client,
    clientOptions,
    asAgent,
    pollIntervalMs,
  }: Omit<OpenAIAssistantRunnableInput, "assistantId"> & {
    model: string;
    name?: string;
    instructions?: string;
    tools?: OpenAIToolType | Array<StructuredTool>;
  }) {
    const formattedTools =
      tools?.map((tool) => {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (tool instanceof StructuredTool) {
          return {
            type: "function",
            function: formatToOpenAIFunction(tool),
          } as AssistantCreateParams.AssistantToolsFunction;
        }
        return tool;
      }) ?? [];
    const oaiClient = client ?? new OpenAIClient(clientOptions);
    const assistant = await oaiClient.beta.assistants.create({
      name,
      instructions,
      tools: formattedTools,
      model,
    });

    return new this<RunInput, RunOutput>({
      client: oaiClient,
      assistantId: assistant.id,
      asAgent,
      pollIntervalMs,
    });
  }

  async invoke(input: RunInput, _options?: RunnableConfig): Promise<RunOutput> {
    let run: Run;
    if (this.asAgent && input.steps && input.steps.length > 0) {
      const parsedStepsInput = await this._parseStepsInput(input);
      run = await this.client.beta.threads.runs.submitToolOutputs(
        parsedStepsInput.threadId,
        parsedStepsInput.runId,
        {
          tool_outputs: parsedStepsInput.toolOutputs,
        }
      );
    } else if (!("threadId" in input)) {
      const thread = {
        messages: [
          {
            role: "user",
            content: input.content,
            file_ids: input.fileIds,
            metadata: input.messagesMetadata,
          },
        ],
        metadata: input.threadMetadata,
      };
      run = await this._createThreadAndRun({
        ...input,
        thread,
      });
    } else if (!("runId" in input)) {
      await this.client.beta.threads.messages.create(input.threadId, {
        content: input.content,
        role: "user",
        file_ids: input.file_ids,
        metadata: input.messagesMetadata,
      });
      run = await this._createRun(input);
    } else {
      // Submitting tool outputs to an existing run, outside the AgentExecutor
      // framework.
      run = await this.client.beta.threads.runs.submitToolOutputs(
        input.runId,
        input.threadId,
        {
          tool_outputs: input.toolOutputs,
        }
      );
    }

    return this._getResponse(run.id, run.thread_id) as unknown as RunOutput;
  }

  private async _parseStepsInput(input: RunInput): Promise<RunInput> {
    const {
      action: { runId, threadId },
    } = input.steps[input.steps.length - 1];
    const run = await this._waitForRun(runId, threadId);
    const toolCalls = run.required_action?.submit_tool_outputs.tool_calls;
    if (!toolCalls) {
      return input;
    }
    const toolOutputs = toolCalls.flatMap((toolCall) => {
      const matchedAction = (
        input.steps as {
          action: OpenAIAssistantAction;
          observation: string;
        }[]
      ).find((step) => step.action.toolCallId === toolCall.id);

      return matchedAction
        ? [
            {
              output: matchedAction.observation,
              tool_call_id: matchedAction.action.toolCallId,
            },
          ]
        : [];
    });
    return { toolOutputs, runId, threadId } as unknown as RunInput;
  }

  private async _createRun({
    instructions,
    model,
    tools,
    metadata,
    threadId,
  }: RunInput) {
    const run = this.client.beta.threads.runs.create(threadId, {
      assistant_id: this.assistantId,
      instructions,
      model,
      tools,
      metadata,
    });
    return run;
  }

  private async _createThreadAndRun(input: RunInput) {
    const params: Record<string, unknown> = [
      "instructions",
      "model",
      "tools",
      "run_metadata",
    ]
      .filter((key) => key in input)
      .reduce((obj, key) => {
        const newObj = obj;
        newObj[key] = input[key];
        return newObj;
      }, {} as Record<string, unknown>);
    const run = this.client.beta.threads.createAndRun({
      ...params,
      thread: input.thread,
      assistant_id: this.assistantId,
    });
    return run;
  }

  private async _waitForRun(runId: string, threadId: string) {
    let inProgress = true;
    let run = {} as Run;
    while (inProgress) {
      run = await this.client.beta.threads.runs.retrieve(threadId, runId);
      inProgress = ["in_progress", "queued"].includes(run.status);
      if (inProgress) {
        await sleep(this.pollIntervalMs);
      }
    }
    return run;
  }

  private async _getResponse(
    runId: string,
    threadId: string
  ): Promise<OutputType> {
    const run = await this._waitForRun(runId, threadId);
    if (run.status === "completed") {
      const messages = await this.client.beta.threads.messages.list(threadId, {
        order: "asc",
      });
      const newMessages = messages.data.filter((msg) => msg.run_id === runId);
      if (!this.asAgent) {
        return newMessages;
      }
      const answer = newMessages.flatMap((msg) => msg.content);
      if (answer.every((item) => item.type === "text")) {
        const answerString = answer
          .map((item) => item.type === "text" && item.text.value)
          .join("\n");
        return new OpenAIAssistantFinish({
          returnValues: {
            output: answerString,
          },
          log: "",
          runId,
          threadId,
        });
      }
    } else if (run.status === "requires_action") {
      if (
        !this.asAgent ||
        !run.required_action?.submit_tool_outputs.tool_calls
      ) {
        return run.required_action?.submit_tool_outputs.tool_calls ?? [];
      }
      const actions: OpenAIAssistantAction[] = [];
      run.required_action.submit_tool_outputs.tool_calls.forEach((item) => {
        const functionCall = item.function;
        const args = JSON.parse(functionCall.arguments);
        actions.push(
          new OpenAIAssistantAction({
            tool: functionCall.name,
            toolInput: args,
            toolCallId: item.id,
            log: "",
            runId,
            threadId,
          })
        );
      });
      return actions;
    }
    const runInfo = JSON.stringify(run, null, 2);
    throw new Error(
      `Unknown run status ${run.status}.\nFull run info:\n\n${runInfo}`
    );
  }
}
