import { test } from "@jest/globals";
import { traceable } from "langsmith/traceable";

import { RunnableLambda } from "../../runnables/base.js";
import { BaseMessage, HumanMessage } from "../../messages/index.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";

test("traceables double nested within runnables with batching", async () => {
  const aiGreet = traceable(
    async (msg: BaseMessage, name = "world") => {
      return msg.content + name;
    },
    { name: "aiGreet", tracingEnabled: true }
  );

  const root = RunnableLambda.from(async (messages: BaseMessage[]) => {
    const lastMsg = messages.at(-1) as HumanMessage;
    const greetOne = await RunnableLambda.from(async () => {
      const greetOne = await aiGreet(lastMsg, "David");
      return greetOne;
    }).invoke({});

    return [greetOne];
  });

  await root.invoke([new HumanMessage({ content: "Hello!" })]);

  await awaitAllCallbacks();
});
