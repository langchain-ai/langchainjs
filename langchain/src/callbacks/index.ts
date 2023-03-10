import { AgentAction, AgentFinish } from "../agents/index.js";
import { ChainValues } from "../chains/index.js";
import { LLMResult, LLMCallbackManager } from "../schema/index.js";


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Error = any;

// type LLMEvent = (
//     | { event: "llm.start"; serialized: { name: string }; prompts: string[] }
//     | { event: "llm.error"; err: Error }
//     | { event: "llm.end"; response: LLMResult }
//     | { event: "llm.new_token"; token: string }
//     );
//
// type ChainEvent = (
//     | { event: "chain.start"; serialized: { name: string }; inputs: ChainValues }
//     | { event: "chain.error"; err: Error }
//     | { event: "chain.end"; outputs: ChainValues }
//     );
//
// type TextEvent = {event: "text"; text: string };
//
// type ToolEvent = (
//     | { event: "tool.start"; tool: { name: string }; input: string }
//     | { event: "tool.end"; output: string }
//     | { event: "tool.error"; err: Error }
//     );
//
// type AgentEvent = (
//     | { event: "agent.action"; action: AgentAction }
//     | { event: "agent.finish"; finish: AgentFinish }
//     );

// type CallbackEvent = LLMEvent | ChainEvent | AgentEvent | TextEvent | ToolEvent;

type CallbackKwargs = {
    verbose?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
} & Record<string, any>;

export abstract class BaseCallbackHandler {
    abstract handleLLMStart(
        llm: { name: string },
        prompts: string[],
        verbose?: boolean
    ): Promise<void>;
    abstract handleLLMNewToken(token: string, verbose?: boolean): Promise<void>;
    abstract handleLLMError(err: string, verbose?: boolean): Promise<void>;
    abstract handleLLMEnd(output: LLMResult, verbose?: boolean): Promise<void>;

    abstract handleChainStart(
        chain: { name: string },
        inputs: ChainValues,
        verbose?: boolean
    ): Promise<void>;
    abstract handleChainError(err: Error, verbose?: boolean): Promise<void>;
    abstract handleChainEnd(output: ChainValues, verbose?: boolean): Promise<void>;

    abstract handleToolStart(
        tool: { name: string },
        action: AgentAction,
        verbose?: boolean
    ): Promise<void>;
    abstract handleToolError(err: Error, verbose?: boolean): Promise<void>;
    abstract handleToolEnd(output: string, verbose?: boolean): Promise<void>;
    abstract handleAgentEnd(action: AgentFinish, verbose?: boolean): Promise<void>;
}

export abstract class BaseCallbackManager extends BaseCallbackHandler {

    abstract addHandler(handler: BaseCallbackHandler): Promise<void>;
    abstract removeHandler(handler: BaseCallbackHandler): Promise<void>;
    abstract setHandlers(handlers: BaseCallbackHandler[]): Promise<void>;
    setHandler(handler: BaseCallbackHandler): Promise<void> {
        return this.setHandlers([handler]);
    }
}

class CallbackManager extends BaseCallbackManager {
    handlers: BaseCallbackHandler[] = [];

    async handleLLMStart(
        llm: { name: string },
        prompts: string[],
        verbose?: boolean
    ): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleLLMStart(llm, prompts, verbose);
        }
    }
    async handleLLMNewToken(token: string, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleLLMNewToken(token, verbose);
        }
    }
    async handleLLMError(err: string, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleLLMError(err, verbose);
        }
    }
    async handleLLMEnd(output: LLMResult, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleLLMEnd(output, verbose);
        }
    }

    async handleChainStart(
        chain: { name: string },
        inputs: ChainValues,
        verbose?: boolean
    ): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleChainStart(chain, inputs, verbose);
        }
    }
    async handleChainError(err: Error, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleChainError(err, verbose);
        }
    }
    async handleChainEnd(output: ChainValues, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleChainEnd(output, verbose);
        }
    }

    async handleToolStart(
        tool: { name: string },
        action: AgentAction,
        verbose?: boolean
    ): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleToolStart(tool, action, verbose);
        }
    }
    async handleToolError(err: Error, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleToolError(err, verbose);
        }
    }
    async handleToolEnd(output: string, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleToolEnd(output, verbose);
        }
    }
    async handleAgentEnd(action: AgentFinish, verbose?: boolean): Promise<void> {
        for (const handler of this.handlers) {
            await handler.handleAgentEnd(action, verbose);
        }
    }

    async addHandler(handler: BaseCallbackHandler): Promise<void> {
        this.handlers.push(handler);
    }
    async removeHandler(handler: BaseCallbackHandler): Promise<void> {
        this.handlers = this.handlers.filter((_handler) => _handler !== handler);
    }
    async setHandlers(handlers: BaseCallbackHandler[]): Promise<void> {
        this.handlers = handlers;
    }
}

export class StdOutCallbackHandler extends BaseCallbackHandler {
    async handleLLMStart(
        llm: { name: string },
        prompts: string[],
        verbose?: boolean
    ): Promise<void> {
        pass
    }
    async handleLLMNewToken(token: string, verbose?: boolean): Promise<void>;
    async handleLLMError(err: string, verbose?: boolean): Promise<void>;
    async handleLLMEnd(output: LLMResult, verbose?: boolean): Promise<void>;

    async handleChainStart(
        chain: { name: string },
        inputs: ChainValues,
        verbose?: boolean
    ): Promise<void>;
    async handleChainError(err: Error, verbose?: boolean): Promise<void>;
    async handleChainEnd(output: ChainValues, verbose?: boolean): Promise<void>;

    async handleToolStart(
        tool: { name: string },
        action: AgentAction,
        verbose?: boolean
    ): Promise<void>;
    async handleToolError(err: Error, verbose?: boolean): Promise<void>;
    async handleToolEnd(output: string, verbose?: boolean): Promise<void>;
    async handleAgentEnd(action: AgentFinish, verbose?: boolean): Promise<void>;
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

export interface BaseCallbackManager extends BaseCallbackHandler {
    addHandler: (handler: CallbackHandler) => void;
    removeHandler: (handler: CallbackHandler) => void;
    setHandlers: (handlers: CallbackHandler[]) => void;
}

