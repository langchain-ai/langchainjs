import type { D1Database } from "@cloudflare/workers-types";

import { BufferMemory } from "langchain/memory";
import { CloudflareD1MessageHistory } from "langchain/stores/message/cloudflare_d1";
import { ChatAnthropic } from "langchain/chat_models/anthropic";
import { ChatPromptTemplate, MessagesPlaceholder } from "langchain/prompts";
import { RunnableSequence } from "langchain/schema/runnable";
import { StringOutputParser } from "langchain/schema/output_parser";

export interface Env {
  DB: D1Database;

  ANTHROPIC_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const { searchParams } = new URL(request.url);
      const input = searchParams.get("input");
      if (!input) {
        throw new Error(`Missing "input" parameter`);
      }
      const memory = new BufferMemory({
        returnMessages: true,
        chatHistory: new CloudflareD1MessageHistory({
          tableName: "stored_message",
          sessionId: "example",
          database: env.DB,
        }),
      });
      const prompt = ChatPromptTemplate.fromPromptMessages([
        ["system", "You are a helpful chatbot"],
        new MessagesPlaceholder("history"),
        ["human", "{input}"],
      ]);
      const model = new ChatAnthropic({
        anthropicApiKey: env.ANTHROPIC_API_KEY,
      });

      const chain = RunnableSequence.from([
        {
          input: (initialInput) => initialInput.input,
          memory: () => memory.loadMemoryVariables({}),
        },
        {
          input: (previousOutput) => previousOutput.input,
          history: (previousOutput) => previousOutput.memory.history,
        },
        prompt,
        model,
        new StringOutputParser(),
      ]);

      const chainInput = { input };

      const res = await chain.invoke(chainInput);
      await memory.saveContext(chainInput, {
        output: res,
      });

      return new Response(JSON.stringify(res), {
        headers: { "content-type": "application/json" },
      });
    } catch (err: any) {
      console.log(err.message);
      return new Response(err.message, { status: 500 });
    }
  },
};
