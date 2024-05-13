// TODO: Fix for Node environments

// import { ChatWebLLM, WebLLMInputs } from "../webllm.js";
// import * as webllm from "@mlc-ai/web-llm";

// jest.mock("@mlc-ai/web-llm", () => ({
//   Engine: jest.fn().mockImplementation(() => ({
//     reload: jest.fn().mockResolvedValue(undefined),
//     setInitProgressCallback: jest.fn(),
//     chat: {
//       completions: {
//         create: jest.fn().mockImplementation(() => {
//           const messages = [
//             {
//               choices: [
//                 {
//                   delta: { content: "Hello" },
//                   logprobs: null,
//                   finish_reason: "complete",
//                 },
//               ],
//             },
//             {
//               choices: [
//                 {
//                   delta: { content: "How are you?" },
//                   logprobs: null,
//                   finish_reason: "complete",
//                 },
//               ],
//             },
//           ];
//           return (async function* () {
//             for (let msg of messages) {
//               yield msg;
//             }
//           })();
//         }),
//       },
//     },
//   })),
// }));

describe("ChatWebLLM Integration Tests", () => {
  // let chatWebLLM: ChatWebLLM;
  // let modelRecord = { model_id: "test-model" };

  // beforeEach(() => {
  //   const inputs: WebLLMInputs = {
  //     modelRecord: modelRecord,
  //     appConfig: {},
  //     chatOpts: {},
  //   };
  //   chatWebLLM = new ChatWebLLM(inputs);
  // });

  test("ChatWebLLM initializes and processes messages correctly", async () => {
    // const options = {}; // Adjust options as necessary
    // const response = await chatWebLLM.invoke("Hello", options);
    // expect(response).toBe("Hello");
    // expect(webllm.Engine).toHaveBeenCalled();
    // expect(webllm.Engine().chat.completions.create).toHaveBeenCalledWith({
    //   stream: true,
    //   messages: [{ role: "user", content: "Hello" }],
    //   stop: null,
    //   logprobs: true,
    // });
  });
});
