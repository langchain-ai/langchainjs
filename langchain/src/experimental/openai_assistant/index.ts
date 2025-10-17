import {
  type ClientOptions,
  type OpenAIChatModelId,
  OpenAIClient,
} from "@langchain/openai";
import { StructuredTool } from "@langchain/core/tools";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { formatToOpenAIAssistantTool } from "@langchain/openai";
import { sleep } from "../../util/time.js";
import type {
  OpenAIAssistantFinish,
  OpenAIAssistantAction,
  OpenAIToolType,
} from "./schema.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ThreadMessage = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RequiredActionFunctionToolCall = any;

type ExtractRunOutput<AsAgent extends boolean | undefined> =
  AsAgent extends true
    ? OpenAIAssistantFinish | OpenAIAssistantAction[]
    : ThreadMessage[] | RequiredActionFunctionToolCall[];

export type OpenAIAssistantRunnableInput<
  AsAgent extends boolean | undefined = undefined
> = {
  client?: OpenAIClient;
  clientOptions?: ClientOptions;
  assistantId: string;
  pollIntervalMs?: number;
  asAgent?: AsAgent;
};

export class OpenAIAssistantRunnable<
  AsAgent extends boolean | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RunInput extends Record<string, any> = Record<string, any>
> extends Runnable<RunInput, ExtractRunOutput<AsAgent>> {
  lc_namespace = ["langchain", "experimental", "openai_assistant"];

  private client: OpenAIClient;

  assistantId: string;

  pollIntervalMs = 1000;

  asAgent?: AsAgent;

  constructor(fields: OpenAIAssistantRunnableInput<AsAgent>) {
    super(fields);
    this.client = fields.client ?? new OpenAIClient(fields?.clientOptions);
    this.assistantId = fields.assistantId;
    this.asAgent = fields.asAgent ?? this.asAgent;
  }

  static async createAssistant<AsAgent extends boolean>({
    model,
    name,
    instructions,
    tools,
    client,
    clientOptions,
    asAgent,
    pollIntervalMs,
    fileIds,
  }: Omit<OpenAIAssistantRunnableInput<AsAgent>, "assistantId"> & {
    model: OpenAIChatModelId;
    name?: string;
    instructions?: string;
    tools?: OpenAIToolType | Array<StructuredTool>;
    fileIds?: string[];
  }) {
    const formattedTools =
      tools?.map((tool) => {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (tool instanceof StructuredTool) {
          return formatToOpenAIAssistantTool(tool);
        }
        return tool;
      }) ?? [];
    const oaiClient = client ?? new OpenAIClient(clientOptions);
    const assistant = await oaiClient.beta.assistants.create({
      name,
      instructions,
      tools: formattedTools,
      model,
      file_ids: fileIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return new this({
      client: oaiClient,
      assistantId: assistant.id,
      asAgent,
      pollIntervalMs,
    });
  }

  async invoke(
    input: RunInput,
    _options?: RunnableConfig
  ): Promise<ExtractRunOutput<AsAgent>> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let run: any;
    if (this.asAgent && input.steps && input.steps.length > 0) {
      const parsedStepsInput = await this._parseStepsInput(input);
      run = await this.client.beta.threads.runs.submitToolOutputs(
        parsedStepsInput.runId,
        {
          thread_id: parsedStepsInput.threadId,
          tool_outputs: parsedStepsInput.toolOutputs,
        }
      );
    } else if (!("threadId" in input)) {
      const thread = {
        messages: [
          {
            role: "user",
            content: input.content,
            attachments: input.attachments,
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
        attachments: input.attachments,
        metadata: input.messagesMetadata,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      run = await this._createRun(input);
    } else {
      // Submitting tool outputs to an existing run, outside the AgentExecutor
      // framework.
      run = await this.client.beta.threads.runs.submitToolOutputs(input.runId, {
        thread_id: input.threadId,
        tool_outputs: input.toolOutputs,
      });
    }

    return this._getResponse(run.id, run.thread_id);
  }

  /**
   * Delete an assistant.
   *
   * @link {https://platform.openai.com/docs/api-reference/assistants/deleteAssistant}
   * @returns {Promise<AssistantDeleted>}
   */
  public async deleteAssistant() {
    return await this.client.beta.assistants.delete(this.assistantId);
  }

  /**
   * Retrieves an assistant.
   *
   * @link {https://platform.openai.com/docs/api-reference/assistants/getAssistant}
   * @returns {Promise<OpenAIClient.Beta.Assistants.Assistant>}
   */
  public async getAssistant() {
    return await this.client.beta.assistants.retrieve(this.assistantId);
  }

  /**
   * Modifies an assistant.
   *
   * @link {https://platform.openai.com/docs/api-reference/assistants/modifyAssistant}
   * @returns {Promise<OpenAIClient.Beta.Assistants.Assistant>}
   */
  public async modifyAssistant<AsAgent extends boolean>({
    model,
    name,
    instructions,
    fileIds,
  }: Omit<OpenAIAssistantRunnableInput<AsAgent>, "assistantId" | "tools"> & {
    model?: OpenAIChatModelId;
    name?: string;
    instructions?: string;
    fileIds?: string[];
  }) {
    return await this.client.beta.assistants.update(this.assistantId, {
      name,
      instructions,
      model,
      file_ids: fileIds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolOutputs = toolCalls.flatMap((toolCall: any) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let run = {} as any;
    while (inProgress) {
      run = await this.client.beta.threads.runs.retrieve(runId, {
        thread_id: threadId,
      });
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
  ): Promise<ExtractRunOutput<AsAgent>>;

  private async _getResponse(
    runId: string,
    threadId: string
  ): Promise<
    | OpenAIAssistantFinish
    | OpenAIAssistantAction[]
    | ThreadMessage[]
    | RequiredActionFunctionToolCall[]
  > {
    const run = await this._waitForRun(runId, threadId);
    if (run.status === "completed") {
      const messages = await this.client.beta.threads.messages.list(threadId, {
        order: "desc",
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
        return {
          returnValues: {
            output: answerString,
            runId,
            threadId,
          },
          log: "",
          runId,
          threadId,
        };
      }
    } else if (run.status === "requires_action") {
      if (!this.asAgent) {
        return run.required_action?.submit_tool_outputs.tool_calls ?? [];
      }
      const actions: OpenAIAssistantAction[] = [];
      run.required_action?.submit_tool_outputs.tool_calls.forEach(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => {
          const functionCall = item.function;
          const args = JSON.parse(functionCall.arguments);
          actions.push({
            tool: functionCall.name,
            toolInput: args,
            toolCallId: item.id,
            log: "",
            runId,
            threadId,
          });
        }
      );
      return actions;
    }
    const runInfo = JSON.stringify(run, null, 2);
    throw new Error(
      `Unexpected run status ${run.status}.\nFull run info:\n\n${runInfo}`
    );
  }
}
