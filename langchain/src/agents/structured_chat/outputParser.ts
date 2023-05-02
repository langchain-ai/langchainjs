import { AgentActionOutputParser } from "../types.js";
import { FORMAT_INSTRUCTIONS } from "./prompt.js";
import {
    OutputFixingParser,
  } from "langchain/output_parsers";
import { BaseLanguageModel } from "base_language/index.js";


export class StructuredChatOutputParser extends AgentActionOutputParser {
    async parse(text: string){
      const regex = /```(.*?)```?/gs;
      const actionMatch = regex.exec(text);
  
      if (actionMatch !== null) {
        const response = JSON.parse(actionMatch[1].trim());
        const { action, action_input } = response;
  
        if (action === "Final Answer") {
          return { returnValues: { output: action_input }, log: text };
        } else {
          return { tool: action, toolInput: action_input || {}, log: text };
        }
      } else {
        return { returnValues: { output: text }, log: text };
      }
    }
  
    getFormatInstructions(): string {
      return FORMAT_INSTRUCTIONS;
    }
  }
  
  
  export class StructuredChatOutputParserWithRetries extends AgentActionOutputParser {
    baseParser: StructuredChatOutputParser;
    outputFixingParser: OutputFixingParser | null;
  
    constructor(
      baseParser?: StructuredChatOutputParser,
      outputFixingParser?: OutputFixingParser
    ) {
      super();
      this.baseParser = baseParser || new StructuredChatOutputParser();
      this.outputFixingParser = outputFixingParser || null;
    }
  
    async parse(text: string){
      if (this.outputFixingParser !== null) {
        // Call the parse method of outputFixingParser, which should return the same structure as the baseParser
        return await this.outputFixingParser.parse(text);
      } else {
        return  await this.baseParser.parse(text);
      }
    }
  
    getFormatInstructions(): string {
      return FORMAT_INSTRUCTIONS;
    }
  
    static fromLLM(
      llm?: BaseLanguageModel,
      baseParser?: StructuredChatOutputParser
    ): StructuredChatOutputParserWithRetries {
      if (llm !== undefined) {
        baseParser = baseParser || new StructuredChatOutputParser();
        const outputFixingParser = new OutputFixingParser(/* pass necessary arguments here */);
        return new StructuredChatOutputParserWithRetries(baseParser, outputFixingParser);
      } else if (baseParser !== undefined) {
        return new StructuredChatOutputParserWithRetries(baseParser);
      } else {
        return new StructuredChatOutputParserWithRetries();
      }
    }
  }
  
