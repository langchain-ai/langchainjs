import { OutputParserException } from "@langchain/core/output_parsers";
import { OutputParserArgs } from "../agent.js";
import { AgentActionOutputParser } from "../types.js";

import { FORMAT_INSTRUCTIONS } from "./prompt.js";

export const FINAL_ANSWER_ACTION = "Final Answer:";
/**
 * A class that extends `AgentActionOutputParser` to provide a custom
 * implementation for parsing the output of a ZeroShotAgent action.
 */
export class ZeroShotAgentOutputParser extends AgentActionOutputParser {
  lc_namespace = ["langchain", "agents", "mrkl"];

  finishToolName: string;

  constructor(fields?: OutputParserArgs) {
    super(fields);
    this.finishToolName = fields?.finishToolName || FINAL_ANSWER_ACTION;
  }

  /**
   * Parses the text output of an agent action, extracting the tool, tool
   * input, and output.
   * @param text The text output of an agent action.
   * @returns An object containing the tool, tool input, and output extracted from the text, along with the original text as a log.
   */
  async parse(text: string) {
    if (text.includes(this.finishToolName)) {
      const parts = text.split(this.finishToolName);
      const output = parts[parts.length - 1].trim();
      return {
        returnValues: { output },
        log: text,
      };
    }

    const match = /Action:([\s\S]*?)(?:\nAction Input:([\s\S]*?))?$/.exec(text);
    if (!match) {
      throw new OutputParserException(`Could not parse LLM output: ${text}`);
    }

    return {
      tool: match[1].trim(),
      toolInput: match[2]
        ? match[2].trim().replace(/^("+)(.*?)(\1)$/, "$2")
        : "",
      log: text,
    };
  }

  /**
   * Returns the format instructions for parsing the output of an agent
   * action in the style of the ZeroShotAgent.
   * @returns The format instructions for parsing the output.
   */
  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }
}
