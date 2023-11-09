import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatPromptTemplate } from "langchain/prompts";
import { HumanMessage } from "langchain/schema";
import { StringOutputParser } from "langchain/schema/output_parser";
import { RunnableSequence } from "langchain/schema/runnable";
import { HNSWLib } from "langchain/vectorstores/hnswlib";
import fs from "node:fs/promises";

// Instantiate ChatOpenAI using the vision model.
const model = new ChatOpenAI({
  modelName: "gpt-4-vision-preview",
  maxTokens: 1024,
}).pipe(new StringOutputParser());
// Load in images
const usNationalDebt = await fs.readFile(
  "./multi_modal_content/us_national_debt_chart.jpg"
);
const canadianNationalDebt = await fs.readFile(
  "./multi_modal_content/canadian_debt_by_gdp.jpg"
);
const mexicanNationalDebt = await fs.readFile(
  "./multi_modal_content/mexico_national_debt_monthly.jpg"
);
// Create a dict with each image
// This will be helpful later on when we want to
// retrieve a given image.
const imageDict = {
  us: usNationalDebt,
  canada: canadianNationalDebt,
  mexico: mexicanNationalDebt,
};
// Map over each image in the dict and create a
// prompt message, encoding the image in base64.
const promptMessages = Object.keys(imageDict).map(
  (key) =>
    new HumanMessage({
      content: [
        {
          type: "text",
          text: "Describe the contents of this image in detail.",
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageDict[
              key as keyof typeof imageDict
            ].toString("base64")}`,
          },
        },
      ],
    })
);
// Invoke the model to generate a summary of each image.
const summaries = await Promise.all([
  model.invoke([promptMessages[0]]),
  model.invoke([promptMessages[1]]),
  model.invoke([promptMessages[2]]),
]);
// Create a document for each summary, also including
// the image dict key as metadata so we can retrieve the
// actual image later on.
const documents = summaries.map(
  (summary, i) =>
    new Document({
      pageContent: summary,
      metadata: {
        imageKey: Object.keys(imageDict)[i],
      },
    })
);

// Initialize the vector store with OpenAIEmbeddings
// and the documents we created above.
const vectorStore = await HNSWLib.fromDocuments(
  documents,
  new OpenAIEmbeddings()
);
// Instantiate the store as a retriever.
const retriever = vectorStore.asRetriever();

// Create a HumanMessage prompt which will contain the image
// with the relevant content based on the users question.
// Since we do not know the image yet we use an input variable
// {imageString} which we'll replace with the base 64 encoded
// image at runtime.
const imageMessage = new HumanMessage({
  content: [
    {
      type: "image_url",
      image_url: {
        url: "data:image/jpeg;base64,{imageString}",
      },
    },
  ],
});
// Create a chat prompt template with the image message
// and an input variable for the users question.
const prompt = ChatPromptTemplate.fromMessages([
  ["ai", "Answer the users question using the provided image."],
  ["human", "{question}"],
  imageMessage,
]);

// Construct the chain.
//
// Here we're taking in a single input which is the users
// question, then preforming a similarity search to find
// the most relevant document, and using the first returned doc
// since in our case we know only 1 document will match the question.
//
// Then, using the image key in the metadata we're able to retrieve the
// relevant image and encode it to then be passed into the prompt.
const chain = RunnableSequence.from([
  async (input: string) => {
    const relevantDoc = (await retriever.getRelevantDocuments(input))[0];
    const imageKey = relevantDoc.metadata.imageKey as keyof typeof imageDict;
    const imageString = imageDict[imageKey].toString("base64");
    return {
      imageString,
      question: input,
    };
  },
  prompt,
  model,
]);
// Finally, invoke the model and sit back while the magic happens.
const response = await chain.invoke(
  "How much was Mexico's national debt increasing by on a monthly basis?"
);
console.log("response\n", response);
/**
response
 The graph you provided shows the Mexico's government debt in US dollars (million) on a monthly basis from September 2022 to August 2023. To determine the monthly increase, let's look at two consecutive months and calculate the difference:

For example, from December 2022 (USD 769,313.943 million) to January 2023 (USD 795,248.468 million), the debt increased by:

795,248.468 - 769,313.943 = 25,934.525 million USD

So, the debt increased by approximately 25.9 billion USD from December 2022 to January 2023. You can perform similar calculations for other consecutive months to find the respective increases for those periods.
 */
/**
 * See the chain's LangSmith trace here:
 * https://smith.langchain.com/public/de77d135-8b4e-4acf-949b-bfc79845cf39/r
 */
