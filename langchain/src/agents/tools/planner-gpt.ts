import { AgentExecutor } from "agents/index.js";
import { DynamicTool } from "../../agents/tools/index.js";

// was hoping to make it a general recursive agent, but that tended to blow up, instead a planning agent to get it to trigger a act on a large plan from a small input
export const gptTool = (executor: AgentExecutor): DynamicTool => {
  const gpt = new DynamicTool({
    name: "gpt-agent",
    description:
      "useful to develop a strategic multistep plan to solve a larger task. Input is the outcome to acheive",
    func: async (input: string) => {
      console.log(`Executing with input "${input}"...`);

      const result = await executor.call({
        input: `Develop a strategic plan to ${input}. Consider the background information, constraints, and relevant context of the organization or industry. Provide specific requirements or preferences for the plan, such as timelines or budget constraints`,
        chat_history: [],
      });

      return Promise.resolve(result.output);
    },
  });

  return gpt;
};
