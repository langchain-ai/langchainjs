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

test("deep nesting with manual tracer passed", async () => {
  const aiGreet = traceable(
    async (msg: BaseMessage) => {
      const child = RunnableLambda.from(async () => {
        const grandchild = RunnableLambda.from(async () => {
          const greatGrandchild = traceable(
            async () => {
              const greatGreatGrandchild = RunnableLambda.from(async () => {
                return [
                  new HumanMessage({ content: "From great great grandchild!" }),
                ];
              }).withConfig({ runName: "greatGreatGrandchild" });
              return greatGreatGrandchild.invoke({});
            },
            { name: "greatGrandchild", tracingEnabled: true }
          );
          return greatGrandchild({});
        }).withConfig({ runName: "grandchild" });
        return grandchild.invoke({});
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

test("runnable nested within a traceable with manual tracer passed", async () => {
  const child = RunnableLambda.from(async () => {
    const grandchild = RunnableLambda.from(async () => {
      return [new HumanMessage({ content: "From grandchild!" })];
    }).withConfig({ runName: "grandchild" });
    return grandchild.invoke({});
  }).withConfig({ runName: "child" });

  const parent = traceable(
    async () => {
      return child.invoke(
        {},
        {
          callbacks: [new LangChainTracer()],
        }
      );
    },
    { name: "parent", tracingEnabled: true }
  );

  await parent();

  await awaitAllCallbacks();
});
