import { ReadGoogleCalendar } from "agents/tools";

import { BaseChain, ChainValues, LLMChain, SerializedLLMChain } from "./index";
import { BaseLLM } from "../llms";
import { PromptTemplate } from "../prompts";

import { resolveConfigFromFile } from "../util";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type LoadValues = Record<string, any>;
const template = `You are given the following calendar events.

{calendar_context}

Answer the following question about those events.
Question: {question}
Answer:`;
const prompt = PromptTemplate.fromTemplate(template);
export type SerializedCalendarChain = {
  _type: "calendar_chain";
  llm_chain?: SerializedLLMChain;
  llm_chain_path?: string;
};

export class CalendarChain extends BaseChain {
  llmChain: LLMChain;

  calendarTool: ReadGoogleCalendar;

  calendarContextKey = "calendar_context";

  outputKey = "answer";

  constructor(fields: {
    llmChain: LLMChain;
    calendarTool: ReadGoogleCalendar;
    inputKey?: string;
    outputKey?: string;
  }) {
    super();
    this.llmChain = fields.llmChain;
    this.calendarTool = fields.calendarTool;
    this.calendarContextKey = fields.inputKey ?? this.calendarContextKey;
    this.outputKey = fields.outputKey ?? this.outputKey;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    const calendarContext = await this.calendarTool.call("");
    const result = await this.llmChain.call({
      ...values,
      [this.calendarContextKey]: calendarContext,
    });
    return result;
  }

  _chainType() {
    return "calendar_chain" as const;
  }

  static async deserialize(data: SerializedCalendarChain, values: LoadValues) {
    if (!("calendarTool" in values)) {
      throw new Error(
        `Need to pass in a calendarTool to deserialize CalendarChain`
      );
    }
    const { calendarTool } = values;
    const SerializedLLMChain = resolveConfigFromFile<
      "llm_chain",
      SerializedLLMChain
    >("llm_chain", data);

    return new CalendarChain({
      llmChain: await LLMChain.deserialize(SerializedLLMChain),
      calendarTool,
    });
  }

  serialize(): SerializedCalendarChain {
    return {
      _type: this._chainType(),
      llm_chain: this.llmChain.serialize(),
    };
  }

  static fromLLM(
    llm: BaseLLM,
    calendarTool: ReadGoogleCalendar
  ): CalendarChain {
    const llmChain = new LLMChain({
      prompt,
      llm,
    });
    const instance = new this({ llmChain, calendarTool });
    return instance;
  }
}
