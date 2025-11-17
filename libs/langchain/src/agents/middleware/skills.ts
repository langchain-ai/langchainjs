import vm from "node:vm";

import { z } from "zod/v3";
import { tool, type ClientTool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";

import { isClientTool } from "../utils.js";
import { createMiddleware } from "../middleware.js";

/**
 * Generate the default system prompt for code execution middleware
 */
function getDefaultCodeExecutionSystemPrompt(): string {
  return `You have access to tools through a skills API and code execution. This approach is more efficient than loading all tool definitions upfront.

## How to Access Tools

1. **List available skills**: Use the \`listSkills\` tool to get a lightweight list of all available tools.
   - Returns a JSON array with \`name\` and \`description\` for each tool
   - Use this to discover which tools are available

2. **Get skill details**: Use the \`getSkillDetails\` tool to get detailed schema information for specific tools.
   - Takes a list of skill names as input (allows parallel lookups)
   - Returns input and output schemas for the requested tools
   - Only request details for tools you actually need for the current task

3. **Execute code**: Use the \`execute_code\` tool to execute JavaScript code that calls tools.
   - **IMPORTANT**: Do NOT import tool functions. The \`callTool\` function is already available in the execution context.
   - Use \`callTool\` directly to call tools: \`await callTool('toolName', { param: 'value' })\`
   - The tool name should match the original tool name exactly

## Benefits of This Approach

- **Progressive disclosure**: Load only the tool definitions you need, reducing token usage
- **Context efficiency**: Filter and transform data in code before returning results
- **Better control flow**: Use loops, conditionals, and error handling in familiar code patterns
- **Privacy**: Intermediate results stay in the execution environment by default
- **Parallel lookups**: Get details for multiple tools in a single call

## Example Workflow

1. List available skills: \`listSkills()\`
2. Get details for specific tools: \`getSkillDetails({ skillNames: ['getDocument', 'updateRecord'] })\`
3. Execute code using the tool: \`execute_code({ code: "const result = await callTool('getDocument', { documentId: 'abc123' }); console.log(result);" })\`

**Important**: When executing code, use \`callTool\` directly. Do NOT use import statements. The \`callTool\` function is pre-injected into the execution context.

Remember: Only request details for the tools you need for your current task to minimize token usage.`;
}

/**
 * Skills middleware that provides a token-efficient API for discovering and using tools.
 * This middleware clears all tools from the agent and instead provides tools to discover
 * skills and execute code that calls tools.
 *
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * import { skillsMiddleware } from "langchain/agents/middleware";
 *
 * const middleware = skillsMiddleware();
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [middleware],
 * });
 * ```
 */
export function skillsMiddleware() {
  let toolRegistry: Record<string, ClientTool> = {};

  // List skills tool - returns lightweight JSON with name and description
  const listSkillsTool = tool(
    async () => {
      if (Object.keys(toolRegistry).length === 0) {
        return JSON.stringify([], null, 2);
      }

      const skills = Object.values(toolRegistry).map((toolDef) => toolDef.name);
      return JSON.stringify(skills, null, 2);
    },
    {
      name: "listSkills",
      description:
        "List all available skills/tools. Returns a JSON array with name and description for each tool.",
      schema: z.object({}),
    }
  );

  // Get skill details tool - returns input/output schemas for requested skills
  const getSkillDetailsTool = tool(
    async ({ skillNames }) => {
      if (Object.keys(toolRegistry).length === 0) {
        return JSON.stringify([], null, 2);
      }

      const skillDetails = skillNames
        .filter((name: string) => name in toolRegistry)
        .map((name: string) => {
          const toolDef = toolRegistry[name];
          const schema = toolDef.schema as Record<string, unknown> | undefined;

          return {
            name: toolDef.name,
            description: toolDef.description || "",
            inputSchema: schema || {},
          };
        });

      return JSON.stringify(skillDetails, null, 2);
    },
    {
      name: "getSkillDetails",
      description:
        "Get detailed schema information for specific skills. Takes a list of skill names and returns their input/output schemas. Allows parallel lookups.",
      schema: z.object({
        skillNames: z
          .array(z.string())
          .describe("Array of skill names to get details for"),
      }),
    }
  );

  // Code execution tool
  const executeCodeTool = tool(
    async ({ code }) => {
      // Collect console logs
      const logs: string[] = [];

      // Helper to format console arguments
      const formatLogArgs = (args: unknown[]): string => {
        return args
          .map((arg) => {
            if (typeof arg === "object" && arg !== null) {
              try {
                return JSON.stringify(arg, null, 2);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(" ");
      };

      // Create VM context with tools injected
      const context: Record<string, unknown> = {
        // Inject tools as async functions
        ...Object.fromEntries(
          Object.entries(toolRegistry).map(([name, toolDef]) => [
            name.replace(/[^a-zA-Z0-9]/g, "_"),
            async (args: Record<string, unknown>) => {
              return await toolDef.invoke(args);
            },
          ])
        ),
        // Inject console object to capture logs
        console: {
          log: (...args: unknown[]) => {
            logs.push(`[LOG] ${formatLogArgs(args)}`);
          },
          error: (...args: unknown[]) => {
            logs.push(`[ERROR] ${formatLogArgs(args)}`);
          },
          warn: (...args: unknown[]) => {
            logs.push(`[WARN] ${formatLogArgs(args)}`);
          },
          info: (...args: unknown[]) => {
            logs.push(`[INFO] ${formatLogArgs(args)}`);
          },
          debug: (...args: unknown[]) => {
            logs.push(`[DEBUG] ${formatLogArgs(args)}`);
          },
        },
      };

      // Inject callTool function that can access tools from context
      context.callTool = async function callTool<T = unknown>(
        toolName: string,
        input: Record<string, unknown>
      ): Promise<T> {
        // Normalize tool name to match how tools are injected into the VM context
        const normalizedName = toolName.replace(/[^a-zA-Z0-9]/g, "_");

        // Access the tool function from the context (this function's closure)
        const toolFunction = context[normalizedName];

        if (typeof toolFunction !== "function") {
          const availableTools = Object.keys(context)
            .filter(
              (key) => typeof context[key] === "function" && key !== "callTool"
            )
            .join(", ");
          throw new Error(
            `Tool "${toolName}" (normalized: "${normalizedName}") not found in execution context. ` +
              `Available tools: ${availableTools || "none"}`
          );
        }

        // Call the tool function with the input
        return await (
          toolFunction as (args: Record<string, unknown>) => Promise<T>
        )(input);
      };

      // Create VM context
      const vmContext = vm.createContext(context);

      try {
        // Wrap code in async IIFE to allow top-level await
        const wrappedCode = `(async () => { ${code} })()`;

        // Execute code in VM
        const result = vm.runInContext(wrappedCode, vmContext, {
          timeout: 30000, // 30 second timeout
        });

        // If result is a promise, await it
        let resolvedResult: unknown;
        if (result && typeof result === "object" && "then" in result) {
          resolvedResult = await result;
        } else {
          resolvedResult = result;
        }

        // Format the response with logs and result
        const resultStr = JSON.stringify(resolvedResult, null, 2);

        if (logs.length > 0) {
          return `${logs.join("\n")}\n\n--- Result ---\n${resultStr}`;
        }

        return resultStr;
      } catch (error) {
        const errorMessage = `Error executing code: ${String(error)}\n${
          // eslint-disable-next-line no-instanceof/no-instanceof
          error instanceof Error ? error.stack : error
        }`;

        if (logs.length > 0) {
          return `${logs.join("\n")}\n\n--- Error ---\n${errorMessage}`;
        }

        return errorMessage;
      }
    },
    {
      name: "execute_code",
      description: `Execute JavaScript/TypeScript code that calls tools. Use \`callTool(toolName, input)\` directly - do NOT import tool functions. The \`callTool\` function is pre-injected into the execution context.`,
      schema: z.object({
        code: z.string().describe("JavaScript/TypeScript code to execute"),
      }),
    }
  );

  const middlewareTools = [
    listSkillsTool,
    getSkillDetailsTool,
    executeCodeTool,
  ];
  return createMiddleware({
    name: "CodeExecutionMiddleware",
    tools: middlewareTools,
    wrapModelCall: async (request, handler) => {
      const toolsToKeep = request.tools.filter(
        (tool) =>
          (isClientTool(tool) && middlewareTools.find((t) => t === tool)) ||
          !isClientTool(tool)
      );

      toolRegistry = request.tools
        .filter(
          (tool): tool is ClientTool =>
            isClientTool(tool) && !middlewareTools.find((t) => t === tool)
        )
        .reduce((acc, tool) => {
          acc[tool.name] = tool;
          return acc;
        }, {} as Record<string, ClientTool>);

      // Clear all tools - agent should use code execution instead
      return handler({
        ...request,
        tools: toolsToKeep,
        systemPrompt:
          (request.systemPrompt ? `${request.systemPrompt}\n\n` : "") +
          getDefaultCodeExecutionSystemPrompt(),
      });
    },
    afterModel: async (state) => {
      const cleanedMessages = state.messages.map((msg) => {
        // Only process ToolMessage instances
        if (!ToolMessage.isInstance(msg)) {
          return msg;
        }

        const content = String(msg.content || "");

        // Check if content contains the result separator
        const resultIndex = content.indexOf("--- Result ---");
        const errorIndex = content.indexOf("--- Error ---");

        // Find the earliest separator (if any)
        let separatorIndex = -1;
        if (resultIndex !== -1 && errorIndex !== -1) {
          separatorIndex = Math.min(resultIndex, errorIndex);
        } else if (resultIndex !== -1) {
          separatorIndex = resultIndex;
        } else if (errorIndex !== -1) {
          separatorIndex = errorIndex;
        }

        // If separator found, remove everything before it (including the separator line)
        if (separatorIndex !== -1) {
          const cleanedContent = content.slice(separatorIndex);
          // Remove the separator line itself and any leading whitespace
          const lines = cleanedContent.split("\n");
          // Skip the separator line and any empty lines after it
          let startIndex = 1;
          while (
            startIndex < lines.length &&
            lines[startIndex]?.trim() === ""
          ) {
            startIndex++;
          }
          const finalContent = lines.slice(startIndex).join("\n").trim();

          return new ToolMessage({
            content: finalContent || content,
            tool_call_id: msg.tool_call_id,
            name: msg.name,
            id: msg.id,
          });
        }

        return msg;
      });

      // Only return updated state if messages were modified
      const wasModified = cleanedMessages.some(
        (msg, index) => msg !== state.messages[index]
      );

      if (wasModified) {
        return { messages: cleanedMessages };
      }

      return undefined;
    },
  });
}
