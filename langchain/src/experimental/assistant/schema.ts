import {
  ThreadMessage,
  RequiredActionFunctionToolCall,
} from "openai/resources/beta/threads/index.mjs";
import { AgentFinish, AgentAction } from "../../schema/index.js";

interface OpenAIAssistantFinishInput<RunInput extends Record<string, any>> {
  returnValues: RunInput;

  log: string;

  runId: string;

  threadId: string;
}

export class OpenAIAssistantFinish<RunInput extends Record<string, any>>
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

export class OpenAIAssistantAction implements AgentAction {
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

export type OutputType<RunInput extends Record<string, any>> =
  | OpenAIAssistantAction[]
  | OpenAIAssistantFinish<RunInput>
  | ThreadMessage[]
  | RequiredActionFunctionToolCall[];
