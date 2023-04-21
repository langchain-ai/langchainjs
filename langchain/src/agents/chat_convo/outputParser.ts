import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";

export class ChatConversationalAgentOutputParser extends AgentActionOutputParser {
  async parse(text: string) {
    let jsonOutput = text.trim();
    if (jsonOutput.includes("```json")) {
      jsonOutput = jsonOutput.split("```json")[1].trimStart();
    }
    if (jsonOutput.includes("```")) {
      jsonOutput = jsonOutput.split("```")[0].trimEnd();
    }
    if (jsonOutput.startsWith("```")) {
      jsonOutput = jsonOutput.slice(3).trimStart();
    }
    if (jsonOutput.endsWith("```")) {
      jsonOutput = jsonOutput.slice(0, -3).trimEnd();
    }

    const response = JSON.parse(jsonOutput);

    const { action, action_input } = response;

    if (action === "Final Answer") {
      return { returnValues: { output: action_input }, log: text };
    }
    return { tool: action, toolInput: action_input, log: text };
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }
}
