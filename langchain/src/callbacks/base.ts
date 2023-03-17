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

export type CallbackHandlerStartValues = Promise<Record<
  string,
  string | number
> | void>;
export type RunId = string | number;

abstract class BaseCallbackHandlerMethods {
  handleLLMStart?(
    llm: { name: string },
    prompts: string[],
    callerId?: RunId,
    verbose?: boolean
  ): CallbackHandlerStartValues;

  handleLLMNewToken?(
    token: string,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleLLMError?(
    err: Error,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleLLMEnd?(
    output: LLMResult,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleChainStart?(
    chain: { name: string },
    inputs: ChainValues,
    callerId?: RunId,
    verbose?: boolean
  ): CallbackHandlerStartValues;

  handleChainError?(
    err: Error,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleChainEnd?(
    outputs: ChainValues,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleToolStart?(
    tool: { name: string },
    input: string,
    callerId?: RunId,
    verbose?: boolean
  ): CallbackHandlerStartValues;

  handleToolError?(
    err: Error,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleToolEnd?(
    output: string,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleText?(
    text: string,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleAgentAction?(
    action: AgentAction,
    callerId?: RunId,
    verbose?: boolean
  ): Promise<void>;

  handleAgentEnd?(
    action: AgentFinish,
    runId?: RunId,
    verbose?: boolean
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

  constructor() {
    super();
    this.handlers = [];
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    callerId?: RunId,
    verbose?: boolean
  ): Promise<Record<string, string | number>> {
    const results = await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            return handler.handleLLMStart?.(llm, prompts, callerId);
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleLLMStart: ${err}`
            );
          }
        }
        return undefined;
      })
    ) as (undefined | Record<string, string | number>)[];
    return results.reduce((acc, cur) => ({ ...acc, ...cur }), {}) as Record<string, string | number>;
  }

  async handleLLMNewToken(
    token: string,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMNewToken?.(token, runId);
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
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMError?.(err, runId);
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
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleLLMEnd?.(output, runId);
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
    callerId?: RunId,
    verbose?: boolean
  ): Promise<Record<string, string | number>> {
    const results = await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            return handler.handleChainStart?.(chain, inputs, callerId);
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleChainStart: ${err}`
            );
          }
        }
        return undefined;
      })
    ) as (undefined | Record<string, string | number>)[];
    return results.reduce((acc, cur) => ({ ...acc, ...cur }), {}) as Record<string, string | number>;
  }

  async handleChainError(
    err: Error,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleChainError?.(err, runId);
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
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleChainEnd?.(output, runId);
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
    callerId?: RunId,
    verbose?: boolean
  ): Promise<Record<string, string | number>> {
    const results = await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            return handler.handleToolStart?.(tool, input, callerId);
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleToolStart: ${err}`
            );
          }
        }
        return undefined;
      })
    ) as (undefined | Record<string, string | number>)[];
    return results.reduce((acc, cur) => ({ ...acc, ...cur }), {}) as Record<string, string | number>;
  }

  async handleToolError(
    err: Error,
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleToolError?.(err, runId);
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
    runId?: RunId,
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
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (verbose || handler.alwaysVerbose) {
          try {
            await handler.handleText?.(text, runId);
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
    callerId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleAgentAction?.(action, callerId);
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
    runId?: RunId,
    verbose?: boolean
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent && (verbose || handler.alwaysVerbose)) {
          try {
            await handler.handleAgentEnd?.(action, runId);
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
