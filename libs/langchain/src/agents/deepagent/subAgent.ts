/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-instanceof/no-instanceof */
/**
 * SubAgent implementation for Deep Agents
 *
 * Task tool creation and sub-agent management.
 * Creates SubAgent interface matching Python's TypedDict structure and implements
 * createTaskTool() function that creates agents map, handles tool resolution by name,
 * and returns a tool function that uses createReactAgent for sub-agents.
 */

import { z } from "zod";
import { type StructuredTool, tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";
import type { LanguageModelLike } from "@langchain/core/language_models/base";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";

import { TASK_DESCRIPTION_PREFIX, TASK_DESCRIPTION_SUFFIX } from "./prompts.js";
import { stateFileSystemMiddleware } from "../middleware/index.js";
import { planningMiddleware } from "../middleware/planning.js";
import { createAgent } from "../index.js";
import type { SubAgent } from "./types.js";

/**
 * Create task tool function that creates agents map, handles tool resolution by name,
 * and returns a tool function that uses createReactAgent for sub-agents.
 * Uses Command for state updates and navigation between agents.
 */
export function createTaskTool(inputs: {
  subagents: SubAgent[];
  tools: Record<string, StructuredTool>;
  model: LanguageModelLike | string;
}): StructuredTool {
  const { subagents, tools = {}, model = "openai:gpt-4o-mini" } = inputs;
  // Pre-create all agents like Python does
  const agentsMap = new Map<string, any>();
  for (const subagent of subagents) {
    // Resolve tools by name for this subagent
    const subagentTools: StructuredTool[] = [];
    if (subagent.tools) {
      for (const toolName of subagent.tools) {
        const resolvedTool = tools[toolName];
        if (resolvedTool) {
          subagentTools.push(resolvedTool);
        } else {
          console.warn(
            `Warning: Tool '${toolName}' not found for agent '${subagent.name}'`
          );
        }
      }
    } else {
      // If no tools specified, use all tools like Python does
      subagentTools.push(...Object.values(tools));
    }

    // Create react agent for the subagent (pre-create like Python)
    const reactAgent = createAgent({
      model: subagent.model ?? model,
      tools: subagentTools,
      systemPrompt: subagent.prompt,
      middleware: [
        stateFileSystemMiddleware,
        planningMiddleware,
        ...(subagent.middleware ?? []),
      ],
    });

    agentsMap.set(subagent.name, reactAgent);
  }

  return tool(
    async (input: { description: string; subagent_type: string }, config) => {
      const { description, subagent_type } = input;

      // Get the pre-created agent
      const reactAgent = agentsMap.get(subagent_type);
      if (!reactAgent) {
        return `Error: Agent '${subagent_type}' not found. Available agents: ${Array.from(
          agentsMap.keys()
        ).join(", ")}`;
      }

      try {
        // Get current state for context
        const currentState = getCurrentTaskInput<any>();

        // Modify state messages like Python does
        const modifiedState = {
          ...currentState,
          messages: [
            {
              role: "user",
              content: description,
            },
          ],
        };

        // Execute the subagent with the task
        const result = await reactAgent.invoke(modifiedState, config);

        // Use Command for state updates and navigation between agents
        // Return the result using Command to properly handle subgraph state
        return new Command({
          update: {
            files: result.files || {},
            messages: [
              new ToolMessage({
                content:
                  result.messages?.slice(-1)[0]?.content || "Task completed",
                tool_call_id: config.toolCall?.id as string,
                name: "task",
              }),
            ],
          },
        });
      } catch (error) {
        // Handle errors gracefully
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return new Command({
          update: {
            messages: [
              new ToolMessage({
                content: `Error executing task '${description}' with agent '${subagent_type}': ${errorMessage}`,
                tool_call_id: config.toolCall?.id as string,
                name: "task",
              }),
            ],
          },
        });
      }
    },
    {
      name: "task",
      description:
        TASK_DESCRIPTION_PREFIX.replace(
          "{other_agents}",
          subagents.map((a) => `- ${a.name}: ${a.description}`).join("\n")
        ) + TASK_DESCRIPTION_SUFFIX,
      schema: z.object({
        description: z
          .string()
          .describe("The task to execute with the selected agent"),
        subagent_type: z
          .string()
          .describe(
            `Name of the agent to use. Available: ${subagents
              .map((a) => a.name)
              .join(", ")}`
          ),
      }),
    }
  );
}
