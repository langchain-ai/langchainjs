import { test } from "@jest/globals";
import { OpenAI } from "../../llms/openai";
import { ConversationChain } from "../conversation";

test("Test ConversationChain", async () => {
  const model = new OpenAI({});
  const chain = new ConversationChain({ llm: model });
  const res = await chain.call({ input: "my favorite color" });
  console.log({ res });
});
