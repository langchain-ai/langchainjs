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

type ModelInfoConfig = {
  node?: boolean,
  delay?: number,
}

type ModelInfo = {
  model: string,
  defaultGoogleParams?: ChatGoogleParams | ChatGoogleNodeParams,
  testConfig?: ModelInfoConfig,
}

const testGoogleInfo: ModelInfo[] = [
  {
    model: "gemini-2.0-flash",
  },
  {
    model: "gemini-2.0-flash",
    testConfig: {
      node: true,
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
      // const logger = new GoogleRequestLogger();
      recorder = new GoogleRequestRecorder();
      callbacks = [recorder, new GoogleRequestLogger()];

      const useNode = testConfig?.node ?? false;
      if (useNode) {
        return new ChatGoogleNode({
          model,
          callbacks,
          ...(defaultGoogleParams ?? {}),
          ...(fields ?? {}),
        });

      } else {
        return new ChatGoogle({
          model,
          callbacks,
          ...(defaultGoogleParams ?? {}),
          ...(fields ?? {}),
        });
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
      expect(true).to.equal(true);
    })
  }
)