import { test } from "@jest/globals";
import { Ollama } from "../ollama.js";

test("test call", async () => {
  const ollama = new Ollama({});
  const result = await ollama.call(
    "What is a good name for a company that makes colorful socks?"
  );
  console.log({ result });
});

test("test streaming call", async () => {
  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
  });
  const stream = await ollama.stream(
    `Translate "I love programming" into German.`
  );
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  console.log(chunks.join(""));
  expect(chunks.length).toBeGreaterThan(1);
});

test("should abort the request", async () => {
  const ollama = new Ollama({
    baseUrl: "http://localhost:11434",
  });
  const controller = new AbortController();

  await expect(() => {
    const ret = ollama.call("Respond with an extremely verbose response", {
      signal: controller.signal,
    });
    controller.abort();
    return ret;
  }).rejects.toThrow("This operation was aborted");
});
