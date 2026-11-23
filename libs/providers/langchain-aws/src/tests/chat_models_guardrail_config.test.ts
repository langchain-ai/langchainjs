import type { GuardrailConfiguration } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, test, vi } from "vitest";
import { ChatBedrockConverse } from "../chat_models.js";

describe("ChatBedrockConverse guardrailConfig", () => {
  const defaultConfig: GuardrailConfiguration = {
    guardrailIdentifier: "default-guardrail",
    guardrailVersion: "1",
    trace: "enabled",
  };
  const callConfig: GuardrailConfiguration = {
    guardrailIdentifier: "call-guardrail",
    guardrailVersion: "2",
    trace: "disabled",
  };

  function createModel(guardrailConfig?: GuardrailConfiguration) {
    return new ChatBedrockConverse({
      model: "anthropic.claude-3-haiku-20240307-v1:0",
      region: "us-east-1",
      credentials: { accessKeyId: "fake", secretAccessKey: "fake" },
      guardrailConfig,
    });
  }

  test.each([
    { constructorConfig: undefined, options: undefined, expected: undefined },
    {
      constructorConfig: defaultConfig,
      options: undefined,
      expected: defaultConfig,
    },
    { constructorConfig: defaultConfig, options: {}, expected: defaultConfig },
    {
      constructorConfig: undefined,
      options: { guardrailConfig: callConfig },
      expected: callConfig,
    },
    {
      constructorConfig: defaultConfig,
      options: { guardrailConfig: callConfig },
      expected: callConfig,
    },
  ])(
    "resolves constructor $constructorConfig and call $options",
    ({ constructorConfig, options, expected }) => {
      const model = createModel(constructorConfig);
      expect(model.invocationParams(options).guardrailConfig).toEqual(expected);
      expect(model.guardrailConfig).toEqual(constructorConfig);
      expect(model.invocationParams({}).guardrailConfig).toEqual(
        constructorConfig
      );
    }
  );

  test.each(["invoke", "stream"] as const)(
    "%s sends the call-level guardrail without changing the default",
    async (method) => {
      const model = createModel(defaultConfig);
      const send = vi.spyOn(model.client, "send").mockResolvedValue(
        method === "invoke"
          ? ({
              output: {
                message: { role: "assistant", content: [{ text: "Hello" }] },
              },
            } as never)
          : ({
              stream: (async function* () {
                yield {
                  contentBlockDelta: {
                    contentBlockIndex: 0,
                    delta: { text: "Hello" },
                  },
                };
              })(),
            } as never)
      );

      if (method === "invoke") {
        await model.invoke("Hello", { guardrailConfig: callConfig });
      } else {
        const stream = await model.stream("Hello", {
          guardrailConfig: callConfig,
        });
        for await (const chunk of stream) {
          expect(chunk.content).toBe("Hello");
        }
      }

      expect(send).toHaveBeenCalledTimes(1);
      expect(
        (
          send.mock.calls[0][0] as {
            input: { guardrailConfig?: GuardrailConfiguration };
          }
        ).input.guardrailConfig
      ).toEqual(callConfig);
      expect(model.guardrailConfig).toEqual(defaultConfig);
      expect(model.invocationParams({}).guardrailConfig).toEqual(defaultConfig);
    }
  );
});
