// import { traceable } from "langsmith/traceable";

// import { RunnableLambda, RunnableMap } from "../../runnables/base.js";
// import { AIMessage, BaseMessage, HumanMessage } from "../../messages/index.js";
// import { LangChainTracer } from "../../tracers/tracer_langchain.js";
// // import { Client } from "langsmith";
// // const client = new Client({
// // apiKey: "ls__5ee8c61b353f4ba6912ffefe40088608",
// // apiUrl: "http://127.0.0.1:1984",
// // });

// test("x", async () => {
//   const tracer = new LangChainTracer({});

//   const concatMsg = traceable(
//     async (msg: string, name = "world") => {
//       const nested = RunnableLambda.from(async () => {
//         return "nested";
//       });
//       await nested.invoke({});
//       return `${msg} ${name}`;
//     },
//     {
//       name: "concat_msg",
//     }
//   );

//   const aiGreet = traceable(
//     async (msg: BaseMessage, name = "world") =>
//       new AIMessage({ content: await concatMsg(msg.content as string, name) }),
//     { name: "aiGreet" }
//   );

//   const root = RunnableLambda.from(async (messages: BaseMessage[]) => {
//     const lastMsg = messages.at(-1) as HumanMessage;
//     const greetOne = await aiGreet(lastMsg, "David");
//     const greetTwo = await aiGreet(lastMsg, "Pavel");

//     return [greetOne, greetTwo];
//   });

//   const map = RunnableMap.from({ messages: root });

//   console.log(
//     await map.invoke([new HumanMessage({ content: "Hello!" })], {
//       callbacks: [tracer],
//     })
//   );
// });
