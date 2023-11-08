import {
  ThreadMessage,
  RequiredActionFunctionToolCall,
} from "openai/resources/beta/threads/index";
import { AssistantCreateParams } from "openai/resources/beta/index";
import { AgentFinish, AgentAction } from "../../schema/index.js";

interface OpenAIAssistantFinishInput {
  returnValues: Record<string, any>;

  log: string;

  runId: string;

  threadId: string;
}

export class OpenAIAssistantFinish implements AgentFinish {
  returnValues: Record<string, any>;

  log: string;

  runId: string;

  threadId: string;

  constructor(fields: OpenAIAssistantFinishInput) {
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

export type OutputType =
  | OpenAIAssistantAction[]
  | OpenAIAssistantFinish
  | ThreadMessage[]
  | RequiredActionFunctionToolCall[];

export type OpenAIToolType = Array<
  | AssistantCreateParams.AssistantToolsCode
  | AssistantCreateParams.AssistantToolsRetrieval
  | AssistantCreateParams.AssistantToolsFunction
>;
