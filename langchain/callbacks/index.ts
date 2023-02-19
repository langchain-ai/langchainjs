import CallableInstance from "callable-instance";
import { AgentAction, AgentFinish } from "../agents";
import { ChainValues } from "../chains";
import { LLMResult, LLMCallbackManager } from "../llms";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Error = any;

type LLMEvent = (
  | { event: "llm.start"; llm: { name: string }; prompts: string[] }
  | { event: "llm.error"; err: Error }
  | { event: "llm.end"; output: LLMResult }
  | { event: "llm.new_token"; token: string }
) & { event: `llm.${string}` };

type ChainEvent = (
  | { event: "chain.start"; chain: { name: string }; inputs: ChainValues }
  | { event: "chain.error"; err: Error }
  | { event: "chain.end"; output: ChainValues }
  | { event: "chain.text"; text: string }
) & { event: `chain.${string}` };

type AgentEvent = (
  | { event: "agent.tool_start"; tool: { name: string }; action: AgentAction }
  | { event: "agent.tool_end"; output: string }
  | { event: "agent.tool_error"; err: Error }
  | { event: "agent.end"; action: AgentFinish }
) & { event: `agent.${string}` };

type CallbackEvent = LLMEvent | ChainEvent | AgentEvent;

type CallbackKwargs = {
  verbose?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

type EventType = CallbackEvent["event"] extends `${infer U}.${string}`
  ? U
  : never;

export type CallbackHandler = (
  event: CallbackEvent,
  args?: CallbackKwargs
) => Promise<void> | void;

interface PerEventCallbackHandler {
  handleLLMStart?: (
    llm: { name: string },
    prompts: string[],
    verbose?: boolean
  ) => void;
  handleLLMNewToken?: (token: string, verbose?: boolean) => void;
  handleLLMError?: (err: string, verbose?: boolean) => void;
  handleLLMEnd?: (output: LLMResult, verbose?: boolean) => void;

  handleChainStart?: (
    chain: { name: string },
    inputs: ChainValues,
    verbose?: boolean
  ) => void;
  handleChainError?: (err: Error, verbose?: boolean) => void;
  handleChainEnd?: (output: ChainValues, verbose?: boolean) => void;

  handleToolStart?: (
    tool: { name: string },
    action: AgentAction,
    verbose?: boolean
  ) => void;
  handleToolError?: (err: Error, verbose?: boolean) => void;
  handleToolEnd?: (output: string, verbose?: boolean) => void;
  handleAgentEnd?: (action: AgentFinish, verbose?: boolean) => void;
}

export const createFromHandlers =
  (handlers: PerEventCallbackHandler): CallbackHandler =>
  (event, args) => {
    switch (event.event) {
      case "llm.start":
        return handlers.handleLLMStart?.(
          event.llm,
          event.prompts,
          args?.verbose
        );
      case "llm.new_token":
        return handlers.handleLLMNewToken?.(event.token, args?.verbose);
      case "llm.error":
        return handlers.handleLLMError?.(event.err, args?.verbose);
      case "llm.end":
        return handlers.handleLLMEnd?.(event.output, args?.verbose);
      case "chain.start":
        return handlers.handleChainStart?.(
          event.chain,
          event.inputs,
          args?.verbose
        );
      case "chain.error":
        return handlers.handleChainError?.(event.err, args?.verbose);
      case "chain.end":
        return handlers.handleChainEnd?.(event.output, args?.verbose);
      case "agent.tool_start":
        return handlers.handleToolStart?.(
          event.tool,
          event.action,
          args?.verbose
        );
      case "agent.tool_end":
        return handlers.handleToolEnd?.(event.output, args?.verbose);
      case "agent.tool_error":
        return handlers.handleToolError?.(event.err, args?.verbose);
      case "agent.end":
        return handlers.handleAgentEnd?.(event.action, args?.verbose);
      default:
        return undefined;
    }
  };

export abstract class BaseCallbackHandler extends CallableInstance<
  Parameters<CallbackHandler>,
  ReturnType<CallbackHandler>
> {
  constructor() {
    super("handle");
  }

  abstract handle(
    event: CallbackEvent,
    args?: CallbackKwargs
  ): Promise<void> | void;
}

export interface BaseCallbackManager extends BaseCallbackHandler {
  addHandler: (handler: CallbackHandler) => void;
  removeHandler: (handler: CallbackHandler) => void;
  setHandlers: (handlers: CallbackHandler[]) => void;
}

const isEventType = <T extends string>(
  prefix: T,
  event: CallbackEvent
): event is CallbackEvent & { event: `${T}.${string}` } =>
  event.event.startsWith(prefix);

export abstract class EventTypeCallbackHandler extends BaseCallbackHandler {
  handle(event: CallbackEvent, args?: CallbackKwargs) {
    if (isEventType("llm", event)) {
      return this.handleLLMEvent(event, args);
    }

    if (isEventType("chain", event)) {
      return this.handleChainEvent(event, args);
    }
    if (isEventType("agent", event)) {
      return this.handleAgentEvent(event, args);
    }

    throw new Error(`Unknown event type: ${(event as CallbackEvent).event}`);
  }

  abstract handleLLMEvent(
    event: LLMEvent,
    args?: CallbackKwargs
  ): Promise<void> | void;

  abstract handleChainEvent(
    event: ChainEvent,
    args?: CallbackKwargs
  ): Promise<void> | void;

  abstract handleAgentEvent(
    event: AgentEvent,
    args?: CallbackKwargs
  ): Promise<void> | void;
}

export class CallbackManager
  extends BaseCallbackHandler
  implements BaseCallbackManager
{
  handlers: CallbackHandler[] = [];

  ignoredEventTypes: EventType[] = [];

  alwaysVerbose = false;

  constructor(
    handlers: CallbackHandler[],
    ignoredEventTypes?: EventType[],
    alwaysVerbose = false
  ) {
    super();
    this.handlers = handlers;
    this.ignoredEventTypes = ignoredEventTypes ?? [];
    this.alwaysVerbose = alwaysVerbose ?? false;
  }

  async handle(event: CallbackEvent, args?: CallbackKwargs) {
    const isVerbose = this.alwaysVerbose || Boolean(args?.verbose);
    const eventType = event.event.split(".")[0] as EventType;
    if (isVerbose && !this.ignoredEventTypes.includes(eventType)) {
      for (let i = 0; i < this.handlers.length; i += 1) {
        await this.handlers[i](event, args);
      }
    }
  }

  static fromLegacyLLMManager(manager: LLMCallbackManager): CallbackManager {
    return new CallbackManager([
      createFromHandlers({
        handleLLMStart: manager.handleStart,
        handleLLMNewToken: manager.handleNewToken,
        handleLLMError: manager.handleError,
        handleLLMEnd: manager.handleEnd,
      }),
    ]);
  }

  addHandler(handler: CallbackHandler) {
    this.handlers.push(handler);
  }

  removeHandler(handler: CallbackHandler) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  setHandlers(handlers: CallbackHandler[]) {
    this.handlers = handlers;
  }
}

export class ConsoleCallbackHandler extends EventTypeCallbackHandler {
  handleLLMEvent() {
    // Ignore LLM Events.
  }

  handleChainEvent(event: ChainEvent) {
    if (event.event === "chain.start") {
      console.log(`\n\n> Entering new ${event.chain.name} chain...`);
    } else if (event.event === "chain.end") {
      console.log(`\n> Finished chain.`);
    } else if (event.event === "chain.text") {
      console.log(event.text);
    }
  }

  handleAgentEvent(
    event: AgentEvent,
    args?: { verbose?: boolean; observationPrefix?: string; llmPrefix?: string }
  ) {
    if (event.event === "agent.tool_start" || event.event === "agent.end") {
      console.log(event.action.log);
    } else if (event.event === "agent.tool_end") {
      console.log(`\n${args?.observationPrefix ?? ""}`);
      console.log(event.output);
      console.log(`\n${args?.llmPrefix ?? ""}`);
    }
  }
}

export const defaultCallbackManager: BaseCallbackManager = new CallbackManager(
  []
);

export const setDefaultCallbackManager = (
  callbackManager: BaseCallbackManager
) => {
  defaultCallbackManager.setHandlers([callbackManager]);
};
