import { test, expect } from "@jest/globals";
import { OVHcloudAIEndpointsEmbeddings } from "../ovhcloud.js";

test("Test OVHcloudAIEndpointsEmbeddings.embedQuery", async () => {
  const embeddings = new OVHcloudAIEndpointsEmbeddings();
  const res = await embeddings.embedQuery("Hello world");
  expect(typeof res[0]).toBe("number");
  expect(res.length).toBe(3584);
});

test("Test OVHcloudAIEndpointsEmbeddings.embedDocuments", async () => {
  const embeddings = new OVHcloudAIEndpointsEmbeddings();
  const res = await embeddings.embedDocuments(["Hello world", "Bye bye"]);
  expect(res).toHaveLength(2);
  expect(typeof res[0][0]).toBe("number");
  expect(typeof res[1][0]).toBe("number");
  expect(res[0].length).toBe(3584);
  expect(res[1].length).toBe(3584);
});
