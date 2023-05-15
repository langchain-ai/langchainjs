import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";

export class ChatConversationalAgentOutputParser extends AgentActionOutputParser {
  async parse(text: string) {
    let jsonOutput = text.trim();
    if (jsonOutput.includes("```json")) {
      jsonOutput = jsonOutput.split("```json")[1].trimStart();
    } else if (jsonOutput.includes("```")) {
      const firstIndex = jsonOutput.indexOf("```");
      jsonOutput = jsonOutput.slice(firstIndex + 3).trimStart();
    }
    const lastIndex = jsonOutput.lastIndexOf("```");
    if (lastIndex !== -1) {
      jsonOutput = jsonOutput.slice(0, lastIndex).trimEnd();
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
