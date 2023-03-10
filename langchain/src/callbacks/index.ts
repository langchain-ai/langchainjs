import {AgentAction, AgentFinish} from "../agents/index.js";
import {ChainValues} from "../chains/index.js";
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
    abstract handleLLMStart (
        llm: { name: string },
        prompts: string[],
        verbose?: boolean
    ): Promise<void>;
    abstract handleLLMNewToken(token: string, verbose?: boolean): Promise<void>;
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

