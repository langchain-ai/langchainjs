import { ChatOpenAI } from "langchain/chat_models/openai";
import { Document } from "langchain/document";
import { BasePromptTemplate, PromptTemplate } from "langchain/prompts";
import { StringOutputParser } from "langchain/schema/output_parser";
import {
  RunnableLambda,
  RunnableMap,
  RunnablePassthrough,
  RunnableSequence,
} from "langchain/schema/runnable";

const model = new ChatOpenAI({});

const documentPrompt = PromptTemplate.fromTemplate("{page_content}");

function partial<F extends (...args: any[]) => any>(
  fn: F,
  ...partialArgs: any[]
): (...args: any[]) => ReturnType<F> {
  return (...args: any[]): ReturnType<F> => fn(...partialArgs, ...args);
}

/** @TODO refactor to be shared util */
const formatDocument = async (
  document: Document,
  prompt: BasePromptTemplate
): Promise<string> => {
  const baseInfo = {
    pageContent: document.pageContent,
    ...document.metadata,
  };
  const variables = new Set(prompt.inputVariables);
  const requiredMetadata = new Set(
    prompt.inputVariables
      .map((v) => (v !== "pageContent" ? v : null))
      .filter((v) => v !== null)
  );
  const missingMetadata = [];
  for (const variable of variables) {
    if (!(variable in baseInfo) && variable !== "pageContent") {
      missingMetadata.push(variable);
    }
  }
  if (missingMetadata.length) {
    throw new Error(
      `Document prompt requires documents to have metadata variables: ${requiredMetadata}. Received document with missing metadata: ${missingMetadata}`
    );
  }
  return prompt.format(baseInfo);
};

// const partialFormatDocument = async (document: Document): Promise<string> =>
//   formatDocument(document, documentPrompt);
const partialFormatDocument = partial(formatDocument, documentPrompt);

const formatDocs = async (documents: Document[]): Promise<string> => {
  const formattedDocs = await Promise.all(
    documents.map((doc) => partialFormatDocument(doc))
  );
  return formattedDocs.join("\n\n");
};

const getNumTokens = async (documents: Document[]): Promise<number> =>
  model.getNumTokens(await formatDocs(documents));

const outputParser = new StringOutputParser();

const mapChain = RunnableSequence.from([
  {
    context: async (i: { document: Document }) =>
      partialFormatDocument(i.document),
  },
  PromptTemplate.fromTemplate("Summarize this content:\n\n{context}"),
  model,
  outputParser,
]);

// Wrapper chain to keep the original metadata.
const mapAsDocChain = RunnableSequence.from([
  RunnableMap.from({
    doc: new RunnablePassthrough(),
    content: mapChain,
  }),
  RunnableLambda.from(
    (input) =>
      new Document({
        pageContent: input.content,
        metadata: input.doc.metadata,
      })
  ),
]).withConfig({ runName: "Summarize (return doc)" });

const collapseChain = RunnableSequence.from([
  {
    context: async (i: { documents: Document[] }) => formatDocs(i.documents),
  },
  PromptTemplate.fromTemplate("Collapse this content:\n\n{context}"),
  model,
  outputParser,
]);

const collapse = async (
  documents: Document[],
  /** @todo fix type */
  config: { runName: string },
  tokenMax = 4000
) => {
  let docs = documents;
  let collapseCount = 1;
  while ((await getNumTokens(docs)) > tokenMax) {
    const invoke = partial(collapseChain.invoke);
    /**
     * @TODO implement `splitListOfDocs` `collapseDocs` from py (_split_list_of_docs, _collapse_docs)
     */
    const splitDocs: Document[] = splitListOfDocs(docs, getNumTokens, tokenMax);
    docs = await Promise.all(splitDocs.map((doc) => collapseDocs(doc, invoke)));
    collapseCount += 1;
  }
  return docs;
};

const reduceChain = RunnableSequence.from([
  {
    context: formatDocs,
  },
  PromptTemplate.fromTemplate("Combine these summaries:\n\n{context}"),
  model,
  outputParser,
]).withConfig({ runName: "Reduce" });

// Final chain
const mapReduceChain = RunnableSequence.from([
  mapAsDocChain.map(),
  collapse,
  reduceChain,
]).withConfig({ runName: "Map reduce" });

// call chain
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

const docs = text.split("\n\n").map(
  (pageContent) =>
    new Document({
      pageContent,
      metadata: {
        source: "https://en.wikipedia.org/wiki/Nuclear_power_in_space",
      },
    })
);

const result = await mapReduceChain.invoke({ documents: docs });

console.log(result);
