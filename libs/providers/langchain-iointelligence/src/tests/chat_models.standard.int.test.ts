import { ChatModelIntegrationTests } from "@langchain/standard-tests/vitest";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  ChatIOIntelligence,
  ChatIOIntelligenceCallOptions,
} from "../chat_models.js";

class ChatIOIntelligenceStandardIntegrationTests extends ChatModelIntegrationTests<
  ChatIOIntelligenceCallOptions,
  AIMessageChunk
> {
  constructor() {
    if (!process.env.IO_INTELLIGENCE_API_KEY) {
      throw new Error(
        "IO_INTELLIGENCE_API_KEY must be set to run standard integration tests."
      );
    }
    super({
      Cls: ChatIOIntelligence,
      chatModelHasToolCalling: true,
      chatModelHasStructuredOutput: true,
      constructorArgs: {
        model: "meta-llama/Llama-3.3-70B-Instruct",
        maxRetries: 0,
      },
    });
  }

  supportedUsageMetadataDetails: {
    invoke: Array<"audio_input" | "audio_output">;
    stream: Array<"audio_input" | "audio_output">;
  } = {
    invoke: [],
    stream: [],
  };
}

const testClass = new ChatIOIntelligenceStandardIntegrationTests();
testClass.runTests("ChatIOIntelligenceStandardIntegrationTests");
