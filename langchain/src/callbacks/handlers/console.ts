import {
  AgentAction,
  AgentFinish,
  ChainValues,
  LLMResult,
} from "../../schema/index.js";
import { BaseCallbackHandler } from "../base.js";

export class ConsoleCallbackHandler extends BaseCallbackHandler {
  name = "console_callback_handler";

  handleLLMStart(llm: { name: string }, prompts: string[], runId: string) {
    console.log(
      `Starting LLM ${runId} with name ${llm.name} with prompts: ${prompts.join(
        ", "
      )}`
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleLLMError(err: any, runId: string) {
    console.log(`LLM ${runId} errored: ${err}`);
  }

  handleLLMEnd(output: LLMResult, runId: string) {
    console.log(`LLM ${runId} finished: ${output}`);
  }

  handleChainStart(chain: { name: string }) {
    console.log(`Entering new ${chain.name} chain...`);
  }

  handleChainEnd(_output: ChainValues) {
    console.log("Finished chain.");
  }

  handleAgentAction(action: AgentAction) {
    console.log(action.log);
  }

  handleToolEnd(output: string) {
    console.log(output);
  }

  handleText(text: string) {
    console.log(text);
  }

  handleAgentEnd(action: AgentFinish) {
    console.log(action.log);
  }
}
