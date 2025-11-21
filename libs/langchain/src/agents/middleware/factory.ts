import { anthropicPromptCachingMiddleware } from "./provider/anthropic/promptCaching.js";
import type { PromptCachingMiddlewareConfig } from "./provider/anthropic/promptCaching.js";
import {
  contextEditingMiddleware,
  type ContextEditingMiddlewareConfig,
} from "./contextEditing.js";
import {
  dynamicSystemPromptMiddleware,
  type DynamicSystemPromptMiddlewareConfig,
} from "./dynamicSystemPrompt.js";
import {
  humanInTheLoopMiddleware,
  type HumanInTheLoopMiddlewareConfig,
} from "./hitl.js";
import {
  llmToolSelectorMiddleware,
  type LLMToolSelectorConfig,
} from "./llmToolSelector.js";
import {
  modelCallLimitMiddleware,
  type ModelCallLimitMiddlewareConfig,
} from "./modelCallLimit.js";
import {
  modelRetryMiddleware,
  type ModelRetryMiddlewareConfig,
} from "./modelRetry.js";
import {
  piiRedactionMiddleware,
  type PIIRedactionMiddlewareConfig,
} from "./piiRedaction.js";
import {
  summarizationMiddleware,
  type SummarizationMiddlewareConfig,
} from "./summarization.js";
import {
  todoListMiddleware,
  type TodoListMiddlewareOptions,
} from "./todoListMiddleware.js";
import {
  toolCallLimitMiddleware,
  type ToolCallLimitConfig,
} from "./toolCallLimit.js";
import {
  toolRetryMiddleware,
  type ToolRetryMiddlewareConfig,
} from "./toolRetry.js";
import type { AgentMiddleware } from "./types.js";

/**
 * Reference names for built-in middleware so application code can request them without
 * importing the concrete factory functions directly.
 */
export const enum BuiltInAgentMiddleware {
  AnthropicPromptCaching = "anthropicPromptCachingMiddleware",
  ContextEditing = "contextEditingMiddleware",
  DynamicSystemPrompt = "dynamicSystemPromptMiddleware",
  HumanInTheLoop = "humanInTheLoopMiddleware",
  LlmToolSelector = "llmToolSelectorMiddleware",
  ModelCallLimit = "modelCallLimitMiddleware",
  ModelRetry = "modelRetryMiddleware",
  PiiRedaction = "piiRedactionMiddleware",
  Summarization = "summarizationMiddleware",
  TodoList = "todoListMiddleware",
  ToolCallLimit = "toolCallLimitMiddleware",
  ToolRetry = "toolRetryMiddleware",
}

/**
 * Maps each built-in middleware to the configuration shape expected by its factory.
 */
type BuiltInAgentMiddlewareConfigMap = {
  [BuiltInAgentMiddleware.AnthropicPromptCaching]:
    | PromptCachingMiddlewareConfig
    | undefined;
  [BuiltInAgentMiddleware.ContextEditing]:
    | ContextEditingMiddlewareConfig
    | undefined;
  [BuiltInAgentMiddleware.DynamicSystemPrompt]: DynamicSystemPromptMiddlewareConfig<unknown>;
  [BuiltInAgentMiddleware.HumanInTheLoop]:
    | HumanInTheLoopMiddlewareConfig
    | undefined;
  [BuiltInAgentMiddleware.LlmToolSelector]: LLMToolSelectorConfig;
  [BuiltInAgentMiddleware.ModelCallLimit]:
    | ModelCallLimitMiddlewareConfig
    | undefined;
  [BuiltInAgentMiddleware.ModelRetry]: ModelRetryMiddlewareConfig;
  [BuiltInAgentMiddleware.PiiRedaction]:
    | PIIRedactionMiddlewareConfig
    | undefined;
  [BuiltInAgentMiddleware.Summarization]: SummarizationMiddlewareConfig;
  [BuiltInAgentMiddleware.TodoList]: TodoListMiddlewareOptions | undefined;
  [BuiltInAgentMiddleware.ToolCallLimit]: ToolCallLimitConfig;
  [BuiltInAgentMiddleware.ToolRetry]: ToolRetryMiddlewareConfig | undefined;
};

export type BuiltInAgentMiddlewareConfig<T extends BuiltInAgentMiddleware> =
  BuiltInAgentMiddlewareConfigMap[T];

/**
 * Creates an instance of the requested built-in middleware, enforcing configuration
 * requirements to avoid runtime mistakes in downstream projects.
 */
export function createBuiltInAgentMiddleware<T extends BuiltInAgentMiddleware>(
  middleware: T,
  config: BuiltInAgentMiddlewareConfig<T>
): AgentMiddleware {
  switch (middleware) {
    case BuiltInAgentMiddleware.AnthropicPromptCaching:
      return anthropicPromptCachingMiddleware(
        config as PromptCachingMiddlewareConfig | undefined
      );
    case BuiltInAgentMiddleware.ContextEditing:
      return contextEditingMiddleware(
        config as ContextEditingMiddlewareConfig | undefined
      );
    case BuiltInAgentMiddleware.DynamicSystemPrompt: {
      if (typeof config !== "function") {
        throw new Error(
          "dynamicSystemPromptMiddleware requires a prompt generator function."
        );
      }
      return dynamicSystemPromptMiddleware(
        config as DynamicSystemPromptMiddlewareConfig<unknown>
      );
    }
    case BuiltInAgentMiddleware.HumanInTheLoop:
      return humanInTheLoopMiddleware(
        (config ?? {}) as HumanInTheLoopMiddlewareConfig
      );
    case BuiltInAgentMiddleware.LlmToolSelector: {
      if (!config) {
        throw new Error("llmToolSelectorMiddleware requires configuration.");
      }
      return llmToolSelectorMiddleware(config as LLMToolSelectorConfig);
    }
    case BuiltInAgentMiddleware.ModelCallLimit:
      return modelCallLimitMiddleware(
        config as ModelCallLimitMiddlewareConfig | undefined
      );
    case BuiltInAgentMiddleware.ModelRetry:
      return modelRetryMiddleware(config as ModelRetryMiddlewareConfig);
    case BuiltInAgentMiddleware.PiiRedaction:
      return piiRedactionMiddleware(
        config as PIIRedactionMiddlewareConfig | undefined
      );
    case BuiltInAgentMiddleware.Summarization: {
      if (!config) {
        throw new Error("summarizationMiddleware requires configuration.");
      }
      return summarizationMiddleware(config as SummarizationMiddlewareConfig);
    }
    case BuiltInAgentMiddleware.TodoList:
      return todoListMiddleware(
        config as TodoListMiddlewareOptions | undefined
      );
    case BuiltInAgentMiddleware.ToolCallLimit: {
      if (!config) {
        throw new Error("toolCallLimitMiddleware requires configuration.");
      }
      return toolCallLimitMiddleware(config as ToolCallLimitConfig);
    }
    case BuiltInAgentMiddleware.ToolRetry:
      return toolRetryMiddleware(
        config as ToolRetryMiddlewareConfig | undefined
      );
    default: {
      const _exhaustiveCheck: never = middleware;
      throw new Error(`Unsupported middleware: ${_exhaustiveCheck}`);
    }
  }
}

type BuiltInMiddlewareEntry<
  T extends BuiltInAgentMiddleware = BuiltInAgentMiddleware
> = undefined extends BuiltInAgentMiddlewareConfig<T>
  ? {
      name: T;
      config?: BuiltInAgentMiddlewareConfig<T>;
      when?: boolean;
    }
  : {
      name: T;
      config: BuiltInAgentMiddlewareConfig<T>;
      when?: boolean;
    };

/**
 * Small helper for incrementally constructing middleware arrays while keeping
 * conditional logic readable (e.g. `builder.addBuiltIn({ name, when })`).
 *
 * @example
 * const middleware = new AgentMiddlewareBuilder()
 *  .addBuiltIn({
 *    name: BuiltInAgentMiddleware.ModelCallLimit,
 *    config: { runLimit: 3 },
 *  })
 *  .addBuiltIn({
 *    name: BuiltInAgentMiddleware.TodoList,
 *    config: { systemPrompt: "..." },
 *    when: shouldPlan,
 *  })
 *  .build();
 */
export class AgentMiddlewareBuilder {
  private readonly middleware: AgentMiddleware[] = [];

  /**
   * Push a pre-constructed middleware if the condition passes.
   */
  add(middleware: AgentMiddleware | undefined | null, when = true): this {
    if (when && middleware) {
      this.middleware.push(middleware);
    }
    return this;
  }

  /**
   * Lazily create a built-in middleware instance when the guard evaluates true.
   */
  addBuiltIn<T extends BuiltInAgentMiddleware>(
    entry: BuiltInMiddlewareEntry<T>
  ): this {
    if (entry.when === false) {
      return this;
    }
    this.middleware.push(
      createBuiltInAgentMiddleware(
        entry.name,
        (entry as { config: BuiltInAgentMiddlewareConfig<T> }).config
      )
    );
    return this;
  }

  /**
   * Returns the collected middleware array. The builder itself is stateless after build.
   */
  build(): AgentMiddleware[] {
    return [...this.middleware];
  }
}
