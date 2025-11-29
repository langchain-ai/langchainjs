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
import { AIMessage } from "@langchain/core/messages";

type ModelInfoConfig = {
  node?: boolean,
  useApiKey?: boolean, // Should we set the API key from TEST_API_KEY
  useCredentials?: boolean, // Should we set the credentials from TEST_CREDENTIALS
  delay?: number,
}

type ModelInfo = {
  model: string,
  defaultGoogleParams?: Omit<ChatGoogleParams | ChatGoogleNodeParams, "model">,
  testConfig?: ModelInfoConfig,
}

const testGoogleInfo: ModelInfo[] = [
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

describe.each(testGoogleInfo)(
  "Google ($model) $testConfig",
  ({model, defaultGoogleParams, testConfig}: ModelInfo) => {

    let recorder: GoogleRequestRecorder;
    let callbacks: BaseCallbackHandler[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let warnSpy: MockInstance<any>;

    function newChatGoogle(fields?: ChatGoogleParams | ChatGoogleNodeParams): ChatGoogle | ChatGoogleNode {
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

    test("invoke", async () => {
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
    })
  }
)