import { expect, it, describe } from "vitest";
import { tools } from "../index.js";

describe("OpenAI Image Generation Tool Tests", () => {
  it("imageGeneration creates valid tool definitions", () => {
    expect(
      tools.imageGeneration({
        background: "opaque",
        inputFidelity: "high",
        inputImageMask: {
          imageUrl: "data:image/png;base64,abc123",
          fileId: "file-xyz789",
        },
        model: "gpt-image-1.5",
        moderation: "auto",
        outputCompression: 85,
        outputFormat: "webp",
        partialImages: 3,
        quality: "medium",
        size: "1536x1024",
      })
    ).toMatchObject({
      type: "image_generation",
      background: "opaque",
      input_fidelity: "high",
      input_image_mask: {
        file_id: "file-xyz789",
        image_url: "data:image/png;base64,abc123",
      },
      model: "gpt-image-1.5",
      moderation: "auto",
      output_compression: 85,
      output_format: "webp",
      partial_images: 3,
      quality: "medium",
      size: "1536x1024",
    });
  });
});
