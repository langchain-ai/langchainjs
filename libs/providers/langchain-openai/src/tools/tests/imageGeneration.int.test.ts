import { expect, it, describe } from "vitest";

import { tools } from "../index.js";
import { ChatOpenAI } from "../../chat_models/index.js";

/**
 * We don't explictly provide types for this yet
 */
interface ImageGenerationToolOutput {
  type: string;
  result: string;
  size: string;
}

describe("OpenAI Image Generation Tool Integration Tests", () => {
  it("imageGeneration generates an image with basic options", async () => {
    const model = new ChatOpenAI({
      model: "gpt-4.1",
      useResponsesApi: true,
    }).bindTools([
      tools.imageGeneration({
        quality: "low",
        outputFormat: "jpeg",
        outputCompression: 100,
        size: "1024x1024",
      }),
    ]);

    const response = await model.invoke(
      "Draw the word 'TEST' in blue font on white background."
    );
    expect(response.additional_kwargs.tool_outputs).toBeDefined();
    expect(
      (response.additional_kwargs.tool_outputs as ImageGenerationToolOutput[])
        .length
    ).toBe(1);
    expect(
      (
        response.additional_kwargs.tool_outputs as ImageGenerationToolOutput[]
      )[0].type
    ).toBe("image_generation_call");
    expect(
      (
        response.additional_kwargs.tool_outputs as ImageGenerationToolOutput[]
      )[0].result
    ).toBeDefined();
    expect(
      (
        response.additional_kwargs.tool_outputs as ImageGenerationToolOutput[]
      )[0].result.length
    ).toBeGreaterThan(0);
    expect(
      (
        response.additional_kwargs.tool_outputs as ImageGenerationToolOutput[]
      )[0].size
    ).toContain("1024x1024");
  });
});
