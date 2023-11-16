import { HttpResponseOutputParser } from "../http_response.js";
import { FakeStreamingLLM } from "../../schema/tests/lib.js";

test("text/plain stream", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm
    .pipe(new HttpResponseOutputParser())
    .stream("Hi there!");
  const chunks = [];
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    chunks.push(decoder.decode(chunk));
  }
  expect(chunks.length).toEqual("Hi there!".length);
  expect(chunks.join("")).toEqual("Hi there!");
});

test("text/event-stream stream", async () => {
  const llm = new FakeStreamingLLM({});
  const stream = await llm
    .pipe(new HttpResponseOutputParser({ contentType: "text/event-stream" }))
    .stream("Hi there!");
  const chunks = [];
  const decoder = new TextDecoder();
  for await (const chunk of stream) {
    chunks.push(decoder.decode(chunk));
  }
  expect(chunks.length).toEqual("Hi there!".length + 1);
  expect(chunks).toEqual([
    `event: data\ndata: "H"\n\n`,
    `event: data\ndata: "i"\n\n`,
    `event: data\ndata: " "\n\n`,
    `event: data\ndata: "t"\n\n`,
    `event: data\ndata: "h"\n\n`,
    `event: data\ndata: "e"\n\n`,
    `event: data\ndata: "r"\n\n`,
    `event: data\ndata: "e"\n\n`,
    `event: data\ndata: "!"\n\n`,
    `event: end\n\n`,
  ]);
});
