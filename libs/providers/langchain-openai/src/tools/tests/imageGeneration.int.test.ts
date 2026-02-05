import { expect, it, describe } from "vitest";
import { ContentBlock } from "@langchain/core/messages";

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
      model: "gpt-5",
      useResponsesApi: true,
    }).bindTools([
      tools.imageGeneration({
        quality: "low",
        model: "gpt-image-1",
        outputFormat: "jpeg",
        outputCompression: 100,
        size: "1024x1024",
      }),
    ]);

    const response = await model.invoke(
      "Draw the word 'TEST' in blue font on white background."
    );

    /**
     * verify that image is part of AIMessage content block
     */
    const expectedContent = response.content as [
      ContentBlock.Multimodal.Image,
      ContentBlock.Text, // expected empty text block
    ];
    expect(expectedContent.length).toBe(2);
    expect(expectedContent[0].type).toBe("image");
    expect(expectedContent[0].mimeType).toBe("image/png");
    expect(expectedContent[0].data).toBeDefined();
    expect(expectedContent[0].data?.length).toBeGreaterThan(0);
    expect(expectedContent[0].id).toBeDefined();
    expect(expectedContent[0].metadata).toBeDefined();
    expect(expectedContent[0].metadata?.status).toBe("completed");

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
