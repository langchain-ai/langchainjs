import { ChatOpenAI } from "@langchain/openai";
import { BytesOutputParser } from "@langchain/core/output_parsers";

const handler = async () => {
  const parser = new BytesOutputParser();

  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });

  const stream = await model.pipe(parser).stream("Hello there!");

  const httpResponse = new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });

  return httpResponse;
};

await handler();
