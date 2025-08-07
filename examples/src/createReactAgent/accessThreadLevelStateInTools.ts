/**
 * Access Thread-Level State in Tools
 *
 * Sometimes a tool needs the full thread state (e.g. all messages) to do its job.
 * A canonical example is delegating to a sub-agent from inside a tool: the tool
 * passes the entire message list along with a task to the sub-agent, which then
 * performs analysis or planning over the whole conversation.
 *
 * Why this is important:
 * - Sub-agent workflows: Delegate specialized work while giving full context
 * - State-aware tools: Tools can access thread state beyond the immediate input
 * - Better results: Sub-agents reason over the entire conversation, not just a single turn
 *
 * Example Scenario:
 * A supervisor agent has a `delegate_to_subagent` tool. When the user asks for a
 * conversation-wide summary or action items, the supervisor calls the tool, which
 * passes the full message history plus a task to the sub-agent. The sub-agent
 * returns a polished result back to the supervisor.
 */

import { createReactAgent, tool, CreateReactAgentConfig } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const llm = new ChatOpenAI({ model: "gpt-4o", temperature: 0 });

/**
 * Create a sub-agent used for analysis/summary over full thread state
 */
const subAgent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o", temperature: 0 }),
  tools: [],
  prompt: async (state) => [
    {
      role: "system",
      content:
        "You are an analysis sub-agent. Given the full conversation and a TASK message, provide a concise, helpful result.",
    },
    ...state.messages,
  ],
});

/**
 * Tool that delegates to the sub-agent, passing full thread messages
 */
const delegateToSubAgentTool = tool(
  async (input: { task: string }, config: CreateReactAgentConfig) => {
    /**
     * Access full thread messages from state
     */
    const currentMessages =
      config?.configurable?.pregel_scratchpad?.currentTaskInput?.messages || [];

    /**
     * Call the sub-agent with the full history plus a task instruction
     */
    const result = await subAgent.invoke({
      messages: [
        ...currentMessages,
        { role: "user", content: `TASK: ${input.task}` },
      ],
    });

    return (
      (result.messages[result.messages.length - 1].content as string) ?? ""
    );
  },
  {
    name: "delegate_to_subagent",
    description:
      "Delegate analysis/planning to a sub-agent with access to the full thread messages",
    schema: z.object({
      task: z
        .string()
        .describe(
          "The task to perform over the entire conversation (e.g., summarize, extract action items)"
        ),
    }),
  }
);

/**
 * Create agent that uses tools with thread-level context awareness
 */
const agent = createReactAgent({
  llm,
  tools: [delegateToSubAgentTool],
  prompt: `You are a supervisor agent.

When the user asks for any analysis over the entire conversation (e.g., summary,
key decisions, action items), call the tool 'delegate_to_subagent' and provide a
clear TASK describing what the sub-agent should do. The tool will pass the full
message history to the sub-agent. Return the sub-agent's result.`,
});

/**
 * Example 1: Employment Law Conversation - Building Context
 */
const convo1 = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "We discussed API errors and caching issues earlier.",
    },
  ],
});

console.log("\n=== Delegate Summary to Sub-Agent ===");
const summary = await agent.invoke({
  messages: [
    ...convo1.messages,
    { role: "user", content: "Please summarize the conversation so far." },
  ],
});
console.log(summary.messages[summary.messages.length - 1].content);

console.log("\n=== Delegate Action Items to Sub-Agent ===");
const actions = await agent.invoke({
  messages: [
    ...summary.messages,
    {
      role: "user",
      content: "List concrete action items from our discussion.",
    },
  ],
});
console.log(actions.messages[actions.messages.length - 1].content);

/**
 * Example Output:
 * === Delegate Summary to Sub-Agent ===
 * The conversation focused on handling a situation where someone feels overwhelmed by their workload.
 * Suggestions included prioritizing tasks, communicating openly with a manager about the workload,
 * delegating tasks if possible, setting realistic goals, and taking breaks to manage stress.
 *
 * === Delegate Action Items to Sub-Agent ===
 * Here are the concrete action items from the discussion:
 *
 * 1. Schedule a meeting with the marketing team to discuss the new campaign strategy.
 * 2. Follow up with the design team to finalize the brochure layout by Friday.
 * 3. Send the updated project timeline to all team members by the end of the day.
 * 4. Confirm the venue booking for the upcoming client presentation.
 */
