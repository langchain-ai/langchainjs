import {
  OutlookReadMailTool,
  OutlookSendMailTool,
} from "@langchain/community/tools/outlook";
import { ChatOpenAI } from "@langchain/openai";
import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

async function AgentRead() {
  const llm = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
  });

  const outlookReadMail = new OutlookReadMailTool(undefined, "token");
  const tools = [outlookReadMail];
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
  });

  const input = "show my emails";
  const result = await agentExecutor.invoke({ input });

  console.log(result);
}

AgentRead();

async function AgentSend() {
  const llm = new ChatOpenAI({
    modelName: "gpt-4",
  });

  const sendMailTool = new OutlookSendMailTool(undefined, "token");
  const tools = [sendMailTool];
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
  });

  const input =
    "send an email to YOUR_EMAIL and invite him to a meeting at 3pm tomorrow";
  const result = await agentExecutor.invoke({ input });

  console.log(result);
}

AgentSend();
