import { OpenAI as OpenAIClient } from "openai";
import {
  RequiredActionFunctionToolCall,
  Run,
  ThreadMessage,
} from "openai/resources/beta/threads/index";
import { Runnable } from "../../schema/runnable/base.js";
import { sleep } from "../../util/time.js";
import { RunnableConfig } from "../../schema/runnable/config.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

interface OpenAIAssistantFinishInput<RunInput extends Record<string, any>> {
  returnValues: RunInput;

  log: string;

  runId: string;

  threadId: string;
}

class OpenAIAssistantFinish<RunInput extends Record<string, any>>
  implements AgentFinish
{
  returnValues: RunInput;

  log: string;

  runId: string;

  threadId: string;

  constructor(fields: OpenAIAssistantFinishInput<RunInput>) {
    this.returnValues = fields.returnValues;
    this.log = fields.log;
    this.runId = fields.runId;
    this.threadId = fields.threadId;
  }
}

interface OpenAIAssistantActionInput {
  tool: string;

  toolInput: string;

  log: string;

  toolCallId: string;

  runId: string;

  threadId: string;
}

class OpenAIAssistantAction implements AgentAction {
  tool: string;

  toolInput: string;

  log: string;

  toolCallId: string;

  runId: string;

  threadId: string;

  constructor(fields: OpenAIAssistantActionInput) {
    this.tool = fields.tool;
    this.toolInput = fields.toolInput;
    this.log = fields.log;
    this.toolCallId = fields.toolCallId;
    this.runId = fields.runId;
    this.threadId = fields.threadId;
  }
}

type OutputType<RunInput extends Record<string, any>> =
  | OpenAIAssistantAction[]
  | OpenAIAssistantFinish<RunInput>
  | ThreadMessage[]
  | RequiredActionFunctionToolCall[];

export class OpenAIAssistantRunnable<
  RunInput extends Record<string, any>,
  RunOutput extends OutputType<RunInput>
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "beta", "openai_assistant"];

  private client: OpenAIClient;

  assistantId: string;

  pollIntervalMs = 1000;

  asAgent = false;

  constructor(fields: { client: OpenAIClient; assistantId: string }) {
    super();
    this.client = fields.client || new OpenAIClient();
    this.assistantId = fields.assistantId;
  }

  static async create<
    RunInput extends Record<string, any>,
    RunOutput extends OutputType<RunInput>
  >(
    name: string,
    instructions: string,
    tools: any,
    model: string,
    client?: OpenAIClient
  ) {
    const oaiClient = client ?? new OpenAIClient();
    const assistant = await oaiClient.beta.assistants.create({
      name,
      instructions,
      tools,
      model,
    });

    return new this<RunInput, RunOutput>({
      client: oaiClient,
      assistantId: assistant.id,
    });
  }

  async invoke(input: RunInput, _options?: RunnableConfig): Promise<RunOutput> {
    const parsedInput = this._parseInput(input);
    let run: Run;
    if (!("threadId" in parsedInput)) {
      run = await this._createThreadAndRun(input);
      await this.client.beta.threads.messages.create(run.thread_id, {
        content: parsedInput.content,
        role: "user",
        file_ids: parsedInput.file_ids,
        metadata: parsedInput.metadata,
      });
    } else if (!("runId" in parsedInput)) {
      await this.client.beta.threads.messages.create(parsedInput.threadId, {
        content: parsedInput.content,
        role: "user",
        file_ids: parsedInput.file_ids,
        metadata: parsedInput.metadata,
      });
      run = await this._createRun(input);
    } else {
      run = await this.client.beta.threads.runs.submitToolOutputs(
        parsedInput.threadId,
        parsedInput.runId,
        parsedInput.toolOutputs
      );
    }

    return this._getResponse(run.id, run.thread_id) as unknown as RunOutput;
  }

  private _parseInput(input: RunInput): RunInput {
    let newInput = {};
    if (this.asAgent && input.intermediate_steps) {
      const lastStep =
        input.intermediate_steps[input.intermediate_steps.length - 1];
      const [lastAction, lastOutput] = lastStep;
      newInput = {
        tool_outputs: [
          { output: lastOutput, tool_call_id: lastAction.tool_call_id },
        ],
        run_id: lastAction.run_id,
        thread_id: lastAction.thread_id,
      };
    }
    return (newInput as RunInput) ?? input;
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

  private async _createThreadAndRun({
    instructions,
    model,
    tools,
    thread,
    metadata,
  }: RunInput) {
    const run = this.client.beta.threads.createAndRun({
      assistant_id: this.assistantId,
      instructions,
      model,
      tools,
      thread,
      metadata,
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
  ): Promise<OutputType<RunInput>> {
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

        return new OpenAIAssistantFinish<RunInput>({
          returnValues: {
            output: answerString,
          } as unknown as RunInput,
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
      console.log(run.required_action.submit_tool_outputs.tool_calls);
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
