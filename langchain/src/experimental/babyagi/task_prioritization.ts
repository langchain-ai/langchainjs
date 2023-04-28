import { LLMChain, LLMChainInput } from "../../chains/llm_chain.js";
import { PromptTemplate } from "../../prompts/prompt.js";

/** Chain to prioritize tasks. */
export class TaskPrioritizationChain extends LLMChain {
  static fromLLM(fields: Omit<LLMChainInput, "prompt">): LLMChain {
    const taskPrioritizationTemplate =
      `You are a task prioritization AI tasked with cleaning the formatting of ` +
      `and reprioritizing the following tasks: {task_names}.` +
      ` Consider the ultimate objective of your team: {objective}.` +
      ` Do not remove any tasks. Return the result as a numbered list, like:` +
      ` #. First task` +
      ` #. Second task` +
      ` Start the task list with number {next_task_id}.`;
    const prompt = new PromptTemplate({
      template: taskPrioritizationTemplate,
      inputVariables: ["task_names", "next_task_id", "objective"],
    });
    return new TaskPrioritizationChain({ prompt, ...fields });
  }
}
