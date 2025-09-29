import { ChatOpenAI } from "@langchain/openai";
import { HttpResponseOutputParser } from "langchain/output_parsers";

const handler = async () => {
  const parser = new HttpResponseOutputParser({
    contentType: "text/event-stream",
  });

  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

  // Values are stringified to avoid dealing with newlines and should
  // be parsed with `JSON.parse()` when consuming.
  const stream = await model.pipe(parser).stream("Hello there!");

  const httpResponse = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
    },
  });

  return httpResponse;
};

await handler();
