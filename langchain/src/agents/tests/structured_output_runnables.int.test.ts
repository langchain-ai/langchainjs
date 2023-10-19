import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs";
import { z } from "zod";
import { AIMessage, AgentAction, AgentFinish } from "../../schema/index.js";
import { RunnableSequence } from "../../schema/runnable/base.js";
import { ChatPromptTemplate } from "../../prompts/chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { createRetrieverTool } from "../toolkits/index.js";
import { RecursiveCharacterTextSplitter } from "../../text_splitter.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { formatToOpenAIFunction } from "../../tools/convert_to_openai.js";
import { AgentExecutor } from "../executor.js";

const structuredOutputParser = (
  output: AIMessage
): AgentAction | AgentFinish => {
  if (!("function_call" in output.additional_kwargs)) {
    console.log("returning first AgentFinish");
    return { returnValues: { output: output.content }, log: output.content };
  }

  const functionCall = output.additional_kwargs.function_call;
  const name = functionCall?.name as string;
  const inputs = functionCall?.arguments as string;

  const jsonInput = JSON.parse(inputs) as { input: string };

  if (name === "Response") {
    console.log("returning second AgentFinish");
    return { returnValues: { inputs }, log: output.content };
  }

  console.log("returning last AgentAction");

  return {
    tool: name,
    toolInput: jsonInput,
    log: output.content,
  };
};

test("Pass custom structured output parsers", async () => {
  const text = fs.readFileSync("../examples/state_of_the_union.txt", "utf8");
  const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
  let docs = await textSplitter.createDocuments([text]);
  // Add fake source information
  docs = docs.map((doc, i) => ({
    ...doc,
    metadata: {
      page_chunk: i,
    },
  }));
  console.log({
    docsLen: docs.length,
    docsZero: docs[0],
  });
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  const retriever = vectorStore.asRetriever();

  const responseSchema = z.object({
    answer: z.string().describe("The final answer to respond to the user"),
    sources: z
      .array(z.string())
      .describe(
        "List of page chunks that contain answer to the question. Only include a page chunk if it contains relevant information"
      ),
  });

  const llm = new ChatOpenAI({});
  const retrieverTool = createRetrieverTool(retriever, {
    name: "state-of-union-retriever",
    description:
      "Query a retriever to get information about state of the union address",
  });

  const llmWithTools = llm.bind({
    functions: [
      formatToOpenAIFunction(retrieverTool),
      {
        name: "Response",
        description: "Return the response to the user",
        parameters: zodToJsonSchema(responseSchema),
      },
    ],
  });

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant\nThought:{agent_scratchpad}"],
    ["user", "{input}"],
  ]);

  const runnableAgent = RunnableSequence.from([
    {
      input: (i: { input: string }) => i.input,
      agent_scratchpad: (i: { input: string }) => i,
    },
    prompt,
    llmWithTools,
    structuredOutputParser,
  ]);

  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnableAgent,
    tools: [retrieverTool],
  });

  const res = await executor.invoke({
    input: "what did the president say about kentaji brown jackson",
  });

  console.log({
    res,
  });
});
