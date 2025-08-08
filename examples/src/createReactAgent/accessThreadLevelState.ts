/**
 * Access Thread-Level State in Message Generation
 *
 * Thread-level state is data that the agent modifies over time (unlike static
 * runtime context such as userId). Tools can update this state (NOT the
 * `messages` key), and the prompt can then inject that state into the system
 * instructions for subsequent turns.
 *
 * Why this is important:
 * - State-driven prompts: The current thread state can shape system prompts/messages
 * - Evolving behavior: Tools update state as work progresses (e.g., a TODO list)
 * - Clear separation: Context (static, per-session) vs State (dynamic, per-thread)
 *
 * Example Scenario:
 * A TODO assistant. Tools add/remove items in a thread-level TODO list. The
 * prompt always includes the current TODOs so the model can plan next steps.
 */

import { createReactAgent, tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

/**
 * Thread-level state (would normally live in your app or a store)
 */
const threadState: { todos: string[] } = { todos: [] };

/**
 * Tools that update thread-level state (NOT messages)
 */
const addTodo = tool(
  async (input: { item: string }) => {
    threadState.todos.push(input.item);
    return `Added TODO: ${input.item}`;
  },
  {
    name: "add_todo",
    description: "Add an item to the thread TODO list",
    schema: z.object({ item: z.string().describe("The TODO item to add") }),
  }
);

const removeTodo = tool(
  async (input: { item: string }) => {
    const before = threadState.todos.length;
    threadState.todos = threadState.todos.filter((t) => t !== input.item);
    const removed = before !== threadState.todos.length;
    return removed
      ? `Removed TODO: ${input.item}`
      : `No matching TODO found for: ${input.item}`;
  },
  {
    name: "remove_todo",
    description: "Remove an item from the thread TODO list",
    schema: z.object({ item: z.string().describe("The TODO item to remove") }),
  }
);

/**
 * Create agent that injects thread-level state into the prompt
 */
const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4" }),
  tools: [addTodo, removeTodo],
  prompt: async (state) => {
    /**
     * Pull dynamic, thread-level state (maintained by tools) into the system prompt
     */
    const { todos } = threadState;
    const todosSection =
      todos.length > 0
        ? `Current TODOs (thread state):\n- ${todos.join("\n- ")}`
        : "Current TODOs (thread state):\n- (none)";

    return [
      {
        role: "system",
        content: `You are a helpful assistant that manages a thread-level TODO list.

${todosSection}

When planning or responding, consider the current TODOs. If the user asks to update the list,
use the appropriate tools. If asked for next steps, reference and prioritize items in the list.`,
      },
      ...state.messages,
    ];
  },
});

/**
 * Example Usage: Simulate prior tool calls that updated thread-level state
 */
await addTodo.invoke({ item: "Set up project repository" });
await addTodo.invoke({ item: "Write initial README" });

/**
 * Now the agent prompt will include the current TODOs from thread state
 */
const result = await agent.invoke({
  messages: [{ role: "user", content: "What should I work on next?" }],
});

console.log("Result: ");
console.log(result.messages[result.messages.length - 1].content);
