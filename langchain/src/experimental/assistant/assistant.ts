import {
  Assistant,
  AssistantCreateParams,
  ThreadCreateParams,
} from "openai/resources/beta/index";
import { ClientOptions, OpenAI as OpenAIClient } from "openai";
import {
  MessageCreateParams,
  MessageListParams,
  Run,
  Thread,
  ThreadMessage,
  ThreadMessagesPage,
} from "openai/resources/beta/threads/index";
import {
  RunStep,
  RunStepsPage,
  StepListParams,
} from "openai/resources/beta/threads/runs/index";
import { Runnable } from "../../schema/runnable/base.js";

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

interface FromAssistantOptions {
  threadId?: string;
  createThreadOptions?: ThreadCreateParams;
  functions?: Record<string, (...args: any[]) => any>;
  clientOptions?: ClientOptions;
}

export class OpenAIAssistant<
  RunInput extends Record<string, any>,
  RunOutput extends Record<string, any>
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "beta", "openai_assistant"];

  /**
   * @TODO which category should 'canceling' be in?
   */
  private nonFinishedStatuses = ["queued", "in_progress", "requires_action"];

  private finishedStatuses = ["canceled", "failed", "completed", "expired"];

  private client: OpenAIClient;

  assistantId: string;

  threadId: string;

  functions: Record<string, (...args: any[]) => any> | null;

  constructor(fields: {
    assistantId: string;
    threadId: string;
    client: OpenAIClient;
    functions?: Record<string, (...args: any[]) => any>;
  }) {
    super();
    this.client = fields.client;
    this.assistantId = fields.assistantId;
    this.threadId = fields.threadId;
    this.functions = fields.functions || null;
  }

  /**
   * Submit tool outputs for an assistant run.
   *
   * @param {string} runId
   * @param {Array<{ toolCallId: string; output: any }>} toolOutputs
   * @returns {Promise<Run>} The updated run object.
   */
  async submitOutputs(
    runId: string,
    toolOutputs: Array<{ toolCallId: string; output: any }>
  ): Promise<Run> {
    const run = await this.client.beta.threads.runs.submitToolOutputs(
      this.threadId,
      runId,
      {
        tool_outputs: toolOutputs.map((output) => ({
          tool_call_id: output.toolCallId,
          output: output.output,
        })),
      }
    );

    return run;
  }

  /**
   * List all steps in the run.
   *
   * @param {string} runId The run ID to query steps on.
   * @param {StepListParams} input Optional input to filter steps.
   * @returns {Promise<RunStepsPage>} A class instance containing the steps and page cursor.
   */
  async listRunSteps(
    runId: string,
    input?: StepListParams
  ): Promise<RunStepsPage> {
    const steps = await this.client.beta.threads.runs.steps.list(
      this.threadId,
      runId,
      input
    );
    return steps;
  }

  /**
   * Get a run's step by ID.
   *
   * @param {string} runId The run ID to query steps on.
   * @param {string} stepId The step ID to retrieve.
   * @returns {Promise<RunStep>} The step object.
   */
  async getRuntStep(runId: string, stepId: string): Promise<RunStep> {
    const step = await this.client.beta.threads.runs.steps.retrieve(
      this.threadId,
      runId,
      stepId
    );
    return step;
  }

  /**
   * List all messages in the thread.
   *
   * @param {MessageListParams} input Optional input to filter messages.
   * @returns {Promise<ThreadMessagesPage>} A class instance containing the messages and page cursor.
   */
  async listMessages(input?: MessageListParams): Promise<ThreadMessagesPage> {
    const messages = await this.client.beta.threads.messages.list(
      this.threadId,
      input
    );
    return messages;
  }

  /**
   * Add a new message to the thread.
   *
   * @param {MessageCreateParams} input
   * @returns {Promise<ThreadMessage>} The created message.
   */
  async addMessage(input: MessageCreateParams): Promise<ThreadMessage> {
    const response = await this.client.beta.threads.messages.create(
      this.threadId,
      input
    );
    return response;
  }

  /**
   * Handles calling the functions an assistant requested with the given function arguments.
   * The function results are then submitted to the assistant via the `submitOutputs` method.
   * 
   * @param {Run} run 
   */
  private async handleToolCall(run: Run): Promise<void> {
    const toolCalls = run.required_action?.submit_tool_outputs.tool_calls.map(
      (tool) => tool
    );
    if (!toolCalls) {
      throw new Error("No tool calls found");
    }
    if (!this.functions) {
      throw new Error("No functions found");
    }
    const toolResults = toolCalls.map((tool) => {
      const output = this.functions?.[tool.function.name](
        tool.function.arguments
      );
      if (!output) {
        throw new Error(
          `No result returned from function: ${tool.function.name}`
        );
      }
      return {
        toolCallId: tool.id,
        output,
      };
    });
    await this.submitOutputs(run.id, toolResults);
  }

  /**
   * Loop until the run status is no longer one of `nonFinishedStatuses` and handle the tool calls.
   * 
   * @param {string} runId 
   */
  private async waitForToolCalls(runId: string): Promise<void> {
    let response: Run;
    do {
      response = await this.client.beta.threads.runs.retrieve(
        this.threadId,
        runId
      );
      if (response.status === "requires_action") {
        await this.handleToolCall(response);
      }
    } while (this.nonFinishedStatuses.includes(response.status));
  }

  /**
   * Stream run object until status is completed.
   *
   * @param {string} runId The run ID to stream.
   * @param {number} intervalMs The MS interval at which to stream. Defaults to 1000ms.
   * @returns {Promise<Run>}
   */
  async *streamRun(runId: string, intervalMs = 1000): AsyncGenerator<Run> {
    let response;
    do {
      response = await this.client.beta.threads.runs.retrieve(
        this.threadId,
        runId
      );
      if (response.status === "in_progress") {
        await sleep(intervalMs);
      }
      yield response;
    } while (!this.finishedStatuses.includes(response.status));
  }

  /**
   * Get the thread object based on the thread ID the class was initialized with.
   *
   * @returns {Promise<Thread>} The thread object.
   */
  async getThread(): Promise<Thread> {
    const thread = await this.client.beta.threads.retrieve(this.threadId);
    return thread;
  }

  async invoke(input: RunInput): Promise<RunOutput> {
    const response = await this.client.beta.threads.runs.create(this.threadId, {
      assistant_id: this.assistantId,
      ...Object.fromEntries(
        Object.entries(input).filter(([k]) => k !== "handleToolActions")
      ),
    });

    if (
      "shouldHandleToolActions" in input &&
      input.handleToolActions === true
    ) {
      await this.waitForToolCalls(response.id);
    }

    return response as unknown as RunOutput;
  }

  private static async createThread(
    client: OpenAIClient,
    options?: ThreadCreateParams
  ) {
    const thread = await client.beta.threads.create({
      ...options,
    });
    return thread.id;
  }

  /**
   * Static method used for initializing an assistant. Optional inputs include a thread ID and thread create options.
   * If no threadId is provided one will be created.
   *
   * @param input
   * @param options
   * @returns {Promise<OpenAIAssistant<RunInput, RunOutput>>} The initialized assistant.
   */
  static async fromAssistant<
    RunInput extends Record<string, any>,
    RunOutput extends Record<string, any>
  >(
    input: AssistantCreateParams,
    options?: FromAssistantOptions
  ): Promise<OpenAIAssistant<RunInput, RunOutput>> {
    const openai = new OpenAIClient(options?.clientOptions);
    const assistant = await openai.beta.assistants.create(input);

    let threadId: string;
    if (!options?.threadId) {
      threadId = await this.createThread(openai, options?.createThreadOptions);
    } else {
      threadId = options.threadId;
    }

    return new this({
      assistantId: assistant.id,
      threadId,
      client: openai,
      functions: options?.functions,
    });
  }

  /**
   * Static method used for initializing an assistant from an existing assistant ID.
   *
   * @param assistantId
   * @param options
   * @returns {Promise<OpenAIAssistant<RunInput, RunOutput>>}
   */
  static async fromExistingAssistant<
    RunInput extends Record<string, any>,
    RunOutput extends Record<string, any>
  >(
    assistantId: string,
    options?: FromAssistantOptions
  ): Promise<OpenAIAssistant<RunInput, RunOutput>> {
    const openai = new OpenAIClient(options?.clientOptions);

    let threadId: string;
    if (!options?.threadId) {
      threadId = await this.createThread(openai, options?.createThreadOptions);
    } else {
      threadId = options.threadId;
    }

    return new this({
      assistantId,
      threadId,
      client: openai,
    });
  }
}
