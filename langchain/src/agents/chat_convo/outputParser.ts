import {
  FormatInstructionsOptions,
  OutputParserException,
} from "../../schema/output_parser.js";
import { renderTemplate } from "../../prompts/template.js";
import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";
import { AgentAction, AgentFinish } from "../../schema/index.js";
import { OutputFixingParser } from "../../output_parsers/fix.js";
import { BaseLanguageModel } from "../../base_language/index.js";

export type ChatConversationalAgentOutputParserFormatInstructionsOptions =
  FormatInstructionsOptions & {
    toolNames: string[];
    raw?: boolean;
  };

export class ChatConversationalAgentOutputParser extends AgentActionOutputParser {
  constructor(private toolNames: string[]) {
    super();
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
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

    try {
      const response = JSON.parse(jsonOutput);

      const { action, action_input } = response;

      if (action === "Final Answer") {
        return { returnValues: { output: action_input }, log: text };
      }
      return { tool: action, toolInput: action_input, log: text };
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`
      );
    }
  }

  getFormatInstructions(): string {
    return renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: this.toolNames.join(", "),
    });
  }
}

export type ChatConversationalAgentOutputParserArgs = {
  baseParser?: ChatConversationalAgentOutputParser;
  outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;
  toolNames?: string[];
};

export class ChatConversationalAgentOutputParserWithRetries extends AgentActionOutputParser {
  private baseParser: ChatConversationalAgentOutputParser;

  private outputFixingParser?: OutputFixingParser<AgentAction | AgentFinish>;

  private toolNames: string[] = [];

  constructor(fields: ChatConversationalAgentOutputParserArgs) {
    super();
    this.toolNames = fields.toolNames ?? this.toolNames;
    this.baseParser =
      fields?.baseParser ??
      new ChatConversationalAgentOutputParser(this.toolNames);
    this.outputFixingParser = fields?.outputFixingParser;
  }

  getFormatInstructions(
    options: ChatConversationalAgentOutputParserFormatInstructionsOptions
  ): string {
    if (options.raw) {
      return FORMAT_INSTRUCTIONS;
    }
    return renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: options.toolNames.join(", "),
    });
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    if (this.outputFixingParser !== undefined) {
      return this.outputFixingParser.parse(text);
    }
    return this.baseParser.parse(text);
  }

  static fromLLM(
    llm: BaseLanguageModel,
    options: Omit<ChatConversationalAgentOutputParserArgs, "outputFixingParser">
  ): ChatConversationalAgentOutputParserWithRetries {
    const baseParser =
      options.baseParser ??
      new ChatConversationalAgentOutputParser(options.toolNames ?? []);
    const outputFixingParser = OutputFixingParser.fromLLM(llm, baseParser);
    return new ChatConversationalAgentOutputParserWithRetries({
      baseParser,
      outputFixingParser,
      toolNames: options.toolNames,
    });
  }
}
