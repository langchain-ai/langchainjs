import { getDocs } from "./docs.js";

const docs = await getDocs();

console.log(docs[0].metadata);

/**
{
  source: 'HAn9vnJy6S4',
  description: 'OpenGPTs is an open-source platform aimed at recreating an experience like the GPT Store - but with any model, any tools, and that you can self-host.\n' +
    '\n' +
    'This video covers both how to use it as well as how to build it.\n' +
    '\n' +
    'GitHub: https://github.com/langchain-ai/opengpts',
  title: 'OpenGPTs',
  view_count: 7262,
  author: 'LangChain'
}
 */

// And here's a sample from a document's contents:

console.log(docs[0].pageContent.slice(0, 500));

/*
hello today I want to talk about open gpts open gpts is a project that we built here at linkchain uh that replicates the GPT store in a few ways so it creates uh end user-facing friendly interface to create different Bots and these Bots can have access to different tools and they can uh be given files to retrieve things over and basically it's a way to create a variety of bots and expose the configuration of these Bots to end users it's all open source um it can be used with open AI it can be us
 */
