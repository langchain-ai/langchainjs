/**
 * Main createDeepAgent function for Deep Agents
 *
 * Main entry point for creating deep agents with TypeScript types for all parameters:
 * tools, instructions, model, subagents, and stateSchema. Combines built-in tools with
 * provided tools, creates task tool using createTaskTool(), and returns createReactAgent
 * with proper configuration. Ensures exact parameter matching and behavior with Python version.
 */

import type { StructuredTool } from "@langchain/core/tools";

import { createTaskTool } from "./subAgent.js";
import type { CreateDeepAgentParams } from "./types.js";
import {
  stateFileSystemMiddleware,
  humanInTheLoopMiddleware,
} from "../middleware/index.js";
import { planningMiddleware } from "../middleware/planning.js";
import { createAgent } from "../index.js";
import type { ReactAgent } from "../ReactAgent.js";

/**
 * Base prompt that provides instructions about available tools
 * Ported from Python implementation to ensure consistent behavior
 */
const BASE_PROMPT = `You have access to a number of standard tools

## \`write_todos\`

You have access to the \`write_todos\` tools to help you manage and plan tasks. Use these tools VERY frequently to ensure that you are tracking your tasks and giving the user visibility into your progress.
These tools are also EXTREMELY helpful for planning tasks, and for breaking down larger complex tasks into smaller steps. If you do not use this tool when planning, you may forget to do important tasks - and that is unacceptable.

It is critical that you mark todos as completed as soon as you are done with a task. Do not batch up multiple tasks before marking them as completed.
## \`task\`

- When doing web search, prefer to use the \`task\` tool in order to reduce context usage.`;

/**
 * Create a Deep Agent with TypeScript types for all parameters.
 * Combines built-in tools with provided tools, creates task tool using createTaskTool(),
 * and returns createReactAgent with proper configuration.
 * Ensures exact parameter matching and behavior with Python version.
 *
 */
export function createDeepAgent(
  params: CreateDeepAgentParams = {} as CreateDeepAgentParams
) {
  const {
    subagents = [],
    tools = [],
    model = "openai:gpt-4o-mini",
    interruptConfig = {},
    instructions,
  } = params;

  // Combine instructions with base prompt like Python implementation
  const finalInstructions = instructions
    ? instructions + BASE_PROMPT
    : BASE_PROMPT;

  // Create task tool using createTaskTool() if subagents are provided
  const allTools: StructuredTool[] = [...tools];
  if (subagents.length > 0) {
    // Create tools map for task tool creation
    const toolsMap: Record<string, StructuredTool> = {};
    for (const tool of tools) {
      if (tool.name) {
        toolsMap[tool.name] = tool;
      }
    }

    const taskTool = createTaskTool({
      subagents,
      tools: toolsMap,
      model,
    });
    allTools.push(taskTool);
  }

  return createAgent({
    model,
    systemPrompt: finalInstructions,
    tools: allTools,
    middleware: [
      stateFileSystemMiddleware,
      planningMiddleware,
      humanInTheLoopMiddleware({
        interruptOn: interruptConfig,
      }),
    ],
  }) as ReactAgent;
}
