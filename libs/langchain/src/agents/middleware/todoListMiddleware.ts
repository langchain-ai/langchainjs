import { z } from "zod/v3";
import { Command } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { AIMessage, ToolMessage } from "@langchain/core/messages";

import { createMiddleware } from "../index.js";

/**
 * Concise description for the write_todos tool.
 * Keep this short because tool descriptions are sent to the model on every call.
 */
const WRITE_TODOS_DESCRIPTION = `Create and manage a task list for complex, multi-step work.
Use for tasks with 3+ meaningful steps, explicit user requests for a todo list, or work that needs progress tracking.
Skip for single, trivial, conversational, or informational requests.
Each todo has content and status: pending, in_progress, or completed.
Update statuses as work progresses, mark completed items promptly, and keep at least one item in_progress until all work is done.
Call write_todos at most once per model turn.`;

export const TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT = `## \`write_todos\`

You have access to the \`write_todos\` tool to help you manage and plan complex objectives. 
Use this tool for complex objectives to ensure that you are tracking each necessary step and giving the user visibility into your progress.
This tool is very helpful for planning complex objectives, and for breaking down these larger complex objectives into smaller steps.

It is critical that you mark todos as completed as soon as you are done with a step. Do not batch up multiple steps before marking them as completed.
For simple objectives that only require a few steps, it is better to just complete the objective directly and NOT use this tool.
Writing todos takes time and tokens, use it when it is helpful for managing complex many-step problems! But not for simple few-step requests.

## Important To-Do List Usage Notes to Remember
- The \`write_todos\` tool should never be called multiple times in parallel.
- Don't be afraid to revise the To-Do list as you go. New information may reveal new tasks that need to be done, or old tasks that are irrelevant.`;

const TodoStatus = z
  .enum(["pending", "in_progress", "completed"])
  .describe("Status of the todo");
const TodoSchema = z.object({
  content: z.string().describe("Content of the todo item"),
  status: TodoStatus,
});
export type Todo = z.infer<typeof TodoSchema>;

const stateSchema = z.object({
  todos: z.array(TodoSchema).default([]),
});
export type TodoMiddlewareState = z.infer<typeof stateSchema>;

export interface TodoListMiddlewareOptions {
  /**
   * Custom system prompt to guide the agent on using the todo tool.
   * If not provided, uses the default {@link PLANNING_MIDDLEWARE_SYSTEM_PROMPT}.
   */
  systemPrompt?: string;
  /**
   * Custom description for the {@link writeTodos} tool.
   * If not provided, uses the default {@link WRITE_TODOS_DESCRIPTION}.
   */
  toolDescription?: string;
}

/**
 * Creates a middleware that provides todo list management capabilities to agents.
 *
 * This middleware adds a `write_todos` tool that allows agents to create and manage
 * structured task lists for complex multi-step operations. It's designed to help
 * agents track progress, organize complex tasks, and provide users with visibility
 * into task completion status.
 *
 * The middleware automatically injects system prompts that guide the agent on when
 * and how to use the todo functionality effectively. It also enforces that the
 * `write_todos` tool is called at most once per model turn, since the tool replaces
 * the entire todo list and parallel calls would create ambiguity about precedence.
 *
 * @example
 * ```typescript
 * import { todoListMiddleware, createAgent } from 'langchain';
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [todoListMiddleware()],
 * });
 *
 * // Agent now has access to write_todos tool and todo state tracking
 * const result = await agent.invoke({
 *   messages: [new HumanMessage("Help me refactor my codebase")]
 * });
 *
 * console.log(result.todos); // Array of todo items with status tracking
 * ```
 *
 * @returns A configured middleware instance that provides todo management capabilities
 *
 * @see {@link TodoMiddlewareState} for the state schema
 * @see {@link writeTodos} for the tool implementation
 */
export function todoListMiddleware(options?: TodoListMiddlewareOptions) {
  /**
   * Write todos tool - manages todo list with Command return
   */
  const writeTodos = tool(
    ({ todos }, config) => {
      return new Command({
        update: {
          todos,
          messages: [
            new ToolMessage({
              content: `Updated todo list to ${JSON.stringify(todos)}`,
              tool_call_id: config.toolCall?.id as string,
              name: "write_todos",
            }),
          ],
        },
      });
    },
    {
      name: "write_todos",
      description: options?.toolDescription ?? WRITE_TODOS_DESCRIPTION,
      schema: z.object({
        todos: z.array(TodoSchema).describe("List of todo items to update"),
      }),
    }
  );

  return createMiddleware({
    name: "todoListMiddleware",
    stateSchema,
    tools: [writeTodos],
    wrapModelCall: (request, handler) =>
      handler({
        ...request,
        systemMessage: request.systemMessage.concat(
          `\n\n${options?.systemPrompt ?? TODO_LIST_MIDDLEWARE_SYSTEM_PROMPT}`
        ),
      }),
    afterModel: (state) => {
      /**
       * Check for parallel write_todos tool calls and return errors if detected.
       *
       * The todo list is designed to be updated at most once per model turn. Since
       * the `write_todos` tool replaces the entire todo list with each call, making
       * multiple parallel calls would create ambiguity about which update should take
       * precedence. This method prevents such conflicts by rejecting any response that
       * contains multiple write_todos tool calls.
       */
      const messages = state.messages;
      if (!messages || messages.length === 0) {
        return undefined;
      }

      /**
       * Find the last AI message
       */
      const lastAiMsg = [...messages]
        .reverse()
        .find((msg) => AIMessage.isInstance(msg));
      if (
        !lastAiMsg ||
        !lastAiMsg.tool_calls ||
        lastAiMsg.tool_calls.length === 0
      ) {
        return undefined;
      }

      /**
       * Count write_todos tool calls
       */
      const writeTodosCalls = lastAiMsg.tool_calls.filter(
        (tc) => tc.name === writeTodos.name
      );

      if (writeTodosCalls.length > 1) {
        /**
         * Create error tool messages for all write_todos calls
         */
        const errorMessages = writeTodosCalls.map(
          (tc) =>
            new ToolMessage({
              content:
                "Error: The `write_todos` tool should never be called multiple times " +
                "in parallel. Please call it only once per model invocation to update " +
                "the todo list.",
              tool_call_id: tc.id as string,
              name: "write_todos",
              status: "error",
            })
        );

        /**
         * Keep the tool calls in the AI message but return error messages
         * This follows the same pattern as HumanInTheLoopMiddleware
         */
        return { messages: errorMessages };
      }

      return undefined;
    },
  });
}
