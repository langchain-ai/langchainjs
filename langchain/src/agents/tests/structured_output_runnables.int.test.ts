import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "fs";
import { z } from "zod";
import {
  AIMessage,
  AgentAction,
  AgentFinish,
  AgentStep,
} from "../../schema/index.js";
import { RunnableSequence } from "../../schema/runnable/base.js";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompts/chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { createRetrieverTool } from "../toolkits/index.js";
import { RecursiveCharacterTextSplitter } from "../../text_splitter.js";
import { HNSWLib } from "../../vectorstores/hnswlib.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { formatToOpenAIFunction } from "../../tools/convert_to_openai.js";
import { AgentExecutor } from "../executor.js";
import { formatForOpenAIFunctions } from "../format_scratchpad/openai_functions.js";

/** Define a custom structured output parser. */
const structuredOutputParser = (
  output: AIMessage
): AgentAction | AgentFinish => {
  if (typeof output.content !== "string") {
    throw new Error("Cannot parse non-string output.");
  }
  if (!("function_call" in output.additional_kwargs)) {
    return { returnValues: { output: output.content }, log: output.content };
  }

  const functionCall = output.additional_kwargs.function_call;
  const name = functionCall?.name as string;
  const inputs = functionCall?.arguments as string;

  const jsonInput = JSON.parse(inputs);

  if (name === "response") {
    return { returnValues: { ...jsonInput }, log: output.content };
  }

  return {
    tool: name,
    toolInput: jsonInput,
    log: output.content,
  };
};

test("Pass custom structured output parsers", async () => {
  /** Read text file & embed documents */
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
  /** Initialize docs & create retriever */
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
  const retriever = vectorStore.asRetriever();
  /** Instantiate the LLM */
  const llm = new ChatOpenAI({});
  /** Define the prompt template */
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a helpful assistant"],
    new MessagesPlaceholder("agent_scratchpad"),
    ["user", "{input}"],
  ]);
  /** Define the response schema */
  const responseSchema = z.object({
    answer: z.string().describe("The final answer to respond to the user"),
    sources: z
      .array(z.string())
      .describe(
        "List of page chunks that contain answer to the question. Only include a page chunk if it contains relevant information"
      ),
  });
  /** Create the response function */
  const responseOpenAIFunction = {
    name: "response",
    description: "Return the response to the user",
    parameters: zodToJsonSchema(responseSchema),
  };
  /** Convert retriever into a tool */
  const retrieverTool = createRetrieverTool(retriever, {
    name: "state-of-union-retriever",
    description:
      "Query a retriever to get information about state of the union address",
  });
  /** Bind both retriever and response functions to LLM */
  const llmWithTools = llm.bind({
    functions: [formatToOpenAIFunction(retrieverTool), responseOpenAIFunction],
  });
  /** Create the runnable */
  const runnableAgent = RunnableSequence.from([
    {
      input: (i: { input: string; steps: Array<AgentStep> }) => i.input,
      agent_scratchpad: (i: { input: string; steps: Array<AgentStep> }) =>
        formatForOpenAIFunctions(i.steps),
    },
    prompt,
    llmWithTools,
    structuredOutputParser,
  ]);
  /** Create the agent by passing in the runnable & tools */
  const executor = AgentExecutor.fromAgentAndTools({
    agent: runnableAgent,
    tools: [retrieverTool],
  });
  /** Call invoke on the agent */
  const res = await executor.invoke({
    input: "what did the president say about kentaji brown jackson",
  });
  console.log({
    res,
  });
  /**
    {
      res: {
        answer: 'President mentioned that he nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. He described her as one of our nation’s top legal minds and stated that she will continue Justice Breyer’s legacy of excellence.',
        sources: [
          'And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence. A former top litigator in private practice. A former federal public defender. And from a family of public school educators and police officers. A consensus builder. Since she’s been nominated, she’s received a broad range of support—from the Fraternal Order of Police to former judges appointed by Democrats and Republicans.'
        ]
      }
    }
   */
});
