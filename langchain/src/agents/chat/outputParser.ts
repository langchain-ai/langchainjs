import { AgentActionOutputParser } from "../types.js";
import { AgentFinish } from "../../schema/index.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";

export const FINAL_ANSWER_ACTION = "Final Answer:";
export class ChatAgentOutputParser extends AgentActionOutputParser {
  async parse(text: string) {
    if (text.includes(FINAL_ANSWER_ACTION)) {
      const parts = text.split(FINAL_ANSWER_ACTION);
      const output = parts[parts.length - 1].trim();
      return { returnValues: { output }, log: text } satisfies AgentFinish;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars

    const [_, action, __] = text.split(/```(?:json)?/g);
    try {
      const response = JSON.parse(action.trim());
      return {
        tool: response.action,
        toolInput: response.action_input,
        log: text,
      };
    } catch {
      throw new Error(
        `Unable to parse JSON response from chat agent.\n\n${text}`
      );
    }
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }
}
