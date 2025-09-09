import { toJsonSchema } from "@langchain/core/utils/json_schema";
import fs from "fs";
import { z } from "zod";
import { AgentAction, AgentFinish, AgentStep } from "@langchain/core/agents";
import { AIMessage } from "@langchain/core/messages";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { createRetrieverTool } from "../toolkits/index.js";
import { RecursiveCharacterTextSplitter } from "../../text_splitter.js";
import { MemoryVectorStore } from "../../vectorstores/memory.js";
import { AgentExecutor } from "../executor.js";
import { formatForOpenAIFunctions } from "../format_scratchpad/openai_functions.js";

/** Define a custom structured output parser. */
const structuredOutputParser = (
  output: AIMessage
): AgentAction | AgentFinish => {
  if (typeof output.content !== "string") {
    throw new Error("Cannot parse non-string output.");
  }
  if (output.additional_kwargs.function_call === undefined) {
    return { returnValues: { output: output.content }, log: output.content };
  }

  const functionCall = output.additional_kwargs.function_call;
  const name = functionCall?.name as string;
  const inputs = functionCall?.arguments as string;
  // console.log(functionCall);

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
  const vectorStore = await MemoryVectorStore.fromDocuments(
    docs,
    new OpenAIEmbeddings()
  );
  const retriever = vectorStore.asRetriever();
  /** Instantiate the LLM */
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
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
    parameters: toJsonSchema(responseSchema),
  };
  /** Convert retriever into a tool */
  const retrieverTool = createRetrieverTool(retriever, {
    name: "state-of-union-retriever",
    description:
      "Query a retriever to get information about state of the union address",
  });
  /** Bind both retriever and response functions to LLM */
  const llmWithTools = llm.bindTools([retrieverTool, responseOpenAIFunction]);
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
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await executor.invoke({
    input: "what did the president say about kentaji brown jackson",
  });
  // console.log({
  //   res,
  // });
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
