import { test } from "@jest/globals";
import { traceable } from "langsmith/traceable";

import { RunnableLambda } from "../../runnables/base.js";
import { BaseMessage, HumanMessage } from "../../messages/index.js";
import { awaitAllCallbacks } from "../../singletons/callbacks.js";
import { LangChainTracer } from "../tracer_langchain.js";

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

test("runnable nested within a traceable with manual tracer passed", async () => {
  const aiGreet = traceable(
    async (msg: BaseMessage) => {
      const child = RunnableLambda.from(async () => {
        return [new HumanMessage({ content: "From child!" })];
      }).withConfig({ runName: "child" });
      return child.invoke([msg]);
    },
    { name: "aiGreet", tracingEnabled: true }
  );

  const parent = RunnableLambda.from(async () => {
    return aiGreet(new HumanMessage({ content: "Hello!" }));
  }).withConfig({ runName: "parent" });

  await parent.invoke(
    {},
    {
      callbacks: [new LangChainTracer()],
    }
  );

  await awaitAllCallbacks();
});
