import { AgentStep } from "../../schema/index.js";

/**
 * Construct the scratchpad that lets the agent continue its thought process.
 * @param intermediateSteps
 * @param observationPrefix
 * @param llmPrefix
 * @returns a string with the formatted observations and agent logs
 */
export function formatLogToString(
  intermediateSteps: AgentStep[],
  observationPrefix = "Observation: ",
  llmPrefix = "Thought: "
): string {
  const formattedSteps = intermediateSteps.reduce(
    (thoughts, { action, observation }) =>
      thoughts +
      [action.log, `\n${observationPrefix}${observation}`, llmPrefix].join(
        "\n"
      ),
    ""
  );
  return formattedSteps;
}
