/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { test, expect } from "@jest/globals";
import { Document } from "../../document.js";
import { VectaraRetriever } from "../vectara.js";
import { VectaraStore } from "../../vectorstores/vectara.js";

/**
 * Steps to run this test:
 * 1. Create a Vectara account at https://console.vectara.com/signup
 * 2. Create a corpus with the following filter attributes:
 *      lang (level: part, data type: text)
 *      is_title (level: part, data type:  boolean)
 *      can_fly (level: document, data type: boolean)
 *      category (level: document, data type: string)
 *    Note: make sure to create an empty corpus (without any documents or text)
 * 3. Set the appropriate environment variables in your .env file (VECTARA_CUSTOMER_ID, VECTARA_CORPUS_ID, VECTARA_API_KEY)
 * 4. Run the test
 */

const VECTARA_CUSTOMER_ID = Number(process.env.VECTARA_CUSTOMER_ID) || 0;
const VECTARA_CORPUS_ID = Number(process.env.VECTARA_CORPUS_ID) || 0;
const VECTARA_API_KEY = process.env.VECTARA_API_KEY || "";

const getdoc = (): Document[] => {
  // Summary of 4 different animals
  const lion = `The lion, often referred to as the "king of the jungle, " is one of the largest and most powerful 
    members of the cat family, known for its majestic mane and powerful roar. These carnivorous mammals reside primarily 
    in Sub-Saharan Africa and parts of Asia, where they roam grasslands and open plains in prides consisting of related 
    females, their offspring, and a coalition of males. Lions are known for their cooperative hunting strategy and deep 
    social bonds, marking them as unique among the world's wild cats.`;

  const flyingSquirrel = `The flying squirrel is a fascinating mammal known for its ability to glide through the air. 
    These nocturnal creatures are found in a variety of habitats, including forests and suburban areas across parts of 
    North America, Europe, and Asia. They possess a unique patagium, a membrane that extends from wrist to ankle, 
    facilitating their gliding abilities. Despite their name, flying squirrels don't technically fly but instead extend 
    their arms and legs to glide from tree to tree, using their tail for steering and balance.`;

  const penguin = `Penguins are flightless seabirds known for their distinct tuxedo-like appearance and waddling walk. 
    They are primarily found in the Southern Hemisphere, particularly in Antarctica, but species can also be found in 
    South Africa, South America, New Zealand, and the Galapagos Islands. Penguins are expert swimmers, using their 
    flippers for propulsion and their feet as rudders, and they can dive deep into the ocean to catch their diet of fish, 
    squid, and krill.`;

  const turtle = `Turtles are cold-blooded reptiles identifiable by their bony or cartilaginous shell developed from their 
    ribs. They are one of the oldest and most primitive groups of reptiles and have been on Earth for more than 200 million 
    years. Found in various habitats from deserts to marine environments around the globe, turtles are known for their 
    slow movement on land, longevity, and often complex mating and nesting behaviors.`;

  const documents = [
    new Document({
      pageContent: lion,
      metadata: {
        document_id: "1",
        title: "Lion",
        category: "Mammal",
        can_fly: false,
      },
    }),
    new Document({
      pageContent: flyingSquirrel,
      metadata: {
        document_id: "2",
        title: "Flying Squirrel",
        category: "Mammal",
        can_fly: true,
      },
    }),
    new Document({
      pageContent: penguin,
      metadata: {
        document_id: "3",
        title: "Penguin",
        category: "Bird",
        can_fly: false,
      },
    }),
    new Document({
      pageContent: turtle,
      metadata: {
        document_id: "4",
        title: "Turtle",
        category: "Reptile",
        can_fly: false,
      },
    }),
  ];
  return documents;
};

beforeAll(async () => {
  // Upload the documents to Vectara
  const store = new VectaraStore({
    customerId: VECTARA_CUSTOMER_ID,
    corpusId: VECTARA_CORPUS_ID,
    apiKey: VECTARA_API_KEY,
  });

  await store.addDocuments(getdoc());
});

test("Vectara Retriever (with filters)", async () => {
  const store = new VectaraStore({
    customerId: VECTARA_CUSTOMER_ID,
    corpusId: VECTARA_CORPUS_ID,
    apiKey: VECTARA_API_KEY,
  });

  const retriever = new VectaraRetriever(store);
  const mammals = await retriever.getRelevantDocuments("animal", 5, {
    filter: "doc.category = 'Mammal'",
  });
  // expect all mammals results to contain either Lion or Flying Squirrel
  expect(
    mammals[0].pageContent.includes("Lion") ||
      mammals[0].pageContent.includes("Flying Squirrel")
  ).toBeTruthy();

  const flyingAnimals = await retriever.getRelevantDocuments("animal", 5, {
    filter: "doc.can_fly = true",
  });

  const flyingMammals = await retriever.getRelevantDocuments("animal", 5, {
    filter: "doc.category = 'Mammal' AND doc.can_fly = true",
  });
  // expect all flyingMammals results to be same as flyingAnimals results
  expect(flyingMammals[0].pageContent).toEqual("Flying Squirrel");
  expect(flyingAnimals[0].pageContent).toEqual("Flying Squirrel");

  const reptileLion = await retriever.getRelevantDocuments("lion", 1, {
    filter: "doc.category = 'Reptile' AND doc.can_fly = false",
  });
  const reptile = await retriever.getRelevantDocuments("animal", 1, {
    filter: "doc.category = 'Reptile' AND doc.can_fly = false",
  });

  // expect all reptileLion results to be same as reptile results (since lion is not a reptile)
  expect(reptileLion[0].pageContent).toEqual("Turtle");
  expect(reptile[0].pageContent).toEqual("Turtle");
});

test("VectaraRetriever (without filters)", async () => {
  const store = new VectaraStore({
    customerId: VECTARA_CUSTOMER_ID,
    corpusId: VECTARA_CORPUS_ID,
    apiKey: VECTARA_API_KEY,
  });

  const retriever = new VectaraRetriever(store);

  const doc = await retriever.getRelevantDocuments("cold-blooded animal");

  expect(doc.length).toBeGreaterThan(0);
  expect(doc[0].pageContent).toContain("Turtles are cold-blooded reptiles");
});
