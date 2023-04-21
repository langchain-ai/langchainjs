import { v4 as uuidv4 } from "uuid";
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
  ): Promise<void> | void;

  handleLLMNewToken?(
    token: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleLLMError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleLLMEnd?(
    output: LLMResult,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleChainStart?(
    chain: { name: string },
    inputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleChainError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleToolStart?(
    tool: { name: string },
    input: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleToolError?(
    err: Error,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleToolEnd?(
    output: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleText?(
    text: string,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleAgentAction?(
    action: AgentAction,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;

  handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    parentRunId?: string
  ): Promise<void> | void;
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

  copy(): BaseCallbackHandler {
    return new (this.constructor as new (
      input?: BaseCallbackHandlerInput
    ) => BaseCallbackHandler)(this);
  }

  static fromMethods(methods: BaseCallbackHandlerMethods) {
    class Handler extends BaseCallbackHandler {
      name = uuidv4();

      constructor() {
        super();
        Object.assign(this, methods);
      }
    }
    return new Handler();
  }
}
