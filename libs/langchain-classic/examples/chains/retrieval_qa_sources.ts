import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import * as fs from "fs";
import { formatDocumentsAsString } from "langchain/util/document";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

const text = fs.readFileSync("state_of_the_union.txt", "utf8");

const query = "What did the president say about Justice Breyer?";

// Initialize the LLM to use to answer the question.
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
});

// Chunk the text into documents.
const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });
const docs = await textSplitter.createDocuments([text]);

// Create a vector store from the documents.
const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings());
const vectorStoreRetriever = vectorStore.asRetriever();

// Create a system & human prompt for the chat model
const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the users question.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
----------------
{context}`;

const messages = [
  SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
  HumanMessagePromptTemplate.fromTemplate("{question}"),
];
const prompt = ChatPromptTemplate.fromMessages(messages);

const chain = RunnableSequence.from([
  {
    // Extract the "question" field from the input object and pass it to the retriever as a string
    sourceDocuments: RunnableSequence.from([
      (input) => input.question,
      vectorStoreRetriever,
    ]),
    question: (input) => input.question,
  },
  {
    // Pass the source documents through unchanged so that we can return them directly in the final result
    sourceDocuments: (previousStepResult) => previousStepResult.sourceDocuments,
    question: (previousStepResult) => previousStepResult.question,
    context: (previousStepResult) =>
      formatDocumentsAsString(previousStepResult.sourceDocuments),
  },
  {
    result: prompt.pipe(model).pipe(new StringOutputParser()),
    sourceDocuments: (previousStepResult) => previousStepResult.sourceDocuments,
  },
]);

const res = await chain.invoke({
  question: query,
});

console.log(JSON.stringify(res, null, 2));

/*
{
  "result": "The President honored Justice Stephen Breyer, describing him as an Army veteran, Constitutional scholar, and a retiring Justice of the United States Supreme Court. The President thanked him for his service.",
  "sourceDocuments": [
    {
      "pageContent": "In state after state, new laws have been passed, not only to suppress the vote, but to subvert entire elections. \n\nWe cannot let this happen. \n\nTonight. I call on the Senate to: Pass the Freedom to Vote Act. Pass the John Lewis Voting Rights Act. And while you’re at it, pass the Disclose Act so Americans can know who is funding our elections. \n\nTonight, I’d like to honor someone who has dedicated his life to serve this country: Justice Stephen Breyer—an Army veteran, Constitutional scholar, and retiring Justice of the United States Supreme Court. Justice Breyer, thank you for your service. \n\nOne of the most serious constitutional responsibilities a President has is nominating someone to serve on the United States Supreme Court. \n\nAnd I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 524,
            "to": 534
          }
        }
      }
    },
    {
      "pageContent": "And I did that 4 days ago, when I nominated Circuit Court of Appeals Judge Ketanji Brown Jackson. One of our nation’s top legal minds, who will continue Justice Breyer’s legacy of excellence. \n\nA former top litigator in private practice. A former federal public defender. And from a family of public school educators and police officers. A consensus builder. Since she’s been nominated, she’s received a broad range of support—from the Fraternal Order of Police to former judges appointed by Democrats and Republicans. \n\nAnd if we are to advance liberty and justice, we need to secure the Border and fix the immigration system. \n\nWe can do both. At our border, we’ve installed new technology like cutting-edge scanners to better detect drug smuggling.  \n\nWe’ve set up joint patrols with Mexico and Guatemala to catch more human traffickers.  \n\nWe’re putting in place dedicated immigration judges so families fleeing persecution and violence can have their cases heard faster.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 534,
            "to": 544
          }
        }
      }
    },
    {
      "pageContent": "Let’s get it done once and for all. \n\nAdvancing liberty and justice also requires protecting the rights of women. \n\nThe constitutional right affirmed in Roe v. Wade—standing precedent for half a century—is under attack as never before. \n\nIf we want to go forward—not backward—we must protect access to health care. Preserve a woman’s right to choose. And let’s continue to advance maternal health care in America. \n\nAnd for our LGBTQ+ Americans, let’s finally get the bipartisan Equality Act to my desk. The onslaught of state laws targeting transgender Americans and their families is wrong. \n\nAs I said last year, especially to our younger transgender Americans, I will always have your back as your President, so you can be yourself and reach your God-given potential.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 558,
            "to": 568
          }
        }
      }
    },
    {
      "pageContent": "As I said last year, especially to our younger transgender Americans, I will always have your back as your President, so you can be yourself and reach your God-given potential. \n\nWhile it often appears that we never agree, that isn’t true. I signed 80 bipartisan bills into law last year. From preventing government shutdowns to protecting Asian-Americans from still-too-common hate crimes to reforming military justice. \n\nAnd soon, we’ll strengthen the Violence Against Women Act that I first wrote three decades ago. It is important for us to show the nation that we can come together and do big things. \n\nSo tonight I’m offering a Unity Agenda for the Nation. Four big things we can do together.  \n\nFirst, beat the opioid epidemic. \n\nThere is so much we can do. Increase funding for prevention, treatment, harm reduction, and recovery.",
      "metadata": {
        "loc": {
          "lines": {
            "from": 568,
            "to": 578
          }
        }
      }
    }
  ]
}
*/
