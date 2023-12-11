import { LLMChain } from "langchain/chains";
import { AgentExecutor, ZeroShotAgent } from "langchain/agents";
import { BaseCallbackHandler } from "langchain/callbacks";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Calculator } from "langchain/tools/calculator";
import { AgentAction } from "langchain/schema";
import { Serialized } from "langchain/load/serializable";

export const run = async () => {
  // You can implement your own callback handler by extending BaseCallbackHandler
  class CustomHandler extends BaseCallbackHandler {
    name = "custom_handler";

    handleLLMNewToken(token: string) {
      console.log("token", { token });
    }

    handleLLMStart(llm: Serialized, _prompts: string[]) {
      console.log("handleLLMStart", { llm });
    }

    handleChainStart(chain: Serialized) {
      console.log("handleChainStart", { chain });
    }

    handleAgentAction(action: AgentAction) {
      console.log("handleAgentAction", action);
    }

    handleToolStart(tool: Serialized) {
      console.log("handleToolStart", { tool });
    }
  }

  const handler1 = new CustomHandler();

  // Additionally, you can use the `fromMethods` method to create a callback handler
  const handler2 = BaseCallbackHandler.fromMethods({
    handleLLMStart(llm, _prompts: string[]) {
      console.log("handleLLMStart: I'm the second handler!!", { llm });
    },
    handleChainStart(chain) {
      console.log("handleChainStart: I'm the second handler!!", { chain });
    },
    handleAgentAction(action) {
      console.log("handleAgentAction", action);
    },
    handleToolStart(tool) {
      console.log("handleToolStart", { tool });
    },
  });

  // You can restrict callbacks to a particular object by passing it upon creation
  const model = new ChatOpenAI({
    temperature: 0,
    callbacks: [handler2], // this will issue handler2 callbacks related to this model
    streaming: true, // needed to enable streaming, which enables handleLLMNewToken
  });

  const tools = [new Calculator()];
  const agentPrompt = ZeroShotAgent.createPrompt(tools);

  const llmChain = new LLMChain({
    llm: model,
    prompt: agentPrompt,
    callbacks: [handler2], // this will issue handler2 callbacks related to this chain
  });
  const agent = new ZeroShotAgent({
    llmChain,
    allowedTools: ["search"],
  });

  const agentExecutor = AgentExecutor.fromAgentAndTools({
    agent,
    tools,
  });

  /*
   * When we pass the callback handler to the agent executor, it will be used for all
   * callbacks related to the agent and all the objects involved in the agent's
   * execution, in this case, the Tool, LLMChain, and LLM.
   *
   * The `handler2` callback handler will only be used for callbacks related to the
   * LLMChain and LLM, since we passed it to the LLMChain and LLM objects upon creation.
   */
  const result = await agentExecutor.invoke(
    {
      input: "What is 2 to the power of 8",
    },
    { callbacks: [handler1] }
  ); // this is needed to see handleAgentAction
  /*
  handleChainStart { chain: { name: 'agent_executor' } }
  handleChainStart { chain: { name: 'llm_chain' } }
  handleChainStart: I'm the second handler!! { chain: { name: 'llm_chain' } }
  handleLLMStart { llm: { name: 'openai' } }
  handleLLMStart: I'm the second handler!! { llm: { name: 'openai' } }
  token { token: '' }
  token { token: 'I' }
  token { token: ' can' }
  token { token: ' use' }
  token { token: ' the' }
  token { token: ' calculator' }
  token { token: ' tool' }
  token { token: ' to' }
  token { token: ' solve' }
  token { token: ' this' }
  token { token: '.\n' }
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
    log: 'I can use the calculator tool to solve this.\n' +
      'Action: calculator\n' +
      'Action Input: 2^8'
  }
  handleToolStart { tool: { name: 'calculator' } }
  handleChainStart { chain: { name: 'llm_chain' } }
  handleChainStart: I'm the second handler!! { chain: { name: 'llm_chain' } }
  handleLLMStart { llm: { name: 'openai' } }
  handleLLMStart: I'm the second handler!! { llm: { name: 'openai' } }
  token { token: '' }
  token { token: 'That' }
  token { token: ' was' }
  token { token: ' easy' }
  token { token: '!\n' }
  token { token: 'Final' }
  token { token: ' Answer' }
  token { token: ':' }
  token { token: ' ' }
  token { token: '256' }
  token { token: '' }
  */

  console.log(result);
  /*
  {
    output: '256',
    __run: { runId: '26d481a6-4410-4f39-b74d-f9a4f572379a' }
  }
  */
};
