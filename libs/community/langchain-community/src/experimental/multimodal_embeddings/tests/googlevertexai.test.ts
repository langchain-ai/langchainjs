import { test, expect } from "@jest/globals";
import {
  GoogleVertexAIMultimodalEmbeddings,
  GoogleVertexAIMedia,
} from "../googlevertexai.js";

test("mediaToInstance text", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const media: GoogleVertexAIMedia = {
    text: "just text",
  };
  const instance = e.mediaToInstance(media);
  expect(instance.text).toEqual("just text");
  expect(instance.image).toBeUndefined();
});

test("mediaToInstance image", async () => {
  const e = new GoogleVertexAIMultimodalEmbeddings();

  const media: GoogleVertexAIMedia = {
    image: Buffer.from("abcd"),
  };
  const instance = e.mediaToInstance(media);
  expect(instance.image?.bytesBase64Encoded).toEqual("YWJjZA==");
  expect(instance.text).toBeUndefined();
});
