import {
  AssistantCreateParams,
  ThreadCreateParams,
} from "openai/resources/beta/index";
import { OpenAI as OpenAIClient } from "openai";
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

export class OpenAIAssistant<
  RunInput extends Record<string, any>,
  RunOutput extends Record<string, any>
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "beta", "openai_assistant"];

  private client: OpenAIClient;

  assistantId: string;

  threadId: string;

  constructor(fields: {
    assistantId: string;
    threadId: string;
    client: OpenAIClient;
  }) {
    super();
    this.client = fields.client;
    this.assistantId = fields.assistantId;
    this.threadId = fields.threadId;
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
  async geRuntStep(runId: string, stepId: string): Promise<RunStep> {
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
    } while (response.status === "in_progress");
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
      ...input,
    });
    return response as unknown as RunOutput;
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
    options?: {
      threadId?: string;
      createThreadOptions?: ThreadCreateParams;
    }
  ): Promise<OpenAIAssistant<RunInput, RunOutput>> {
    const openai = new OpenAIClient();
    const assistant = await openai.beta.assistants.create(input);

    let threadId: string;
    if (!options?.threadId) {
      const thread = await openai.beta.threads.create({
        ...options?.createThreadOptions,
      });
      threadId = thread.id;
    } else {
      threadId = options.threadId;
    }

    return new this({
      assistantId: assistant.id,
      threadId,
      client: openai,
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
    options?: {
      threadId?: string;
      createThreadOptions?: ThreadCreateParams;
    }
  ): Promise<OpenAIAssistant<RunInput, RunOutput>> {
    const openai = new OpenAIClient();

    let threadId: string;
    if (!options?.threadId) {
      const thread = await openai.beta.threads.create({
        ...options?.createThreadOptions,
      });
      threadId = thread.id;
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
