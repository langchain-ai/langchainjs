import { BaseCallbackConfig } from "langchain/callbacks";
import {
  collapseDocs,
  splitListOfDocs,
} from "langchain/chains/combine_documents/reduce";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import { formatDocument } from "langchain/schema/prompt_template";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "langchain/schema/runnable";

// Initialize the OpenAI model
const model = new ChatOpenAI({});

// Define prompt templates for document formatting, summarizing, collapsing, and combining
const documentPrompt = PromptTemplate.fromTemplate("{pageContent}");
const summarizePrompt = PromptTemplate.fromTemplate(
  "Summarize this content:\n\n{context}"
);
const collapsePrompt = PromptTemplate.fromTemplate(
  "Collapse this content:\n\n{context}"
);
const combinePrompt = PromptTemplate.fromTemplate(
  "Combine these summaries:\n\n{context}"
);

// Wrap the `formatDocument` util so it can format a list of documents
const formatDocs = async (documents: Document[]): Promise<string> => {
  const formattedDocs = await Promise.all(
    documents.map((doc) => formatDocument(doc, documentPrompt))
  );
  return formattedDocs.join("\n\n");
};

// Define a function to get the number of tokens in a list of documents
const getNumTokens = async (documents: Document[]): Promise<number> =>
  model.getNumTokens(await formatDocs(documents));

// Initialize the output parser
const outputParser = new StringOutputParser();

// Define the map chain to format, summarize, and parse the document
const mapChain = RunnableSequence.from([
  { context: async (i: Document) => formatDocument(i, documentPrompt) },
  summarizePrompt,
  model,
  outputParser,
]);

// Define the collapse chain to format, collapse, and parse a list of documents
const collapseChain = RunnableSequence.from([
  { context: async (documents: Document[]) => formatDocs(documents) },
  collapsePrompt,
  model,
  outputParser,
]);

// Define a function to collapse a list of documents until the total number of tokens is within the limit
const collapse = async (
  documents: Document[],
  options?: {
    config?: BaseCallbackConfig;
  },
  tokenMax = 4000
) => {
  const editableConfig = options?.config;
  let docs = documents;
  let collapseCount = 1;
  while ((await getNumTokens(docs)) > tokenMax) {
    if (editableConfig) {
      editableConfig.runName = `Collapse ${collapseCount}`;
    }
    const splitDocs = splitListOfDocs(docs, getNumTokens, tokenMax);
    docs = await Promise.all(
      splitDocs.map((doc) => collapseDocs(doc, collapseChain.invoke))
    );
    collapseCount += 1;
  }
  return docs;
};

// Define the reduce chain to format, combine, and parse a list of documents
const reduceChain = RunnableSequence.from([
  { context: formatDocs },
  combinePrompt,
  model,
  outputParser,
]).withConfig({ runName: "Reduce" });

// Define the final map-reduce chain
const mapReduceChain = RunnableSequence.from([
  RunnableSequence.from([
    { doc: new RunnablePassthrough(), content: mapChain },
    (input) =>
      new Document({
        pageContent: input.content,
        metadata: input.doc.metadata,
      }),
  ])
    .withConfig({ runName: "Summarize (return doc)" })
    .map(),
  collapse,
  reduceChain,
]).withConfig({ runName: "Map reduce" });

// Define the text to be processed
const text = `Nuclear power in space is the use of nuclear power in outer space, typically either small fission systems or radioactive decay for electricity or heat. Another use is for scientific observation, as in a Mössbauer spectrometer. The most common type is a radioisotope thermoelectric generator, which has been used on many space probes and on crewed lunar missions. Small fission reactors for Earth observation satellites, such as the TOPAZ nuclear reactor, have also been flown.[1] A radioisotope heater unit is powered by radioactive decay and can keep components from becoming too cold to function, potentially over a span of decades.[2]

The United States tested the SNAP-10A nuclear reactor in space for 43 days in 1965,[3] with the next test of a nuclear reactor power system intended for space use occurring on 13 September 2012 with the Demonstration Using Flattop Fission (DUFF) test of the Kilopower reactor.[4]

After a ground-based test of the experimental 1965 Romashka reactor, which used uranium and direct thermoelectric conversion to electricity,[5] the USSR sent about 40 nuclear-electric satellites into space, mostly powered by the BES-5 reactor. The more powerful TOPAZ-II reactor produced 10 kilowatts of electricity.[3]

Examples of concepts that use nuclear power for space propulsion systems include the nuclear electric rocket (nuclear powered ion thruster(s)), the radioisotope rocket, and radioisotope electric propulsion (REP).[6] One of the more explored concepts is the nuclear thermal rocket, which was ground tested in the NERVA program. Nuclear pulse propulsion was the subject of Project Orion.[7]

Regulation and hazard prevention[edit]
After the ban of nuclear weapons in space by the Outer Space Treaty in 1967, nuclear power has been discussed at least since 1972 as a sensitive issue by states.[8] Particularly its potential hazards to Earth's environment and thus also humans has prompted states to adopt in the U.N. General Assembly the Principles Relevant to the Use of Nuclear Power Sources in Outer Space (1992), particularly introducing safety principles for launches and to manage their traffic.[8]

Benefits

Both the Viking 1 and Viking 2 landers used RTGs for power on the surface of Mars. (Viking launch vehicle pictured)
While solar power is much more commonly used, nuclear power can offer advantages in some areas. Solar cells, although efficient, can only supply energy to spacecraft in orbits where the solar flux is sufficiently high, such as low Earth orbit and interplanetary destinations close enough to the Sun. Unlike solar cells, nuclear power systems function independently of sunlight, which is necessary for deep space exploration. Nuclear-based systems can have less mass than solar cells of equivalent power, allowing more compact spacecraft that are easier to orient and direct in space. In the case of crewed spaceflight, nuclear power concepts that can power both life support and propulsion systems may reduce both cost and flight time.[9]

Selected applications and/or technologies for space include:

Radioisotope thermoelectric generator
Radioisotope heater unit
Radioisotope piezoelectric generator
Radioisotope rocket
Nuclear thermal rocket
Nuclear pulse propulsion
Nuclear electric rocket`;

// Split the text into documents and process them with the map-reduce chain
const docs = text.split("\n\n").map(
  (pageContent) =>
    new Document({
      pageContent,
      metadata: {
        source: "https://en.wikipedia.org/wiki/Nuclear_power_in_space",
      },
    })
);
const result = await mapReduceChain.invoke(docs);

// Print the result
console.log(result);
/**
 * View the full sequence on LangSmith
 * @link https://smith.langchain.com/public/f1c3b4ca-0861-4802-b1a0-10dcf70e7a89/r
 */
