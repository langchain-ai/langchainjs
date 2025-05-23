/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseChatModel } from "@langchain/core/language_models/chat_models";

import { OciGenAiCohereChat } from "../cohere_chat.js";
import { OciGenAiGenericChat } from "../generic_chat.js";

type OciGenAiChatConstructor = new (args: any) => BaseChatModel;

/*
 *  OciGenAiChat tests
 */

const compartmentId = process.env.OCI_GENAI_INTEGRATION_TESTS_COMPARTMENT_ID;
const creationParameters = [
  [
    {
      compartmentId,
      onDemandModelId:
        process.env.OCI_GENAI_INTEGRATION_TESTS_COHERE_ON_DEMAND_MODEL_ID,
    },
  ],
  [
    {
      compartmentId,
      onDemandModelId:
        process.env.OCI_GENAI_INTEGRATION_TESTS_GENERIC_ON_DEMAND_MODEL_ID,
    },
  ],
];

test("OCI GenAI chat invoke", async () => {
  await testEachChatModelType(
    async (ChatClassType: OciGenAiChatConstructor, creationParams: any[]) => {
      for (const params of creationParams) {
        const chatClass = new ChatClassType(params);
        const response = await chatClass.invoke(
          "generate a single, very short mission statement for a pet insurance company"
        );
        expect(response.content.length).toBeGreaterThan(0);
      }
    },
    creationParameters
  );
});

/*
 * Utils
 */

async function testEachChatModelType(
  testFunction: (
    ChatClassType: OciGenAiChatConstructor,
    parameter?: any | undefined
  ) => Promise<void>,
  parameters?: any[]
) {
  const chatClassTypes: OciGenAiChatConstructor[] = [
    OciGenAiCohereChat,
    OciGenAiGenericChat,
  ];

  for (let i = 0; i < chatClassTypes.length; i += 1) {
    await testFunction(chatClassTypes[i], parameters?.at(i));
  }
}