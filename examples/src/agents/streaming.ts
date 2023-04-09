import { LLMChain } from "langchain/chains";
import { AgentExecutor, ZeroShotAgent } from "langchain/agents";
import { CallbackManager } from "langchain/callbacks";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Calculator } from "langchain/tools/calculator";

export const run = async () => {
  // Create a callback manager that will be used throughout
  const callbackManager = CallbackManager.fromHandlers({
    async handleLLMNewToken(token: string) {
      console.log("token", { token });
    },
    async handleLLMStart(llm, _prompts: string[]) {
      console.log("handleLLMStart", { llm });
    },
    async handleChainStart(chain) {
      console.log("handleChainStart", { chain });
    },
    async handleAgentAction(action) {
      console.log("handleAgentAction", action);
    },
    async handleToolStart(tool) {
      console.log("handleToolStart", { tool });
    },
  });

  const model = new ChatOpenAI({
    temperature: 0,
    callbackManager, // this is needed to see handleLLMStart and handleLLMNewToken
    streaming: true, // needed to enable streaming, which enables handleLLMNewToken
  });

  const tools = [
    new Calculator(
      true,
      callbackManager /* this is needed to see handleToolStart */
    ),
  ];
  const agentPrompt = ZeroShotAgent.createPrompt(tools);
  const llmChain = new LLMChain({
    llm: model,
    prompt: agentPrompt,
    callbackManager, // this is needed to see handleChainStart
  });
  const agent = new ZeroShotAgent({
    llmChain,
    allowedTools: ["search"],
  });

  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
    callbackManager, // this is needed to see handleAgentAction
  });

  const result = await agentExecutor.call({
    input: "What is 2 to the power of 8",
  });
  /*
  handleChainStart { chain: { name: 'agent_executor' } }
  handleChainStart { chain: { name: 'llm_chain' } }
  handleLLMStart { llm: { name: 'openai' } }
  token { token: '' }
  token { token: 'I' }
  token { token: ' need' }
  token { token: ' to' }
  token { token: ' calculate' }
  token { token: ' ' }
  token { token: '2' }
  token { token: ' raised' }
  token { token: ' to' }
  token { token: ' the' }
  token { token: ' power' }
  token { token: ' of' }
  token { token: ' ' }
  token { token: '8' }
  token { token: '\n' }
  token { token: 'Action' }
  token { token: ':' }
  token { token: ' calculator' }
  token { token: '\n' }
  token { token: 'Action' }
  token { token: ' Input' }
  token { token: ':' }
  token { token: ' ' }
  token { token: '2' }
  token { token: '^' }
  token { token: '8' }
  token { token: '' }
  handleAgentAction {
    tool: 'calculator',
    toolInput: '2^8',
    log: 'I need to calculate 2 raised to the power of 8\n' +
      'Action: calculator\n' +
      'Action Input: 2^8'
  }
  handleToolStart { tool: { name: 'calculator' } }
  handleChainStart { chain: { name: 'llm_chain' } }
  handleLLMStart { llm: { name: 'openai' } }
  token { token: '' }
  token { token: 'That' }
  token { token: "'s" }
  token { token: ' the' }
  token { token: ' answer' }
  token { token: ' to' }
  token { token: ' the' }
  token { token: ' question' }
  token { token: '\n' }
  token { token: 'Final' }
  token { token: ' Answer' }
  token { token: ':' }
  token { token: ' ' }
  token { token: '256' }
  token { token: '' }
  */

  console.log(result);
  /*
  { output: '256' }
  */
};
