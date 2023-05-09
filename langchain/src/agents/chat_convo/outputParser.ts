import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";

export class ChatConversationalAgentOutputParser extends AgentActionOutputParser {
  async parse(text: string) {
    const trimmedText = text.trim();
    let action: string | undefined;
    let action_input: string | undefined;

    try {
      ({ action, action_input } = JSON.parse(trimmedText));
    } catch (_error) {
      ({ action, action_input } = this.findActionAndInput(trimmedText));
    }

    if (!action) {
      throw new Error(`\`action\` could not be found in: "${trimmedText}"`);
    }

    if (!action_input) {
      throw new Error(
        `\`action_input\` could not be found in: "${trimmedText}"`
      );
    }

    if (action === "Final Answer") {
      return { returnValues: { output: action_input }, log: text };
    }

    return { tool: action, toolInput: action_input, log: text };
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }

  private findActionAndInput(text: string): {
    action: string | undefined;
    action_input: string | undefined;
  } {
    const jsonOutput = this.findJson(text);

    try {
      const response = JSON.parse(jsonOutput);

      return response;
    } catch (error) {
      return { action: undefined, action_input: undefined };
    }
  }

  private findJson(text: string) {
    let jsonOutput = text;

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

    return jsonOutput;
  }
}
