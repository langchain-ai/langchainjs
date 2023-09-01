import { Document } from "langchain/document";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

const text = `Some other considerations include:

- Do you deploy your backend and frontend together, or separately?
- Do you deploy your backend co-located with your database, or separately?

**Production Support:** As you move your LangChains into production, we'd love to offer more hands-on support.
Fill out [this form](https://airtable.com/appwQzlErAS2qiP0L/shrGtGaVBVAz7NcV2) to share more about what you're building, and our team will get in touch.

## Deployment Options

See below for a list of deployment options for your LangChain app. If you don't see your preferred option, please get in touch and we can add it to this list.`;

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 50,
  chunkOverlap: 1,
  separators: ["|", "##", ">", "-"],
});

const docOutput = await splitter.splitDocuments([
  new Document({ pageContent: text }),
]);

console.log(docOutput);

/*
  [
    Document {
      pageContent: 'Some other considerations include:',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '- Do you deploy your backend and frontend together',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'r, or separately?',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '- Do you deploy your backend co',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '-located with your database, or separately?\n\n**Pro',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'oduction Support:** As you move your LangChains in',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: "nto production, we'd love to offer more hands",
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: '-on support.\nFill out [this form](https://airtable',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'e.com/appwQzlErAS2qiP0L/shrGtGaVBVAz7NcV2) to shar',
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: "re more about what you're building, and our team w",
      metadata: { loc: [Object] }
    },
    Document {
      pageContent: 'will get in touch.',
      metadata: { loc: [Object] }
    },
    Document { pageContent: '#', metadata: { loc: [Object] } },
    Document {
      pageContent: '# Deployment Options\n' +
        '\n' +
        "See below for a list of deployment options for your LangChain app. If you don't see your preferred option, please get in touch and we can add it to this list.",
      metadata: { loc: [Object] }
    }
  ]
*/
