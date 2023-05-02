import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";
import { OutputFixingParser } from "../../output_parsers/fix.js";
import { BaseLanguageModel } from "../../base_language/index.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";

export class StructuredChatOutputParser extends AgentActionOutputParser {
  async parse(text: string): Promise<AgentAction | AgentFinish> {
    const regex = /```(.*?)```?/gs;
    const actionMatch = regex.exec(text);

    if (actionMatch !== null) {
      const response = JSON.parse(actionMatch[1].trim());
      const { action, action_input } = response;

      if (action === "Final Answer") {
        return { returnValues: { output: action_input }, log: text };
      }
      return { tool: action, toolInput: action_input || {}, log: text };
    }
    return { returnValues: { output: text }, log: text };
  }

  getFormatInstructions(): string {
    return FORMAT_INSTRUCTIONS;
  }
}

export interface StructuredChatOutputParserArgs {
  baseParser?: StructuredChatOutputParser;
  outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;
}

export class StructuredChatOutputParserWithRetries extends AgentActionOutputParser {
  baseParser: StructuredChatOutputParser;

  outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;

  constructor(fields?: StructuredChatOutputParserArgs) {
    super();
    this.baseParser = fields?.baseParser ?? new StructuredChatOutputParser();
    this.outputFixingParser = fields?.outputFixingParser;
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    if (this.outputFixingParser !== undefined) {
      return this.outputFixingParser.parse(text);
    }
    return this.baseParser.parse(text);
  }

  getFormatInstructions(): string {
    return this.baseParser.getFormatInstructions();
  }

  static fromLLM(
    llm: BaseLanguageModel,
    baseParser: StructuredChatOutputParser = new StructuredChatOutputParser()
  ): StructuredChatOutputParserWithRetries {
    const outputFixingParser = OutputFixingParser.fromLLM(llm, baseParser);
    return new StructuredChatOutputParserWithRetries({
      baseParser,
      outputFixingParser,
    });
  }
}
