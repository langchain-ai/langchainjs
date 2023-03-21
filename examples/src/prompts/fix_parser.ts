import { z } from "zod";
import { ChatOpenAI } from "langchain/chat_models";
import {
  StructuredOutputParser,
  FixOutputParser,
} from "langchain/output_parsers";

export const run = async () => {
  const parser = StructuredOutputParser.fromZodSchema(
    z.object({
      answer: z.string().describe("answer to the user's question"),
      sources: z
        .array(z.string())
        .describe("sources used to answer the question, should be websites."),
    })
  );
  /** This is a bad output because sources is a string, not a list */
  const badOutput = `\`\`\`json
  {
    'answer': 'foo',
    'sources': ['foo', 'bar']
  }
  \`\`\``;
  try {
    parser.parse(badOutput);
  } catch (e: any) {
    console.log(e.message);
  }
  const fixParser = FixOutputParser.fromLLM(
    new ChatOpenAI({ temperature: 0 }),
    parser
  );
  const output = await fixParser.parse(badOutput);
  console.log(output);
};
