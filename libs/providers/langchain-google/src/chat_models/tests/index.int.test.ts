import { afterEach, beforeEach, describe, expect, MockInstance, test, vi } from "vitest";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import {
  ChatGoogle,
  ChatGoogleParams,
  GoogleRequestLogger,
  GoogleRequestRecorder,
} from "../../index.js";
import {
  ChatGoogle as ChatGoogleNode,
  ChatGoogleParams as ChatGoogleNodeParams,
} from "../../node.js";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { AIMessage, BaseMessageChunk, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { ChatPromptValue } from "@langchain/core/prompt_values";

type ModelInfoConfig = {
  node?: boolean,
  useApiKey?: boolean, // Should we set the API key from TEST_API_KEY
  useCredentials?: boolean, // Should we set the credentials from TEST_CREDENTIALS
  only?: boolean,
  skip?: boolean,
  delay?: number,
}

type DefaultGoogleParams = Omit<ChatGoogleParams | ChatGoogleNodeParams, "model">;

type ModelInfo = {
  model: string,
  defaultGoogleParams?: DefaultGoogleParams,
  testConfig?: ModelInfoConfig,
}

const allModelInfo: ModelInfo[] = [
  {
    model: "gemini-2.0-flash-lite",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash-lite",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.0-flash-lite",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-flash-lite",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-flash",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-2.5-pro",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      useApiKey: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      node: true,
    }
  },
  {
    model: "gemini-3-pro-preview",
    testConfig: {
      node: true,
      useApiKey: true,
    }
  },
];

function filterTestableModels(): ModelInfo[] {
  const modelsWithOnly = allModelInfo.filter(
    (modelInfo) => modelInfo.testConfig?.only === true
  );

  const startingModels = modelsWithOnly.length > 0
    ? modelsWithOnly
    : allModelInfo;

  return startingModels.filter(
    (modelInfo) => modelInfo.testConfig?.skip !== true
  );
}

const coreModelInfo: ModelInfo[] = filterTestableModels();

describe.each(coreModelInfo)(
  "Google ($model) $testConfig",
  ({model, defaultGoogleParams, testConfig}: ModelInfo) => {

    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let warnSpy: MockInstance<any>;

    function newChatGoogle(fields?: DefaultGoogleParams): ChatGoogle | ChatGoogleNode {
      recorder = new GoogleRequestRecorder();
      callbacks = [recorder, new GoogleRequestLogger()];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configParams: ChatGoogleParams | ChatGoogleNodeParams | Record<string,any> = {};
      const useNode = testConfig?.node ?? false;
      const useApiKey = testConfig?.useApiKey ?? !useNode;
      if (useApiKey) {
        configParams.apiKey = getEnvironmentVariable("TEST_API_KEY");
      }

      const params = {
        model,
        callbacks,
        ...configParams,
        ...(defaultGoogleParams ?? {}),
        ...(fields ?? {}),
      };
      if (useNode) {
        return new ChatGoogleNode(params);

      } else {
        return new ChatGoogle(params);
      }

    }

    beforeEach(async () => {
      warnSpy = vi.spyOn(global.console, "warn");
      const delay = testConfig?.delay ?? 0;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    test.skip("invoke", async () => {
      const llm = newChatGoogle();
      const result = await llm.invoke("What is 1 + 1?");
      console.log(result);

      expect(AIMessage.isInstance(result)).to.equal(true);

      expect(result.content as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      expect(Array.isArray(result.contentBlocks)).to.equal(true);
      expect(result.contentBlocks.length).to.equal(1);

      const contentBlock = result.contentBlocks[0];
      expect(contentBlock.type).to.equal("text");
      expect(contentBlock.text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
    });

    test.skip("invoke seed", async () => {
      const llm = newChatGoogle({
        seed: 6,
      });
      const result = await llm.invoke("What is 1 + 1?");
      console.log(result);

      expect(AIMessage.isInstance(result)).to.equal(true);

      expect(result.content as string).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);

      expect(Array.isArray(result.contentBlocks)).to.equal(true);
      expect(result.contentBlocks.length).to.equal(1);

      const contentBlock = result.contentBlocks[0];
      expect(contentBlock.type).to.equal("text");
      expect(contentBlock.text).toMatch(/(1 + 1 (equals|is|=) )?2.? ?/);
    });

    test("stream", async () => {
      const model = newChatGoogle();
      const input: BaseLanguageModelInput = new ChatPromptValue([
        new SystemMessage(
          "You will reply to all requests with as much detail as you can."
        ),
        new HumanMessage(
          "What is the answer to life, the universe, and everything?"
        ),
      ]);
      const res = await model.stream(input);
      const resArray: BaseMessageChunk[] = [];
      for await (const chunk of res) {
        resArray.push(chunk);
      }
      expect(resArray).toBeDefined();
      expect(resArray.length).toBeGreaterThanOrEqual(1);

      // resArray.forEach((chunk, index) => {
      // })

      const firstChunk = resArray[0];
      expect(firstChunk).toBeDefined();
      expect(firstChunk.response_metadata).not.toHaveProperty("usage_metadata");

      const lastChunk = resArray[resArray.length - 1];
      expect(lastChunk).toBeDefined();
      expect(lastChunk.type).toEqual("ai");
      expect(lastChunk).toHaveProperty("usage_metadata");

      expect(warnSpy).not.toHaveBeenCalled();
    });

  }
)