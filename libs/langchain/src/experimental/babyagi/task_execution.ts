import { PromptTemplate } from "@langchain/core/prompts";
import { LLMChain, LLMChainInput } from "../../chains/llm_chain.js";

/** Chain to execute tasks. */
export class TaskExecutionChain extends LLMChain {
  static lc_name() {
    return "TaskExecutionChain";
  }

  /**
   * A static factory method that creates an instance of TaskExecutionChain.
   * It constructs a prompt template for task execution, which is then used
   * to create a new instance of TaskExecutionChain. The prompt template
   * instructs an AI to perform a task based on a given objective, taking
   * into account previously completed tasks.
   * @param fields An object of type LLMChainInput, excluding the "prompt" field.
   * @returns An instance of LLMChain.
   */
  static fromLLM(fields: Omit<LLMChainInput, "prompt">): LLMChain {
    const executionTemplate =
      `You are an AI who performs one task based on the following objective: ` +
      `{objective}.` +
      `Take into account these previously completed tasks: {context}.` +
      ` Your task: {task}. Response:`;
    const prompt = new PromptTemplate({
      template: executionTemplate,
      inputVariables: ["objective", "context", "task"],
    });
    return new TaskExecutionChain({ prompt, ...fields });
  }
}
