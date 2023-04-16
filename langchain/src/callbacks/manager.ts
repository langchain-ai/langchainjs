import { v4 as uuidv4 } from "uuid";
import {
  AgentAction,
  AgentFinish,
  ChainValues,
  LLMResult,
} from "../schema/index.js";
import { BaseCallbackHandler, BaseCallbackHandlerMethods } from "./base.js";

type BaseCallbackManagerMethods = {
  [K in keyof BaseCallbackHandlerMethods]?: (
    ...args: Parameters<Required<BaseCallbackHandlerMethods>[K]>
  ) => Promise<unknown>;
};

export abstract class BaseCallbackManager {
  abstract addHandler(handler: BaseCallbackHandler): void;

  abstract removeHandler(handler: BaseCallbackHandler): void;

  abstract setHandlers(handlers: BaseCallbackHandler[]): void;

  setHandler(handler: BaseCallbackHandler): void {
    return this.setHandlers([handler]);
  }
}

export class CallbackManagerForLLMRun {
  constructor(
    private handlers: BaseCallbackHandler[],
    private _currentRunId: string,
    private _parentRunId?: string
  ) {}

  async handleLLMNewToken(token: string): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM) {
          try {
            await handler.handleLLMNewToken?.(
              token,
              this._currentRunId ?? uuidv4(),
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

  async handleLLMError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM) {
          try {
            await handler.handleLLMError?.(
              err,
              this._currentRunId ?? uuidv4(),
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

  async handleLLMEnd(output: LLMResult): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM) {
          try {
            await handler.handleLLMEnd?.(
              output,
              this._currentRunId ?? uuidv4(),
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
}

export class CallbackManager
  extends BaseCallbackManager
  implements BaseCallbackManagerMethods
{
  handlers: BaseCallbackHandler[];

  name = "callback_manager";

  // TODO remove
  private _currentRunId?: string;

  private readonly _parentRunId?: string;

  constructor(currentRunId?: string, parentRunId?: string) {
    super();
    this.handlers = [];
    this._currentRunId = currentRunId;
    this._parentRunId = parentRunId;
  }

  // TODO remove
  get currentRunId(): string | undefined {
    return this._currentRunId;
  }

  // TODO remove
  // needed to avoid ESLint no-param-reassign error
  setCurrentRunId(runId: string | undefined) {
    this._currentRunId = runId;
  }

  async handleLLMStart(
    llm: { name: string },
    prompts: string[],
    runId: string = uuidv4()
  ): Promise<CallbackManagerForLLMRun> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreLLM) {
          try {
            await handler.handleLLMStart?.(
              llm,
              prompts,
              runId,
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
    return new CallbackManagerForLLMRun(
      this.handlers,
      runId,
      this._parentRunId
    );
  }

  async handleChainStart(
    chain: { name: string },
    inputs: ChainValues,
    runId = uuidv4()
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain) {
          try {
            await handler.handleChainStart?.(
              chain,
              inputs,
              runId,
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
  }

  async handleChainError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain) {
          try {
            await handler.handleChainError?.(
              err,
              this._currentRunId ?? uuidv4(),
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

  async handleChainEnd(output: ChainValues): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreChain) {
          try {
            await handler.handleChainEnd?.(
              output,
              this._currentRunId ?? uuidv4(),
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
    runId = uuidv4()
  ): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent) {
          try {
            await handler.handleToolStart?.(
              tool,
              input,
              runId,
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
  }

  async handleToolError(err: Error | unknown): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent) {
          try {
            await handler.handleToolError?.(
              err,
              this._currentRunId ?? uuidv4(),
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

  async handleToolEnd(output: string): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent) {
          try {
            await handler.handleToolEnd?.(
              output,
              this._currentRunId ?? uuidv4(),
              this._parentRunId
            );
          } catch (err) {
            console.error(
              `Error in handler ${handler.constructor.name}, handleToolEnd: ${err}`
            );
          }
        }
      })
    );
  }

  async handleText(text: string): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        try {
          await handler.handleText?.(
            text,
            this._currentRunId ?? uuidv4(),
            this._parentRunId
          );
        } catch (err) {
          console.error(
            `Error in handler ${handler.constructor.name}, handleText: ${err}`
          );
        }
      })
    );
  }

  async handleAgentAction(action: AgentAction): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent) {
          try {
            await handler.handleAgentAction?.(
              action,
              this._currentRunId ?? uuidv4(),
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

  async handleAgentEnd(action: AgentFinish): Promise<void> {
    await Promise.all(
      this.handlers.map(async (handler) => {
        if (!handler.ignoreAgent) {
          try {
            await handler.handleAgentEnd?.(
              action,
              this._currentRunId ?? uuidv4(),
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
    const manager = new CallbackManager(undefined, this._currentRunId);
    manager.setHandlers(this.handlers);
    return manager;
  }

  copy(additionalHandlers: BaseCallbackHandler[] = []): CallbackManager {
    const manager = new CallbackManager(this._currentRunId, this._parentRunId);
    manager.setHandlers([...this.handlers, ...additionalHandlers]);
    return manager;
  }

  static fromHandlers(handlers: BaseCallbackHandlerMethods) {
    class Handler extends BaseCallbackHandler {
      name = "handler";

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
