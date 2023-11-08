import { type ClientOptions, OpenAI as OpenAIClient } from "openai";
import { Run } from "openai/resources/beta/threads/index";
import { AssistantCreateParams } from "openai/resources/beta/index.mjs";
import { RunStep } from "openai/resources/beta/threads/runs/index.mjs";
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
}

export class OpenAIAssistantRunnable<
  RunInput extends Record<string, any>,
  RunOutput extends OutputType
> extends Runnable<RunInput, RunOutput> {
  lc_namespace = ["langchain", "beta", "openai_assistant"];

  private client: OpenAIClient;

  assistantId: string;

  pollIntervalMs = 5000;

  asAgent = false;

  constructor(fields: OpenAIAssistantRunnableInput) {
    super();
    this.client = fields.client || new OpenAIClient(fields?.clientOptions);
    this.assistantId = fields.assistantId;
    this.asAgent = fields.asAgent ?? false;
  }

  static async create<
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
    });
  }

  async invoke(input: RunInput, _options?: RunnableConfig): Promise<RunOutput> {
    console.log("pre prep input", input);
    const parsedInput = await this._parseInput(input);
    console.log("invoking", parsedInput);
    let run: Run;
    if (!("threadId" in parsedInput)) {
      const thread = {
        messages: [
          {
            role: "user",
            content: parsedInput.content,
            file_ids: parsedInput.fileIds,
            metadata: parsedInput.messagesMetadata,
          },
        ],
        metadata: parsedInput.threadMetadata,
      };
      run = await this._createThreadAndRun({
        ...input,
        thread,
      });
    } else if (!("runId" in parsedInput)) {
      await this.client.beta.threads.messages.create(parsedInput.threadId, {
        content: parsedInput.content,
        role: "user",
        file_ids: parsedInput.file_ids,
        metadata: parsedInput.messagesMetadata,
      });
      run = await this._createRun(input);
    } else {
      console.log("submit outputs", parsedInput);
      run = await this.client.beta.threads.runs.submitToolOutputs(
        parsedInput.threadId,
        parsedInput.runId,
        {
          tool_outputs: parsedInput.toolOutputs,
        }
      );
    }

    return this._getResponse(run.id, run.thread_id) as unknown as RunOutput;
  }

  private async _parseInput(input: RunInput): Promise<RunInput> {
    let newInput;
    if (this.asAgent && input.steps.length > 0) {
      const lastAction = input.steps[input.steps.length - 1];
      const { action } = lastAction;
      const { runId, threadId } = action;
      const runSteps = await this._listRunSteps(runId, threadId);
      const toolCalls = this._getToolCallsFromSteps(runSteps);
      // map over tooCalls and filter out completed
      const requiresActionToolCalls = toolCalls.filter((tool) => {
        if (!tool.function.output) return true;
        return false;
      });
      // match requires actions tools with tools from input.steps
      const matchedToolCalls = requiresActionToolCalls.flatMap((toolCall) => {
        const castSteps = input.steps as {
          action: OpenAIAssistantAction;
          observation: string;
        }[];
        console.log("castSteps", castSteps);
        const matchedAction = castSteps.find(
          (step) => step.action.toolCallId === toolCall.id
        );
        return matchedAction ?? [];
      });
      const toolOutputs = matchedToolCalls.map((toolCall) => ({
        output: toolCall.observation,
        tool_call_id: toolCall.action.toolCallId,
      }));
      newInput = {
        toolOutputs,
        runId,
        threadId,
      };
    }
    return (newInput ?? input) as RunInput;
  }

  private async _listRunSteps(runId: string, threadId: string) {
    const runSteps = await this.client.beta.threads.runs.steps.list(
      threadId,
      runId,
      {
        order: "asc",
      }
    );
    return runSteps.data;
  }

  private _getToolCallsFromSteps(steps: RunStep[]) {
    const toolCalls = steps.flatMap((step) => {
      if (step.step_details.type !== "tool_calls") {
        return [];
      }
      const toolCall = step.step_details.tool_calls.flatMap((toolCall) =>
        toolCall.type === "function" ? toolCall : []
      );
      return toolCall;
    });

    return toolCalls;
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
