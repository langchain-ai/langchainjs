import { BaseMessage } from "@langchain/core/messages";
import { BasePromptValue } from "@langchain/core/prompt_values";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { Part } from "@google/generative-ai";

export function assertSafetySettings<
  S extends {
    category?: string | number | null;
    threshold?: string | number | null;
  }[],
  C extends Record<string, string | number>,
  T extends Record<string, string | number>
>(safetySettings: S, validCategories: C, validThresholds: T) {
  const safetySettingsSet = new Set(safetySettings.map((s) => s.category));
  if (safetySettingsSet.size !== safetySettings.length) {
    throw new Error("The categories in `safetySettings` array must be unique");
  }

  for (const safetySetting of safetySettings || []) {
    if (
      safetySetting.category &&
      !Object.values(validCategories).includes(safetySetting.category)
    ) {
      const keys = Object.keys(validCategories).join("|");
      throw new Error(
        `Incompatible Safety Harm Category. Valid values are: HarmCategory[${keys}]`
      );
    }
    if (
      safetySetting.threshold &&
      !Object.values(validThresholds).includes(safetySetting.threshold)
    ) {
      const keys = Object.keys(validThresholds).join("|");
      throw new Error(
        `Incompatible Harm Block Threshold. Valid values are: HarmBlockThreshold[${keys}]`
      );
    }
  }
}

export function convertInput(
  input: BaseLanguageModelInput,
  isMultimodalModel: boolean
): Part[] {
  if (typeof input === "string") {
    return [{ text: input }];
  }

  // eslint-disable-next-line no-instanceof/no-instanceof
  if (input instanceof BasePromptValue) {
    return [{ text: input.toString() }];
  }
  if (!Array.isArray(input)) {
    throw new Error("Unsupported input");
  }
  if (input.length !== 1) {
    throw new Error(
      "Multi-modal model expects only a single message as a input!"
    );
  }
  if (typeof input[0] === "string") {
    return [{ text: input.toString() }];
  }
  // eslint-disable-next-line no-instanceof/no-instanceof
  if (input[0] instanceof BasePromptValue) {
    return [{ text: input[0].toString() }];
  }
  // eslint-disable-next-line no-instanceof/no-instanceof
  if (!(input[0] instanceof BaseMessage)) {
    throw new Error("Unsupported input");
  }
  const { content } = input[0];

  if (typeof content === "string") {
    return [{ text: content }];
  }

  const convertedInput = content.map((c) => {
    switch (c.type) {
      case "text": {
        return {
          text: c.text,
        };
      }
      case "image_url": {
        if (!isMultimodalModel) {
          throw new Error(`This model does not support images`);
        }
        if (typeof c.image_url !== "string") {
          throw new Error("Please provide image as base64 encoded data URL");
        }
        const [dm, data] = c.image_url.split(",");
        if (!dm.startsWith("data:")) {
          throw new Error("Please provide image as base64 encoded data URL");
        }

        const [mimeType, encoding] = dm.replace(/^data:/, "").split(";");
        if (encoding !== "base64") {
          throw new Error("Please provide image as base64 encoded data URL");
        }

        return {
          inlineData: {
            data,
            mimeType,
          },
        };
      }
      default:
        throw new Error(
          `Unknown content type ${(c as { type: string }).type}}`
        );
    }
  });
  return convertedInput;
}
