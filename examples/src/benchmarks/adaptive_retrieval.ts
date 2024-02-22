import fs from 'fs';
import { parse } from 'csv-parse';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { Document } from '@langchain/core/documents';
import { MatryoshkaRetrieval } from "langchain/retrievers/matryoshka_retrieval";

/**
 * Benchmarking adaptive retrieval on the wikipedia movie dataset
 * Given 5 questions (generated from chat gpt), perform retrieval on the wikipedia movie dataset
 * See if it returns the relevant document.
 * Dataset: {@link https://www.kaggle.com/datasets/jrobischon/wikipedia-movie-plots}
 */

interface MoviePlot {
  "Release Year": string;
  "Title": string;
  "Origin/Ethnicity": string;
  "Director": string;
  "Cast": string;
  "Genre": string;
  "Wiki Page": string;
  "Plot": string;
}

async function loadCSV(filePath: string): Promise<MoviePlot[]> {
  return new Promise((resolve, reject) => {
    const movies: MoviePlot[] = [];
    fs.createReadStream(filePath)
      .pipe(parse({
        delimiter: ',',
        columns: true,
      }))
      .on('data', (data: MoviePlot) => movies.push(data))
      .on('end', () => {
        resolve(movies);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

const moviePlotAsArray = await loadCSV("./wiki_movie_plots_deduped.csv");

const questionSet = [
  {
    question: "What American comedy film directed by Woody Allen features a sportswriter who becomes obsessed with finding and helping his adopted son's biological mother, a prostitute aspiring to be a stage actress?",
    link: 'https://en.wikipedia.org/wiki/Mighty_Aphrodite',
  },
  {
    question: "What is a film that involves a complex family drama with themes of revenge, guilt, and tragedy in a post-Civil War New England setting, featuring a plot of murder and suicide within a wealthy family?",
    link: "https://en.wikipedia.org/wiki/Mourning_Becomes_Electra_(film)",
  },
  {
    question: "What is the plot of a comedy film where a small-town man with a family history in adult films moves to Hollywood to become a porn star, facing unique challenges and eventually finding love?",
    link: "https://en.wikipedia.org/wiki/Bucky_Larson:_Born_to_Be_a_Star",
  },
  {
    question: "What is a 1995 action movie involving a Miami lawyer targeted by a former KGB agent over a freighter ship dispute?",
    link: "https://en.wikipedia.org/wiki/Fair_Game_(1995_film)",
  },
  {
    question: "What is a plot summary of a 1970s American film where a dancer and her daughter face upheaval when the mother's boyfriend leaves, but they then form a bond with an aspiring actor who sublets their apartment?",
    link: "https://en.wikipedia.org/wiki/The_Goodbye_Girl",
  },
];

const smallOAIEmbeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  dimensions: 512, // Min num for small
});
const largeOAIEmbeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-large",
  dimensions: 3072, // Max num for large
});

const oaiVectorStore = new Chroma(smallOAIEmbeddings, {
  numDimensions: 512,
  collectionName: "movie_plots_benchmarking_oai_2",
});

const datasetAsDocument = moviePlotAsArray.map((movie) => {
  const pageContent = Object.entries(movie).flatMap(([key, value]) => {
    if (key !== "Wiki Page") {
      return `${key}: ${value}`;
    }
    return [];
  }).join("\n");
  return new Document({
    pageContent,
    metadata: movie,
  });
});

// Define adaptive retrieval
const retriever = new MatryoshkaRetrieval({
  largeEmbeddingModel: largeOAIEmbeddings,
  vectorStore: oaiVectorStore,
  smallK: 50,
  largeK: 10,
});

const model = new ChatOpenAI();

const docsWithinContextLimit = (await Promise.all(datasetAsDocument.map(async (datasetItem) => {
  const { pageContent } = datasetItem;
  const totalTokens = await model.getNumTokens(pageContent);
  if (totalTokens < 8000) {
    return datasetItem;
  }
  return [];
}))).flat();


// add documents to chroma vector store
await retriever.addDocuments(docsWithinContextLimit);

const successfulRetrievals: Array<any> = [];

// retrieve from store
for (const question of questionSet) {
  const results = await retriever.getRelevantDocuments(question.question);
  if (results.some((result) => result.metadata["Wiki Page"] === question.link)) {
    successfulRetrievals.push(question);
    const fisrt5 = results.slice(0, 5);
    if (fisrt5.some((result) => result.metadata["Wiki Page"] === question.link)) {
      console.log("First 5 results are correct!!!");
      if (results[0].metadata["Wiki Page"] === question.link) {
        console.log("First result is correct!!!");
      }
    }
  }
}
console.log(JSON.stringify(successfulRetrievals, null, 2));