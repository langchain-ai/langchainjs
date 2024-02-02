---
title: Citations
---

How can we get a model to cite which parts of the source documents it
referenced in its response?

To explore some techniques for extracting citations, let’s first create
a simple RAG chain. To start we’ll just retrieve from the web using the
[TavilySearchAPIRetriever](https://js.langchain.com/docs/integrations/retrievers/tavily).

## Setup {#setup}

### Dependencies {#dependencies}

We’ll use an OpenAI chat model and embeddings and a Memory vector store
in this walkthrough, but everything shown here works with any
[ChatModel](/docs/modules/model_io/chat) or
[LLM](/docs/modules/model_io/llms),
[Embeddings](https://js.langchain.com/docs/modules/data_connection/text_embedding/),
and
[VectorStore](https://js.langchain.com/docs/modules/data_connection/vectorstores/)
or [Retriever](/docs/modules/data_connection/retrievers/).

We’ll use the following packages:

``` bash
npm install --save langchain @langchain/community @langchain/openai
```

We need to set environment variables for Tavily Search & OpenAI:

``` bash
export OPENAI_API_KEY=YOUR_KEY
export TAVILY_API_KEY=YOUR_KEY
```

### LangSmith {#langsmith}

Many of the applications you build with LangChain will contain multiple
steps with multiple invocations of LLM calls. As these applications get
more and more complex, it becomes crucial to be able to inspect what
exactly is going on inside your chain or agent. The best way to do this
is with [LangSmith](https://smith.langchain.com/).

Note that LangSmith is not needed, but it is helpful. If you do want to
use LangSmith, after you sign up at the link above, make sure to set
your environment variables to start logging traces:

``` bash
export LANGCHAIN_TRACING_V2=true
export LANGCHAIN_API_KEY=YOUR_KEY
```

``` typescript
import { TavilySearchAPIRetriever } from "@langchain/community/retrievers/tavily_search_api";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0,
});
const retriever = new TavilySearchAPIRetriever({
  k: 6,
});
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You're a helpful AI assistant. Given a user question and some web article snippets, answer the user question. If none of the articles answer the question, just say you don't know.\n\nHere are the web articles:{context}"],
  ["human", "{question}"],
])
```

Now that we’ve got a model, retriever and prompt, let’s chain them all
together. We’ll need to add some logic for formatting our retrieved
`Document`s to a string that can be passed to our prompt. We’ll make it
so our chain returns both the answer and the retrieved Documents.

``` typescript
import { Document } from "@langchain/core/documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableMap, RunnablePassthrough } from "@langchain/core/runnables";

/**
 * Format the documents into a readable string.
 */
const formatDocs = (input: Record<string, any>): string => {
  const { docs } = input;
  return "\n\n" + docs.map((doc: Document) => `Article title: ${doc.metadata.title}\nArticle Snippet: ${doc.pageContent}`).join("\n\n");
}
// subchain for generating an answer once we've done retrieval
const answerChain = prompt.pipe(llm).pipe(new StringOutputParser());
const map = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
})
// complete chain that calls the retriever -> formats docs to string -> runs answer subchain -> returns just the answer and retrieved docs.
const chain = map.assign({ context: formatDocs }).assign({ answer: answerChain }).pick(["answer", "docs"])
```

``` typescript
await chain.invoke("How fast are cheetahs?")
```

``` text
{
  answer: "Cheetahs can reach speeds as high as 75 mph or 120 km/h. They are known as the fastest land animals "... 9 more characters,
  docs: [
    Document {
      pageContent: "Cheetahs average speed is just 40 mph (64 km/h) but can quickly accelerate to its top speed. Fastest"... 211 more characters,
      metadata: {
        title: "How Fast Can a Cheetah Run? Top Speed, 6 Unique Features",
        source: "https://storyteller.travel/how-fast-can-a-cheetah-run/",
        score: 0.96548,
        images: null
      }
    },
    Document {
      pageContent: "By Anne Marie Helmenstine, Ph.D. Published on February 25, 2019 The cheetah ( Acinonyx jubatus) is t"... 190 more characters,
      metadata: {
        title: "How Fast Can a Cheetah Run? - ThoughtCo",
        source: "https://www.thoughtco.com/how-fast-can-a-cheetah-run-4587031",
        score: 0.93845,
        images: null
      }
    },
    Document {
      pageContent: "The Fastest Animal Time Frame. A cheetah run speed can get up to 76 miles per hour, but they can onl"... 249 more characters,
      metadata: {
        title: "How Fast Does a Cheetah Run? | Sciencing",
        source: "https://sciencing.com/how-fast-does-cheetah-run-4577113.html",
        score: 0.9378,
        images: null
      }
    },
    Document {
      pageContent: "Cheetahs hold the title of the world's fastest land animal and can reach a top speed of 70 miles per"... 95 more characters,
      metadata: {
        title: "Now Scientists Can Accurately Guess The Speed Of Any Animal",
        source: "https://www.nationalgeographic.com/animals/article/Animal-speed-size-cheetahs",
        score: 0.92704,
        images: null
      }
    },
    Document {
      pageContent: "Cheetahs are very lithe-they move quickly and full-grown adults weigh between 77 and 143 pounds and "... 220 more characters,
      metadata: {
        title: "How Fast Are Cheetahs - Proud Animal",
        source: "https://www.proudanimal.com/2024/01/27/fast-cheetahs/",
        score: 0.92169,
        images: null
      }
    },
    Document {
      pageContent: "If we're talking about long-distance runners, the American antelope takes that title because they ca"... 211 more characters,
      metadata: {
        title: "How Fast Can A Cheetah Run? - The Dodo",
        source: "https://www.thedodo.com/dodowell/how-fast-can-a-cheetah-run",
        score: 0.89592,
        images: null
      }
    }
  ]
}
```

LangSmith trace
[here](https://smith.langchain.com/public/a174ca65-3e9c-419b-81fd-71b83c9e747b/r)

## Function-calling {#function-calling}

### Cite documents {#cite-documents}

Let’s try using [OpenAI
function-calling](/docs/modules/model_io/chat/function_calling) to make
the model specify which of the provided documents it’s actually
referencing when answering. LangChain has some utils for converting
objects or zod objects to the JSONSchema format expected by OpenAI, so
we’ll use that to define our functions:

``` typescript
import { z } from "zod";
import { StructuredTool } from "@langchain/core/tools";
import { formatToOpenAITool } from "@langchain/openai";

class CitedAnswer extends StructuredTool {
  name = "cited_answer";
  
  description = "Answer the user question based only on the given sources, and cite the sources used.";

  schema = z.object({
    answer: z.string().describe("The answer to the user question, which is based only on the given sources."),
    citations: z.array(z.number()).describe("The integer IDs of the SPECIFIC sources which justify the answer.")
  });

  constructor() {
    super();
  }

  _call(input: z.infer<typeof this["schema"]>): Promise<string> {
    return Promise.resolve(JSON.stringify(input, null, 2));
  }
}

const asOpenAITool = formatToOpenAITool(new CitedAnswer());
const tools1 = [asOpenAITool];
```

Let’s see what the model output is like when we pass in our functions
and a user input:

``` typescript
const llmWithTool1 = llm.bind({
  tools: tools1,
  tool_choice: asOpenAITool
});

const exampleQ = `What Brian's height?

Source: 1
Information: Suzy is 6'2"

Source: 2
Information: Jeremiah is blonde

Source: 3
Information: Brian is 3 inches shorted than Suzy`;

await llmWithTool1.invoke(exampleQ);
```

``` text
AIMessage {
  lc_serializable: true,
  lc_kwargs: {
    content: "",
    additional_kwargs: {
      function_call: undefined,
      tool_calls: [
        {
          id: "call_1Yq1XtymEVgyV5JE2DwKfrv9",
          type: "function",
          function: [Object]
        }
      ]
    }
  },
  lc_namespace: [ "langchain_core", "messages" ],
  content: "",
  name: undefined,
  additional_kwargs: {
    function_call: undefined,
    tool_calls: [
      {
        id: "call_1Yq1XtymEVgyV5JE2DwKfrv9",
        type: "function",
        function: {
          name: "cited_answer",
          arguments: "{\n" +
            `  "answer": "Brian's height is 6'2\\" - 3 inches",\n` +
            '  "citations": [1, 3]\n' +
            "}"
        }
      }
    ]
  }
}
```

LangSmith trace
[here](https://smith.langchain.com/public/e7065354-e238-4270-a1c8-155b5850a670/r)

We’ll add an output parser to convert the OpenAI API response to a nice
object. We use the
[JsonOutputKeyToolsParser](https://api.js.langchain.com/classes/langchain_output_parsers.JsonOutputKeyToolsParser.html)
for this:

``` typescript
import { JsonOutputKeyToolsParser } from "langchain/output_parsers";

const outputParser = new JsonOutputKeyToolsParser({ keyName: "cited_answer", returnSingle: true });

await llmWithTool1.pipe(outputParser).invoke(exampleQ);
```

``` text
{ answer: `Brian's height is 6'2" - 3 inches`, citations: [ 1, 3 ] }
```

LangSmith trace
[here](https://smith.langchain.com/public/651d5df3-7d48-43a0-9ef7-9d0164c77825/r)

Now we’re ready to put together our chain

``` typescript
import { Document } from "@langchain/core/documents";

const formatDocsWithId = (docs: Array<Document>): string => {
  return "\n\n" + docs.map((doc: Document, idx: number) => `Source ID: ${idx}\nArticle title: ${doc.metadata.title}\nArticle Snippet: ${doc.pageContent}`).join("\n\n");
}
// subchain for generating an answer once we've done retrieval
const answerChain1 = prompt.pipe(llmWithTool).pipe(outputParser);
const map1 = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
})
// complete chain that calls the retriever -> formats docs to string -> runs answer subchain -> returns just the answer and retrieved docs.
const chain1 = map1
  .assign({ context: (input: { docs: Array<Document> }) => formatDocsWithId(input.docs) })
  .assign({ cited_answer: answerChain1 })
  .pick(["cited_answer", "docs"])
```

``` typescript
await chain1.invoke("How fast are cheetahs?")
```

``` text
{
  cited_answer: {
    answer: "Cheetahs can reach speeds of up to 75 mph (120 km/h).",
    citations: [ 2, 3 ]
  },
  docs: [
    Document {
      pageContent: "They are surprisingly graceful\n" +
        "Cheetahs are very lithe-they move quickly and full-grown adults weigh"... 824 more characters,
      metadata: {
        title: "How Fast Are Cheetahs - Proud Animal",
        source: "https://www.proudanimal.com/2024/01/27/fast-cheetahs/",
        score: 0.96633,
        images: null
      }
    },
    Document {
      pageContent: "Why is it that cheetahs can run so fast? How can humans get to be that fast? Cheetah biologist Adrie"... 60 more characters,
      metadata: {
        title: "Why Humans Can't Run Cheetah Speeds (70mph) and How We Could - YouTube",
        source: "https://www.youtube.com/watch?v=rgrgxn3yhRQ",
        score: 0.9576,
        images: null
      }
    },
    Document {
      pageContent: "The science of cheetah speed\n" +
        "The cheetah (Acinonyx jubatus) is the fastest land animal on Earth, cap"... 738 more characters,
      metadata: {
        title: "How Fast Can a Cheetah Run? - ThoughtCo",
        source: "https://www.thoughtco.com/how-fast-can-a-cheetah-run-4587031",
        score: 0.9553,
        images: null
      }
    },
    Document {
      pageContent: "The maximum speed cheetahs have been measured at is 114 km (71 miles) per hour, and they routinely r"... 1048 more characters,
      metadata: {
        title: "Cheetah | Description, Speed, Habitat, Diet, Cubs, & Facts",
        source: "https://www.britannica.com/animal/cheetah-mammal",
        score: 0.94941,
        images: null
      }
    },
    Document {
      pageContent: "Record-Breaking Speeds: How Fast Can a Cheetah Run? The cheetah's speed has been a subject of awe an"... 239 more characters,
      metadata: {
        title: "How fast can a cheetah run? - AnimalKnowAnimalKnow",
        source: "https://animalknow.com/how-fast-can-a-cheetah-run/",
        score: 0.91676,
        images: null
      }
    },
    Document {
      pageContent: "The Science of Speed\n" +
        "Instead, previous research has shown that the fastest animals are not the large"... 743 more characters,
      metadata: {
        title: "Now Scientists Can Accurately Guess The Speed Of Any Animal",
        source: "https://www.nationalgeographic.com/animals/article/Animal-speed-size-cheetahs",
        score: 0.85173,
        images: null
      }
    }
  ]
}
```

LangSmith trace
[here](https://smith.langchain.com/public/055d2e16-95d4-4d5c-8b1d-40390f1ef5ce/r)

### Cite snippets {#cite-snippets}

What if we want to cite actual text spans? We can try to get our model
to return these, too.

*Aside: Note that if we break up our documents so that we have many
documents with only a sentence or two instead of a few long documents,
citing documents becomes roughly equivalent to citing snippets, and may
be easier for the model because the model just needs to return an
identifier for each snippet instead of the actual text. Probably worth
trying both approaches and evaluating.*

``` typescript
const citationSchema = z.object({
  sourceId: z.number().describe("The integer ID of a SPECIFIC source which justifies the answer."),
  quote: z.string().describe("The VERBATIM quote from the specified source that justifies the answer.")
})

class QuotedAnswer extends StructuredTool {
  name = "quoted_answer";
  
  description = "Answer the user question based only on the given sources, and cite the sources used.";

  schema = z.object({
    answer: z.string().describe("The answer to the user question, which is based only on the given sources."),
    citations: z.array(citationSchema).describe("Citations from the given sources that justify the answer.")
  });

  constructor() {
    super();
  }

  _call(input: z.infer<typeof this["schema"]>): Promise<string> {
    return Promise.resolve(JSON.stringify(input, null, 2));
  }
}

const quotedAnswerTool = formatToOpenAITool(new QuotedAnswer());
const tools2 = [quotedAnswerTool];
```

``` typescript

import { Document } from "@langchain/core/documents";

const outputParser2 = new JsonOutputKeyToolsParser({ keyName: "quoted_answer", returnSingle: true });
const llmWithTool2 = llm.bind({
  tools2,
  tool_choice: quotedAnswerTool,
});
const answerChain2 = prompt.pipe(llmWithTool2).pipe(outputParser2);
const map2 = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
})
// complete chain that calls the retriever -> formats docs to string -> runs answer subchain -> returns just the answer and retrieved docs.
const chain2 = map2
  .assign({ context: (input: { docs: Array<Document> }) => formatDocsWithId(input.docs) })
  .assign({ quoted_answer: answerChain2 })
  .pick(["quoted_answer", "docs"]);
```

``` typescript
await chain2.invoke("How fast are cheetahs?")
```

``` text
{
  quoted_answer: {
    answer: "Cheetahs can reach speeds of up to 75 mph (120 km/h).",
    citations: [
      {
        sourceId: 1,
        quote: "The cheetah (Acinonyx jubatus) is the fastest land animal on Earth, capable of reaching speeds as hi"... 25 more characters
      },
      {
        sourceId: 4,
        quote: "The maximum speed cheetahs have been measured at is 114 km (71 miles) per hour."
      }
    ]
  },
  docs: [
    Document {
      pageContent: "Contact Us − +\n" +
        "Address\n" +
        "Smithsonian's National Zoo & Conservation Biology Institute  3001 Connecticut"... 1343 more characters,
      metadata: {
        title: "Cheetah | Smithsonian's National Zoo and Conservation Biology Institute",
        source: "https://nationalzoo.si.edu/animals/cheetah",
        score: 0.95643,
        images: null
      }
    },
    Document {
      pageContent: "The science of cheetah speed\n" +
        "The cheetah (Acinonyx jubatus) is the fastest land animal on Earth, cap"... 738 more characters,
      metadata: {
        title: "How Fast Can a Cheetah Run? - ThoughtCo",
        source: "https://www.thoughtco.com/how-fast-can-a-cheetah-run-4587031",
        score: 0.94229,
        images: null
      }
    },
    Document {
      pageContent: "Cheetahs - World's Fastest Animal | National Geographic National Geographic 357K views 11 years ago "... 88 more characters,
      metadata: {
        title: "The Science of a Cheetah's Speed | National Geographic",
        source: "https://www.youtube.com/watch?v=icFMTB0Pi0g",
        score: 0.93891,
        images: null
      }
    },
    Document {
      pageContent: "If a lion comes along, the cheetah will abandon its catch -- it can't fight off a lion, and chances "... 911 more characters,
      metadata: {
        title: "What makes a cheetah run so fast? | HowStuffWorks",
        source: "https://animals.howstuffworks.com/mammals/cheetah-speed.htm",
        score: 0.91437,
        images: null
      }
    },
    Document {
      pageContent: "The maximum speed cheetahs have been measured at is 114 km (71 miles) per hour, and they routinely r"... 1048 more characters,
      metadata: {
        title: "Cheetah | Description, Speed, Habitat, Diet, Cubs, & Facts",
        source: "https://www.britannica.com/animal/cheetah-mammal",
        score: 0.90777,
        images: null
      }
    },
    Document {
      pageContent: "Now, their only hope lies in the hands of human conservationists, working tirelessly to save the che"... 880 more characters,
      metadata: {
        title: "How Fast Are Cheetahs, and Other Fascinating Facts About the World's ...",
        source: "https://www.discovermagazine.com/planet-earth/how-fast-are-cheetahs-and-other-fascinating-facts-abou"... 21 more characters,
        score: 0.87011,
        images: null
      }
    }
  ]
}
```

LangSmith trace
[here](https://smith.langchain.com/public/b071841e-e563-4edd-8299-fcd6a705ac83/r)

## Direct prompting {#direct-prompting}

Most models don’t yet support function-calling. We can achieve similar
results with direct prompting. Let’s see what this looks like using an
Anthropic chat model that is particularly proficient in working with
XML:

### Setup {#setup-1}

Install the LangChain Anthropic integration package:

``` bash
npm install @langchain/anthropic
```

Add your Anthropic API key to your environment:

``` bash
export ANTHROPIC_API_KEY=YOUR_KEY
```

``` typescript
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const anthropic = new ChatAnthropic({
  modelName: "claude-instant-1.2",
});
const system = `You're a helpful AI assistant. Given a user question and some web article snippets,
answer the user question and provide citations. If none of the articles answer the question, just say you don't know.

Remember, you must return both an answer and citations. A citation consists of a VERBATIM quote that
justifies the answer and the ID of the quote article. Return a citation for every quote across all articles
that justify the answer. Use the following format for your final output:

<cited_answer>
    <answer></answer>
    <citations>
        <citation><source_id></source_id><quote></quote></citation>
        <citation><source_id></source_id><quote></quote></citation>
        ...
    </citations>
</cited_answer>

Here are the web articles:{context}`;

const anthropicPrompt = ChatPromptTemplate.fromMessages([
  ["system", system],
  ["human", "{question}"]
]);
```

``` typescript
import { XMLAgentOutputParser } from "langchain/agents/xml/output_parser";
import { Document } from "@langchain/core/documents";
import { RunnableLambda, RunnablePassthrough, RunnableMap } from "@langchain/core/runnables";

const formatDocsToXML = (docs: Array<Document>): string => {
  const formatted: Array<string> = [];
  docs.forEach((doc, idx) => {
    const docStr = `<source id="${idx}">
  <title>${doc.metadata.title}</title>
  <article_snippet>${doc.pageContent}</article_snippet>
</source>`
    formatted.push(docStr);
  });
  return `\n\n<sources>${formatted.join("\n")}</sources>`;
}

const format3 = new RunnableLambda({
  func: (input: { docs: Array<Document> }) => formatDocsToXML(input.docs)
})
const answerChain = anthropicPrompt
  .pipe(anthropic)
  .pipe(new XMLAgentOutputParser())
  .pipe(
    new RunnableLambda({ func: (input: { cited_answer: any }) => input.cited_answer })
  );
const map3 = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
});
const chain3 = map3.assign({ context: format3 }).assign({ cited_answer: answerChain }).pick(["cited_answer", "docs"])
```

``` typescript
await chain3.invoke("How fast are cheetahs?")
```

## Retrieval post-processing {#retrieval-post-processing}

Another approach is to post-process our retrieved documents to compress
the content, so that the source content is already minimal enough that
we don’t need the model to cite specific sources or spans. For example,
we could break up each document into a sentence or two, embed those and
keep only the most relevant ones. LangChain has some built-in components
for this. Here we’ll use a
[RecursiveCharacterTextSplitter](https://js.langchain.com/docs/modules/data_connection/document_transformers/recursive_text_splitter),
which creates chunks of a specified size by splitting on separator
substrings, and an
[EmbeddingsFilter](https://js.langchain.com/docs/modules/data_connection/retrievers/contextual_compression#embeddingsfilter),
which keeps only the texts with the most relevant embeddings.

``` typescript
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { EmbeddingsFilter } from "langchain/retrievers/document_compressors/embeddings_filter";
import { OpenAIEmbeddings } from "@langchain/openai";
import { DocumentInterface } from "@langchain/core/documents";
import { RunnableMap, RunnablePassthrough } from "@langchain/core/runnables";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 400,
  chunkOverlap: 0,
  separators: ["\n\n", "\n", ".", " "],
  keepSeparator: false,
});

const compressor = new EmbeddingsFilter({
  embeddings: new OpenAIEmbeddings(),
  k: 10,
});

const splitAndFilter = async (input): Promise<Array<DocumentInterface>> => {
  const { docs, question } = input;
  const splitDocs = await splitter.splitDocuments(docs);
  const statefulDocs = await compressor.compressDocuments(splitDocs, question);
  return statefulDocs;
};

const retrieveMap = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
});

const retrieve = retrieveMap.pipe(splitAndFilter);
const docs = await retrieve.invoke("How fast are cheetahs?");
for (const doc of docs) {
  console.log(doc.pageContent, "\n\n");
}
```

``` text
The maximum speed cheetahs have been measured at is 114 km (71 miles) per hour, and they routinely reach velocities of 80–100 km (50–62 miles) per hour while pursuing prey.
cheetah,
(Acinonyx jubatus), 


The science of cheetah speed
The cheetah (Acinonyx jubatus) is the fastest land animal on Earth, capable of reaching speeds as high as 75 mph or 120 km/h. Cheetahs are predators that sneak up on their prey and sprint a short distance to chase and attack.
 Key Takeaways: How Fast Can a Cheetah Run?
Fastest Cheetah on Earth 


Built for speed, the cheetah can accelerate from zero to 45 in just 2.5 seconds and reach top speeds of 60 to 70 mph, making it the fastest land mammal! Fun Facts
Conservation Status
Cheetah News
Taxonomic Information
Animal News
NZCBI staff in Front Royal, Virginia, are mourning the loss of Walnut, a white-naped crane who became an internet sensation for choosing one of her keepers as her mate. 


We’ve mentioned that these guys can reach speeds of up to 70 mph, but did you know they can go from 0-60 mph in 3 seconds?This fact becomes even more surreal when you see a cheetah running in slow motion.
 Females enjoy the quiet lifeFemale cheetahs live alone for the most part, except when they give birth-then they live with their cubs in a small pack. 


Scientists calculate a cheetah's top speed is 75 mph, but the fastest recorded speed is somewhat slower. The top 10 fastest animals are: 


They are surprisingly graceful
Cheetahs are very lithe-they move quickly and full-grown adults weigh between 77 and 143 pounds and reach between 3.5 and 4.5 feet in length (not including their tails). 


The pronghorn, an American animal resembling an antelope, is the fastest land animal in the Western Hemisphere. While a cheetah's top speed ranges from 65 to 75 mph (104 to 120 km/h), its average speed is only 40 mph (64 km/hr), punctuated by short bursts at its top speed. Basically, if a predator threatens to take a cheetah's kill or attack its young, a cheetah has to run. 


A cheetah eats a variety of small animals, including game birds, rabbits, small antelopes (including the springbok, impala, and gazelle), young warthogs, and larger antelopes (such as the kudu, hartebeest, oryx, and roan). Their faces are distinguished by prominent black lines that curve from the inner corner of each eye to the outer corners of the mouth, like a well-worn trail of inky tears. 


Cheetahs eat a variety of small animals, including game birds, rabbits, small antelopes (including the springbok, impala, and gazelle), young warthogs, and larger antelopes (such as the kudu, hartebeest, oryx, and roan) 


Historically, cheetahs ranged widely throughout Africa and Asia, from the Cape of Good Hope to the Mediterranean, throughout the Arabian Peninsula and the Middle East, from Israel, India and Pakistan north to the northern shores of the Caspian and Aral Seas, and west through Uzbekistan, Turkmenistan, Afghanistan, and Pakistan into central India. Header Links 

```

LangSmith trace
[here](https://smith.langchain.com/public/3f64795b-471e-49ec-b918-cbecac5c2945/r)

``` typescript
const chain4 = retrieveMap
  .assign({ context: formatDocs })
  .assign({ answer: answerChain })
  .pick(["answer", "docs"]);
```

``` typescript
// Note the documents have an article "summary" in the metadata that is now much longer than the
// actual document page content. This summary isn't actually passed to the model.
await chain4.invoke("How fast are cheetahs?")
```

``` text
{
  answer: "Cheetahs can reach speeds of up to 114 km/h (71 mph) and routinely reach velocities of 80-100 km/h ("... 31 more characters,
  docs: [
    Document {
      pageContent: "One of two videos from National Geographic's award-winning multimedia coverage of cheetahs in the ma"... 60 more characters,
      metadata: {
        title: "The Science of a Cheetah's Speed | National Geographic",
        source: "https://www.youtube.com/watch?v=icFMTB0Pi0g",
        score: 0.95554,
        images: null
      }
    },
    Document {
      pageContent: "The maximum speed cheetahs have been measured at is 114 km (71 miles) per hour, and they routinely r"... 1048 more characters,
      metadata: {
        title: "Cheetah | Description, Speed, Habitat, Diet, Cubs, & Facts",
        source: "https://www.britannica.com/animal/cheetah-mammal",
        score: 0.94757,
        images: null
      }
    },
    Document {
      pageContent: "Now, their only hope lies in the hands of human conservationists, working tirelessly to save the che"... 880 more characters,
      metadata: {
        title: "How Fast Are Cheetahs, and Other Fascinating Facts About the World's ...",
        source: "https://www.discovermagazine.com/planet-earth/how-fast-are-cheetahs-and-other-fascinating-facts-abou"... 21 more characters,
        score: 0.94164,
        images: null
      }
    },
    Document {
      pageContent: "Contact Us − +\n" +
        "Address\n" +
        "Smithsonian's National Zoo & Conservation Biology Institute  3001 Connecticut"... 1343 more characters,
      metadata: {
        title: "Cheetah | Smithsonian's National Zoo and Conservation Biology Institute",
        source: "https://nationalzoo.si.edu/animals/cheetah",
        score: 0.91757,
        images: null
      }
    },
    Document {
      pageContent: "The science of cheetah speed\n" +
        "The cheetah (Acinonyx jubatus) is the fastest land animal on Earth, cap"... 738 more characters,
      metadata: {
        title: "How Fast Can a Cheetah Run? - ThoughtCo",
        source: "https://www.thoughtco.com/how-fast-can-a-cheetah-run-4587031",
        score: 0.90266,
        images: null
      }
    },
    Document {
      pageContent: "If a lion comes along, the cheetah will abandon its catch -- it can't fight off a lion, and chances "... 911 more characters,
      metadata: {
        title: "What makes a cheetah run so fast? | HowStuffWorks",
        source: "https://animals.howstuffworks.com/mammals/cheetah-speed.htm",
        score: 0.87543,
        images: null
      }
    }
  ]
}
```

LangSmith trace
[here](https://smith.langchain.com/public/90baf397-ea90-4d6f-8cdb-ccfa462f3906/r)

## Generation post-processing {#generation-post-processing}

Another approach is to post-process our model generation. In this
example we’ll first generate just an answer, and then we’ll ask the
model to annotate it’s own answer with citations. The downside of this
approach is of course that it is slower and more expensive, because two
model calls need to be made.

Let’s apply this to our initial chain.

``` typescript
import { StructuredTool } from "@langchain/core/tools";
import { formatToOpenAITool } from "@langchain/openai";
import { z } from "zod";

class AnnotatedAnswer extends StructuredTool {
  name = "annotated_answer";

  description = "Annotate the answer to the user question with quote citations that justify the answer";

  schema = z.object({
    citations: z.array(citationSchema).describe("Citations from the given sources that justify the answer."),
  })

  _call(input: z.infer<typeof this["schema"]>): Promise<string> {
    return Promise.resolve(JSON.stringify(input, null, 2));
  }
}

const annotatedAnswerTool = formatToOpenAITool(new AnnotatedAnswer());

const llmWithTools5 = llm.bind({
  tools: [annotatedAnswerTool],
  tool_choice: annotatedAnswerTool,
})
```

``` typescript
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputKeyToolsParser } from "langchain/output_parsers";

const prompt5 = ChatPromptTemplate.fromMessages([
  ["system", "You're a helpful AI assistant. Given a user question and some web article snippets, answer the user question. If none of the articles answer the question, just say you don't know.\n\nHere are the web articles:{context}"],
  ["human", "{question}"],
  new MessagesPlaceholder({
    variableName: "chatHistory",
    optional: true,
  })
]);

const answerChain5 = prompt5.pipe(llmWithTools5);
const annotationChain = RunnableSequence.from([
  prompt5,
  llmWithTools5,
  new JsonOutputKeyToolsParser({ keyName: "annotated_answer", returnSingle: true }),
  (input: any) => input.citations
]);
const map5 = RunnableMap.from({
  question: new RunnablePassthrough(),
  docs: retriever,
});
const chain5 = map5
  .assign({ context: formatDocs })
  .assign({ aiMessage: answerChain5 })
  .assign({
    chatHistory: (input) => input.aiMessage,
  })
  .assign({
    annotations: annotationChain,
  })
  .pick(["answer", "docs", "annotations"]);
```

``` typescript
await chain5.invoke("How fast are cheetahs?")
```

``` text
Error: 400 An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'. The following tool_call_ids did not have response messages: call_fdDEdtQO931deoAMhWt0CKKR
```

