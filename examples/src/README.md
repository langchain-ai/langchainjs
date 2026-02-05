# langchain-examples

This folder contains examples of how to use LangChain.

## Run an example

What you'll usually want to do.

First, build langchain. From the repository root, run:

```sh
pnpm install
pnpm build
```

Most examples require API keys. Run `cp .env.example .env`, then edit `.env` with your API keys.

Then from the `examples/` directory, run:

`pnpm run start <path to example>`

eg.

`pnpm run start ./src/prompts/few_shot.ts`

## Run an example with the transpiled JS

You shouldn't need to do this, but if you want to run an example with the transpiled JS, you can do so with:

`pnpm run start:dist <path to example>`

eg.

`pnpm run start:dist ./dist/prompts/few_shot.js`
