import { ReadGoogleCalendar } from "agents/tools";
import { BaseChain, ChainValues } from "./base";
import { LLMChain } from "./llm_chain";

export class CalendarChain extends BaseChain {
  llmChain: LLMChain;
  constructor(fields: {
    llmChain: LLMChain;
    calendarTool: ReadGoogleCalendar;
  }) {
    super();
    this.llmChain = fields.llmChain;
  }

  async _call(values: ChainValues): Promise<ChainValues> {
    return this.llmChain.call();
  }
}
