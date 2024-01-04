import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai.js";
import { ConversationChain } from "../conversation.js";

test("Test ConversationChain", async () => {
  const model = new OpenAI({ modelName: "gpt-3.5-turbo-instruct" });
  const chain = new ConversationChain({ llm: model });
  const res = await chain.call({ input: "my favorite color" });
  console.log({ res });
});
