import { AgentStep } from "../schema/index.js";

/**
 * Format agent steps as a string for a prompt, or
 * context for an agent.
 * @param {Array<AgentStep>} steps
 * @returns {string} The formatted steps.
 */
export const formatAgentStepsForPrompt = (steps: AgentStep[]): string =>
  steps
    .map((step, i) => {
      const { action, observation } = step;

      return (
        `Step ${i + 1}:\n` +
        `Tool used: ${action.tool}\n` +
        `Tool input: ${action.toolInput}\n` +
        `Tool output: ${observation}`
      );
    })
    .join("\n\n");
