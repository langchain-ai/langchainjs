---
sidebar_position: 1
---

# Setup and Installation

## Quickstart

To get started with Langchain, you'll need to initialize a new Node.js project and configure some scripts to build, format, and compile your code.

If you just want to get started quickly, [clone this repository](https://github.com/domeccleston/langchain-ts-starter) and follow the README instructions for a boilerplate project with those dependencies set up.

If you'd prefer to set things up yourself, read on for instructions.

## Installation

To get started, install LangChain with the following command:

```bash npm2yarn
npm install -S langchain
```

We currently support LangChain on Node.js 18 and 19. Go [here](https://github.com/hwchase17/langchainjs/discussions/152) to vote on the next environment we should support.

### TypeScript

If you are using TypeScript we suggest updating your `tsconfig.json` to include the following:

```json
{
  "compilerOptions": {
    ...
    "target": "ES2020", // or higher
    "module": "nodenext",
  }
}
```

## Loading the library

### ESM in Node.js

LangChain is an ESM library currently targeting Node.js environments. To use it, you will need to use the `import` syntax, inside a project with `type: module` in its `package.json`.

```typescript
import { OpenAI } from "langchain";
```

### CommonJS in Node.js

If your project is using CommonJS, you can use LangChain only with the dynamic `import()` syntax.

```typescript
const { OpenAI } = await import("langchain");
```

If you're using TypeScript in a CommonJS project, you'll need to add the following to your `tsconfig.json`:

```json
{
  "compilerOptions": {
    ...
    "moduleResolution": "node16",
  }
}
```

### Other environments

LangChain currently supports only Node.js-based environments. This includes Vercel Serverless functions (but not Edge functions), as well as other serverless environments, like AWS Lambda and Google Cloud Functions.

We currently do not support running LangChain in the browser. We are listening to the community on additional environments that we should support. Go [here](https://github.com/hwchase17/langchainjs/discussions/152) to vote and discuss the next environments we should support.

Please see [Deployment](../production/deployment.md) for more information on deploying LangChain applications.

## Unsupported: Node.js 16

We do not support Node.js 16, but if you want to run LangChain on Node.js 16, you will need to follow the instructions in this section. We do not guarantee that these instructions will continue to work in the future.

You will have to make `fetch` available globally, either:

- run your application with `NODE_OPTIONS='--experimental-fetch' node ...`, or
- install `node-fetch` and follow the instructions [here](https://github.com/node-fetch/node-fetch#providing-global-access)

Additionally you'll have to polyfill `unstructuredClone`, eg. by installing `core-js` and following the instructions [here](https://github.com/zloirock/core-js).

If you are running this on Node.js 18 or 19, you do not need to do anything.
