import { 
  HederaAccountBalance,
  HederaTransfer,
  HederaCreateAccount,
  HederaDeleteAccount,
} from "@langchain/community/tools/hedera";
import { PrivateKey } from "@hashgraph/sdk"
import { StructuredTool } from "@langchain/core/tools";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { createOpenAIFunctionsAgent, AgentExecutor } from "langchain/agents";
import { pull } from "langchain/hub";

export async function run() {
    const llm = new ChatOpenAI({
        model: "gpt-3.5-turbo",
        temperature: 0,
      });
    
    // Initalize paramters for hedera tools to use
    const hederaParams = {
        credentials: {
          accountId: process.env.HEDERA_ACCOUNT_ID,
          privateKey: process.env.HEDERA_PRIVATE_KEY,
        },
        network: "testnet",
        maxTransactionFee: 100,
        maxQueryPayment: 50,
    };

    // Provide the hedera tools to be used
    const tools: StructuredTool[] = [
      new HederaAccountBalance(hederaParams),
      new HederaTransfer(hederaParams),
      new HederaCreateAccount(hederaParams),
      new HederaDeleteAccount(hederaParams),
    ];

    // Setup the agent to use the hedera tool
    const prompt = await pull<ChatPromptTemplate>(
        "hwchase17/openai-functions-agent"
      );
      
      const agent = await createOpenAIFunctionsAgent({
        llm,
        tools,
        prompt,
      });

      const agentExecutor = new AgentExecutor({
        agent,
        tools,
        verbose: false,
      });

      const newAccountPrivateKey = PrivateKey.generateED25519();
      const newAccountPublicKey = newAccountPrivateKey.publicKey;
      
       // Create hedera account
      const result1 = await agentExecutor.invoke({
        input: `Can you create an account with public key ${newAccountPublicKey}`,
      });
      console.log(result1.output);

      // Get the account balance of client operator
      const result2 = await agentExecutor.invoke({
        input: `What is my account balance`,
      });
      console.log(result2.output);

      // Get the account balance of a specific account
      const result3 = await agentExecutor.invoke({
        input: `What is the account balance of 0.0.1111111`,
      });
      console.log(result3.output);

      // Transfer tinybars between accounts
      const result4 = await agentExecutor.invoke({
        input: `Can you transfer 100000000 tinybars from my account to 0.0.1111111`,
      });
      console.log(result4.output);
}
