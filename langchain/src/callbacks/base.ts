import {
  AgentAction,
  AgentFinish,
  ChainValues,
  LLMResult,
} from "../schema/index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Error = any;

export interface BaseCallbackHandlerInput {
  ignoreLLM?: boolean;
  ignoreChain?: boolean;
  ignoreAgent?: boolean;
}

export abstract class BaseCallbackHandlerMethods {
  handleLLMStart?(
    llm: { name: string },
    prompts: string[],
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleLLMNewToken?(
    token: string,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleLLMError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleChainStart?(
    chain: { name: string },
    inputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleChainError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleToolStart?(
    tool: { name: string },
    input: string,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleToolError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleToolEnd?(
    output: string,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleText?(text: string, runId: string, parentRunId?: string): Promise<void>;

  handleAgentAction?(
    action: AgentAction,
    runId: string,
    parentRunId?: string
  ): Promise<void>;

  handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string
  ): Promise<void>;
}

export abstract class BaseCallbackHandler
  extends BaseCallbackHandlerMethods
  implements BaseCallbackHandlerInput
{
  abstract name: string;

  ignoreLLM = false;

  ignoreChain = false;

  ignoreAgent = false;

  constructor(input?: BaseCallbackHandlerInput) {
    super();
    if (input) {
      this.ignoreLLM = input.ignoreLLM ?? this.ignoreLLM;
      this.ignoreChain = input.ignoreChain ?? this.ignoreChain;
      this.ignoreAgent = input.ignoreAgent ?? this.ignoreAgent;
    }
  }
}

export class ConsoleCallbackHandler extends BaseCallbackHandler {
  name = "console_callback_handler";

  async handleChainStart(chain: { name: string }) {
    console.log(`Entering new ${chain.name} chain...`);
  }

  async handleChainEnd(_output: ChainValues) {
    console.log("Finished chain.");
  }

  async handleAgentAction(action: AgentAction) {
    console.log(action.log);
  }

  async handleToolEnd(output: string) {
    console.log(output);
  }

  async handleText(text: string) {
    console.log(text);
  }

  async handleAgentEnd(action: AgentFinish) {
    console.log(action.log);
  }
}
