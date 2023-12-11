import { AgentStep } from "../../schema/index.js";

export function formatXml(intermediateSteps: AgentStep[]) {
  let log = "";
  for (const step of intermediateSteps) {
    const { action, observation } = step;
    log += `<tool>${action.tool}</tool><tool_input>${action.toolInput}\n</tool_input><observation>${observation}</observation>`;
  }
  return log;
}
