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
  alwaysVerbose?: boolean;
  ignoreLLM?: boolean;
  ignoreChain?: boolean;
  ignoreAgent?: boolean;
}

abstract class BaseCallbackHandlerMethods {
  handleLLMStart?(
    llm: { name: string },
    prompts: string[],
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void | string>;

  handleLLMNewToken?(
    token: string,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleLLMError?(
    err: Error,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleLLMEnd?(
    output: LLMResult,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleChainStart?(
    chain: { name: string },
    inputs: ChainValues,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void | string>;

  handleChainError?(
    err: Error,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleChainEnd?(
    outputs: ChainValues,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleToolStart?(
    tool: { name: string },
    input: string,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void | string>;

  handleToolError?(
    err: Error,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleToolEnd?(
    output: string,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleText?(
    text: string,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleAgentAction?(
    action: AgentAction,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;

  handleAgentEnd?(
    action: AgentFinish,
    runId: string,
    verbose?: boolean,
    parentRunId?: string
  ): Promise<void>;
}

export abstract class BaseCallbackHandler
  extends BaseCallbackHandlerMethods
  implements BaseCallbackHandlerInput
{
  alwaysVerbose = false;

  ignoreLLM = false;

  ignoreChain = false;

  ignoreAgent = false;

  constructor(input?: BaseCallbackHandlerInput) {
    super();
    if (input) {
      this.alwaysVerbose = input.alwaysVerbose ?? this.alwaysVerbose;
      this.ignoreLLM = input.ignoreLLM ?? this.ignoreLLM;
      this.ignoreChain = input.ignoreChain ?? this.ignoreChain;
      this.ignoreAgent = input.ignoreAgent ?? this.ignoreAgent;
    }
  }
}

export abstract class BaseCallbackManager extends BaseCallbackHandler {
  abstract addHandler(handler: BaseCallbackHandler): void;

  abstract removeHandler(handler: BaseCallbackHandler): void;

  abstract setHandlers(handlers: BaseCallbackHandler[]): void;

  setHandler(handler: BaseCallbackHandler): void {
    return this.setHandlers([handler]);
  }
}

export class CallbackManager extends BaseCallbackManager {
  handlers: BaseCallbackHandler[];

  private _currentRunId?: string;

  private readonly _parentRunId?: string;

  constructor(parentRunId?: string) {
    super();
    this.handlers = [];
    this._parentRunId = parentRunId;
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    runId: string = uuidv4(),
    verbose = false
  ): Promise<string> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMStart?.(
              llm,
              prompts,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleLLMStart: ${err}`
            );
          }
        }
      })
    );
    this._currentRunId = runId;
    return runId;
  }

  async handleLLMNewToken(
    token: string,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMNewToken?.(
              token,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleLLMNewToken: ${err}`
            );
          }
        }
      })
    );
  }

  async handleLLMError(
    err: Error,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMError?.(
              err,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleLLMError: ${err}`
            );
          }
        }
      })
    );
  }

  async handleLLMEnd(
    output: LLMResult,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMEnd?.(
              output,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleLLMEnd: ${err}`
            );
          }
        }
      })
    );
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    runId = uuidv4(),
    verbose = false
  ): Promise<string> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleChainStart?.(
              chain,
              inputs,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleChainStart: ${err}`
            );
          }
        }
      })
    );
    this._currentRunId = runId;
    return runId;
  }

  async handleChainError(
    err: Error,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleChainError?.(
              err,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleChainError: ${err}`
            );
          }
        }
      })
    );
  }

  async handleChainEnd(
    output: ChainValues,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleChainEnd?.(
              output,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleChainEnd: ${err}`
            );
          }
        }
      })
    );
  }

  async handleToolStart(
    tool: { name: string },
    input: string,
    runId = uuidv4(),
    verbose = false
  ): Promise<string> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleToolStart?.(
              tool,
              input,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleToolStart: ${err}`
            );
          }
        }
      })
    );
    this._currentRunId = runId;
    return runId;
  }

  async handleToolError(
    err: Error,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleToolError?.(
              err,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleToolError: ${err}`
            );
          }
        }
      })
    );
  }

  async handleToolEnd(
    output: string,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleToolEnd?.(output, runId);
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleToolEnd: ${err}`
            );
          }
        }
      })
    );
  }

  async handleText(
    text: string,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (verbose || handler.alwaysVerbose) {
          try {
            await handler.handleText?.(
              text,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleText: ${err}`
            );
          }
        }
      })
    );
  }

  async handleAgentAction(
    action: AgentAction,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleAgentAction?.(
              action,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleAgentAction: ${err}`
            );
          }
        }
      })
    );
  }

  async handleAgentEnd(
    action: AgentFinish,
    runId: string,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleAgentEnd?.(
              action,
              runId,
              undefined,
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleAgentEnd: ${err}`
            );
          }
        }
      })
    );
  }

  addHandler(handler: BaseCallbackHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: BaseCallbackHandler): void {
    this.handlers = this.handlers.filter((_handler) => _handler !== handler);
  }

  setHandlers(handlers: BaseCallbackHandler[]): void {
    this.handlers = handlers;
  }

  getChild(): CallbackManager {
    const manager = new CallbackManager(this._currentRunId);
    manager.setHandlers(this.handlers);
    return manager;
  }

  copy(additionalHandlers: BaseCallbackHandler[] = []): CallbackManager {
    const manager = new CallbackManager(this._parentRunId);
    manager.setHandlers([...this.handlers, ...additionalHandlers]);
    return manager;
  }

  static fromHandlers(handlers: BaseCallbackHandlerMethods) {
    class Handler extends BaseCallbackHandler {
      alwaysVerbose = true;

      constructor() {
        super();
        Object.assign(this, handlers);
      }
    }

    const manager = new this();
    manager.addHandler(new Handler());
    return manager;
  }
}

export class ConsoleCallbackHandler extends BaseCallbackHandler {
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
