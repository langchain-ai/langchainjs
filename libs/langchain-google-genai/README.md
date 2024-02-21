# @langchain/google-genai

This package contains the LangChain.js integrations for Gemini through their generative-ai SDK.

## Installation

```bash npm2yarn
npm install @langchain/google-genai
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate field to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/google-genai": "^0.0.0",
    "langchain": "0.0.207"
  },
  "resolutions": {
    "@langchain/core": "0.1.5"
  },
  "overrides": {
    "@langchain/core": "0.1.5"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "0.1.5"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `ChatGoogleGenerativeAI` class, which is the recommended way to interface with the Google Gemini series of models.

To use, install the requirements, and configure your environment.

```bash
export GOOGLE_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const model = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro",
  maxOutputTokens: 2048,
});
const response = await mode.invoke(new HumanMessage("Hello world!"));
```

#### Multimodal inputs

Gemini vision model supports image inputs when providing a single chat message. Example:

```bash npm2yarn
npm install @langchain/core
```

```typescript
import fs from "fs";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const vision = new ChatGoogleGenerativeAI({
  modelName: "gemini-pro-vision",
  maxOutputTokens: 2048,
});
const image = fs.readFileSync("./hotdog.jpg").toString("base64");
const input = [
  new HumanMessage({
    content: [
      {
        type: "text",
        text: "Describe the following image.",
      },
      {
        type: "image_url",
        image_url: `data:image/png;base64,${image}`,
      },
    ],
  }),
];

const res = await vision.invoke(input);
```

The value of `image_url` can be any of the following:

- A public image URL
- An accessible gcs file (e.g., "gcs://path/to/file.png")
- A base64 encoded image (e.g., `data:image/png;base64,abcd124`)
- A PIL image

## Embeddings

This package also adds support for google's embeddings models.

```typescript
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "embedding-001", // 768 dimensions
  taskType: TaskType.RETRIEVAL_DOCUMENT,
  title: "Document title",
});

const res = await embeddings.embedQuery("OK Google");
```

## Development

To develop the Google GenAI package, you'll need to follow these instructions:

### Install dependencies

```bash
yarn install
```

### Build the package

```bash
yarn build
```

Or from the repo root:

```bash
yarn build --filter=@langchain/google-genai
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test
$ yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `entrypoints` field in the `config` variable located inside `langchain.config.js` and run `yarn build` to generate the new entrypoint.
