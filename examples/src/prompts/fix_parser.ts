import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { OutputFixingParser } from "langchain/output_parsers";
import { StructuredOutputParser } from "@langchain/core/output_parsers";

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
    "answer": "foo",
    "sources": "foo.com"
  }
  \`\`\``;
  try {
    await parser.parse(badOutput);
  } catch (e) {
    console.log("Failed to parse bad output: ", e);
    /*
    Failed to parse bad output:  OutputParserException [Error]: Failed to parse. Text: ```json
      {
        "answer": "foo",
        "sources": "foo.com"
      }
      ```. Error: [
      {
        "code": "invalid_type",
        "expected": "array",
        "received": "string",
        "path": [
          "sources"
        ],
        "message": "Expected array, received string"
      }
    ]
    at StructuredOutputParser.parse (/Users/ankushgola/Code/langchainjs/langchain/src/output_parsers/structured.ts:71:13)
    at run (/Users/ankushgola/Code/langchainjs/examples/src/prompts/fix_parser.ts:25:18)
    at <anonymous> (/Users/ankushgola/Code/langchainjs/examples/src/index.ts:33:22)
   */
  }
  const fixParser = OutputFixingParser.fromLLM(
    new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }),
    parser
  );
  const output = await fixParser.parse(badOutput);
  console.log("Fixed output: ", output);
  // Fixed output:  { answer: 'foo', sources: [ 'foo.com' ] }
};
