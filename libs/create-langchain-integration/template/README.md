# @langchain/<ADD_PACKAGE_NAME_HERE>

This package contains the LangChain.js integrations for <ADD_NAME_HERE> through their SDK.

## Installation

\`\`\`bash npm2yarn
npm install @langchain/<ADD_PACKAGE_NAME_HERE>
\`\`\`

## Chat Models

This package contains the \`<ADD_CLASS_NAME_HERE>\` class, which is the recommended way to interface with the <ADD_NAME_HERE> series of models.

To use, install the requirements, and configure your environment.

\`\`\`bash
export <ADD_ENV_NAME_HERE>=your-api-key
\`\`\`

Then initialize

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const model = new ExampleChatClass({
apiKey: process.env.EXAMPLE_API_KEY,
});
const response = await model.invoke(new HumanMessage("Hello world!"));
\`\`\`

### Streaming

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const model = new ExampleChatClass({
apiKey: process.env.EXAMPLE_API_KEY,
});
const response = await model.stream(new HumanMessage("Hello world!"));
\`\`\`

## Embeddings

This package also adds support for <ADD_NAME_HERE> embeddings model.

\`\`\`typescript
import { <ADD_CLASS_NAME_HERE> } from "@langchain/<ADD_PACKAGE_NAME_HERE>";

const embeddings = new ExampleEmbeddingClass({
apiKey: process.env.EXAMPLE_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
\`\`\`

## Development

To develop the <ADD_NAME_HERE> package, you'll need to follow these instructions:

### Install dependencies

\`\`\`bash
yarn install
\`\`\`

### Build the package

\`\`\`bash
yarn build
\`\`\`

Or from the repo root:

\`\`\`bash
yarn build --filter=@langchain/<ADD_PACKAGE_NAME_HERE>
\`\`\`

### Run tests

Test files should live within a \`tests/\` file in the \`src/\` folder. Unit tests should end in \`.test.ts\` and integration tests should
end in \`.int.test.ts\`:

\`\`\`bash
$ yarn test
$ yarn test:int
\`\`\`

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

\`\`\`bash
yarn lint && yarn format
\`\`\`

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from \`src/index.ts\`, or add it to \`scripts/create-entrypoints.js\` and run \`yarn build\` to generate the new entrypoint.
