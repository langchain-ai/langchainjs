import { expect, test } from "@jest/globals";
import { ChatMinimax } from "../minimax.js";

// test("Test ChatOpenAI", async () => {
//   const chat = new ChatMinimax({
//     modelName: "abab5.5-chat",
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       },
//     ],
//   });
//   const message = new HumanMessage("Hello!");
//   const res = await chat.call([message]);
//   console.log({ res });
// });

// test("Test ChatOpenAI with SystemChatMessage", async () => {
//   const chat = new ChatMinimax();
//   const system_message = new SystemMessage("You are to chat with a user.");
//   const message = new HumanMessage("Hello!");
//   const res = await chat.call([system_message, message]);
//   console.log({ res });
// });

// test("Test ChatOpenAI Generate", async () => {
//   const chat = new ChatMinimax({
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       },
//     ],
//   });
//   const message = new HumanMessage("Hello!");
//   const res = await chat.generate([[message], [message]]);
//   expect(res.generations.length).toBe(2);
//   for (const generation of res.generations) {
//     expect(generation.length).toBe(1);
//     for (const message of generation) {
//       console.log(message.text);
//       expect(typeof message.text).toBe("string");
//     }
//   }
//   console.log({ res });
// });

// test("Test ChatOpenAI Generate throws when one of the calls fails", async () => {
//   const chat = new ChatMinimax({
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       }]
//   });
//   const message = new HumanMessage("Hello!");
//   await expect(() =>
//     chat.generate([[message], [message]], {
//       signal: AbortSignal.timeout(10),
//     })
//   ).rejects.toThrow("TimeoutError: The operation was aborted due to timeout");
// });

// test("Test ChatOpenAI tokenUsage", async () => {
//   let tokenUsage = {
//     totalTokens: 0,
//   };
//
//   const model = new ChatMinimax({
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       }],
//       callbackManager: CallbackManager.fromHandlers({
//       async handleLLMEnd(output: LLMResult) {
//         tokenUsage = output.llmOutput?.tokenUsage;
//       },
//     }),
//   });
//   const message = new HumanMessage("Hello");
//   const res = await model.call([message]);
//   console.log({ res });
//
//   expect(tokenUsage.totalTokens).toBeGreaterThan(0);
// });

// test("Test ChatOpenAI tokenUsage with a batch", async () => {
//   let tokenUsage = {
//     totalTokens: 0,
//   };
//
//   const model = new ChatMinimax({
//     temperature: 0.01,
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       }],
//       callbackManager: CallbackManager.fromHandlers({
//       async handleLLMEnd(output: LLMResult) {
//         tokenUsage = output.llmOutput?.tokenUsage;
//       },
//     }),
//   });
//   const res = await model.generate([
//     [new HumanMessage("Hello")],
//     [new HumanMessage("Hi")],
//   ]);
//   console.log({ tokenUsage });
//   console.log(res);
//
//   expect(tokenUsage.totalTokens).toBeGreaterThan(0);
// });

// test("Test ChatOpenAI in streaming mode", async () => {
//   let nrNewTokens = 0;
//   let streamedCompletion = "";
//
//   const model = new ChatMinimax({
//     streaming: true,
//     tokensToGenerate: 10,
//     botSetting: [
//       {
//         bot_name: "MM Assistant",
//         content: "MM Assistant is an AI Assistant developed by minimax.",
//       }],
//       callbacks: [
//       {
//         async handleLLMNewToken(token: string) {
//           nrNewTokens += 1;
//           streamedCompletion += token;
//         },
//       },
//     ],
//   });
//   const message = new HumanMessage("Hello!");
//   const result = await model.call([message]);
//   console.log(result);
//
//   expect(nrNewTokens > 0).toBe(true);
//   expect(result.content).toBe(streamedCompletion);
// }, 10000);

// test("OpenAI Chat, docs, prompt templates", async () => {
//   const chat = new ChatMinimax({
//     temperature: 0.01,
//     tokensToGenerate: 10,
//   });
//
//   const systemPrompt = PromptTemplate.fromTemplate(
//     "You are a helpful assistant that translates {input_language} to {output_language}."
//   );
//
//   const chatPrompt = ChatPromptTemplate.fromPromptMessages([
//     new SystemMessagePromptTemplate(systemPrompt),
//     HumanMessagePromptTemplate.fromTemplate("{text}"),
//   ]);
//
//   const responseA = await chat.generatePrompt([
//     await chatPrompt.formatPromptValue({
//       input_language: "English",
//       output_language: "French",
//       text: "I love programming.",
//     }),
//   ]);
//
//   console.log(responseA.generations);
// }, 5000);

// test("Test OpenAI with signal in call options", async () => {
//   const model = new ChatMinimax({ tokensToGenerate: 5 });
//   const controller = new AbortController();
//   await expect(() => {
//     const ret = model.call([new HumanMessage("Print hello world")], {
//       signal: controller.signal
//     });
//
//     controller.abort();
//
//     return ret;
//   }).rejects.toThrow();
// }, 5000);

// test("Test OpenAI with specific roles in ChatMessage", async () => {
//   const chat = new ChatMinimax({ tokensToGenerate: 10 });
//   const system_message = new ChatMessage(
//     "You are to chat with a user.",
//     "system"
//   );
//   const user_message = new ChatMessage("Hello!", "user");
//   const res = await chat.call([system_message, user_message]);
//   console.log({ res });
// });

test("Test ChatOpenAI stream method", async () => {
  const model = new ChatMinimax({
    tokensToGenerate: 50,
    botSetting: [
      {
        bot_name: "MM Assistant",
        content: "MM Assistant is an AI Assistant developed by minimax.",
      },
    ],
  });
  const stream = await model.stream("Print hello world.");
  const chunks = [];
  for await (const chunk of stream) {
    console.log(chunk);
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(1);
});
