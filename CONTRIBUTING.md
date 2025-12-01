# Contributing to LangChain

👋 Hi there! Thank you for being interested in contributing to LangChain.
As an open source project in a rapidly developing field, we are extremely open
to contributions, whether it be in the form of a new feature, improved infra, or better documentation.

To contribute to this project, please follow a ["fork and pull request"](https://docs.github.com/en/get-started/quickstart/contributing-to-projects) workflow. Please do not try to push directly to this repo unless you are a maintainer.

## Quick Links

### Not sure what to work on?

If you are not sure what to work on, we have a few suggestions:

- Look at the issues with the [help wanted](https://github.com/langchain-ai/langchainjs/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) label. These are issues that we think are good targets for contributors. If you are interested in working on one of these, please comment on the issue so that we can assign it to you. And if you have any questions let us know, we're happy to guide you!
- At the moment our main focus is reaching parity with the Python version for features and base functionality. If you are interested in working on a specific integration or feature, please let us know and we can help you get started.

### New abstractions

We aim to keep the same core APIs between the Python and JS versions of LangChain, where possible. As such we ask that if you have an idea for a new abstraction, please open an issue first to discuss it. This will help us make sure that the API is consistent across both versions. If you're not sure what to work on, we recommend looking at the links above first.

### Want to add a specific integration?

LangChain supports several different types of integrations with third-party providers and frameworks, including LLM providers (e.g. [OpenAI](https://github.com/langchain-ai/langchainjs/blob/main/libs/providers/langchain-openai/src/chat_models.ts)), vector stores (e.g. [FAISS](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community/src/vectorstores/faiss.ts), document loaders (e.g. [Apify](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community/src/document_loaders/web/apify_dataset.ts)) persistent message history stores (e.g. [Redis](https://github.com/langchain-ai/langchainjs/blob/main/libs/providers/langchain-redis/src/caches.ts)), and more.

We welcome such contributions, but ask that you read our dedicated [integration contribution guide](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) for specific details and patterns to consider before opening a pull request.

You can also check out the [guides on extending LangChain.js](https://js.langchain.com/docs/how_to/#custom) in our docs.

#### Integration packages

Integrations should generally reside in the `libs/langchain-community` workspace and be imported as `@langchain/community/module/name`. More in-depth integrations or suites of integrations may also reside in separate packages that depend on and extend `@langchain/core`. See [`@langchain/google-genai`](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-google-genai) for an example.

### Want to add a feature that's already in Python?

If you're interested in contributing a feature that's already in the [LangChain Python repo](https://github.com/langchain-ai/langchain) and you'd like some help getting started, you can try pasting code snippets and classes into the [LangChain Python to JS translator](https://langchain-translator.vercel.app/).

It's a chat interface wrapping a fine-tuned `gpt-3.5-turbo` instance trained on prior ported features. This allows the model to innately take into account LangChain-specific code style and imports.

It's an ongoing project, and feedback on runs will be used to improve the [LangSmith dataset](https://smith.langchain.com) for further fine-tuning! Try it out below:

<https://langchain-translator.vercel.app/>

## 🗺️ Contributing Guidelines

### 🚩 GitHub Issues

Our [issues](https://github.com/langchain-ai/langchainjs/issues) primarily contains bug reports and docs improvements. For feature requests, please defer to the [LangChain Forum](https://forum.langchain.com/).

If you start working on an issue, please assign it to yourself.

If you are adding an issue, please try to keep it focused on a single modular bug/improvement/feature.
If the two issues are related, or blocking, please link them rather than keep them as one single one.

We will try to keep these issues as up to date as possible, though
with the rapid rate of development in this field some may get out of date.
If you notice this happening, please just let us know.

### 🙋 Getting Help

Although we try to have a developer setup to make it as easy as possible for others to contribute (see below)
it is possible that some pain point may arise around environment setup, linting, documentation, or other.
Should that occur, please contact a maintainer! Not only do we want to help get you unblocked,
but we also want to make sure that the process is smooth for future contributors.

In a similar vein, we do enforce certain linting, formatting, and documentation standards in the codebase.
If you are finding these difficult (or even just annoying) to work with,
feel free to contact a maintainer for help - we do not want these to get in the way of getting
good code into the codebase.

### 🏭 Release process

As of now, LangChain has an ad hoc release process: releases are cut with high frequency by
a developer and published to [npm](https://www.npmjs.com/package/langchain).

If your contribution has made its way into a release, we will want to give you credit on Twitter (only if you want though)!
If you have a Twitter account you would like us to mention, please let us know in the PR or in another manner.

#### 🧪 Dev Releases

For testing unreleased changes, maintainers can publish dev releases of individual packages. Dev releases are published to npm with a special tag and version format that includes the git commit SHA.

**To create a dev release:**

1. Go to [Actions → Dev Release](https://github.com/langchain-ai/langchainjs/actions/workflows/dev-release.yml)
2. Click "Run workflow"
3. Select the branch you want to release from (defaults to `main`, but you can choose your feature branch)
4. Select the package you want to release from the dropdown
5. Optionally change the npm tag (defaults to `dev`)
6. Click "Run workflow"

**Version format:** `x.y.z-<tag>.<short-sha>` (e.g., `1.1.0-dev.abc1234`)

**To install a dev release:**

```bash
# Install the latest dev release
npm install @langchain/core@dev

# Install a specific dev version
npm install @langchain/core@1.1.0-dev.abc1234
```

Dev releases are useful for:

- Testing bug fixes before an official release
- Validating new features in downstream projects
- CI/CD pipelines that need to test against the latest changes

### 🛠️ Tooling

This project uses the following tools, which are worth getting familiar
with if you plan to contribute:

- **[pnpm](https://pnpm.io/) (v10.14.0)** - dependency management
- **[eslint](https://eslint.org/)** - enforcing standard lint rules
- **[prettier](https://prettier.io/)** - enforcing standard code formatting
- **[vitest](https://vitest.dev/)** - testing code

## 🚀 Quick Start

Clone this repo, then cd into it:

```bash
cd langchainjs
```

Next, try running the following common tasks:

## ✅ Common Tasks

Our goal is to make it as easy as possible for you to contribute to this project.
All of the below commands should be run from within a workspace directory (e.g. `libs/langchain`, `libs/langchain-community`) unless otherwise noted.

```bash
cd libs/langchain
```

Or, if you are working on a community integration:

```bash
cd libs/langchain-community
```

### Setup

**Prerequisite**: Node version v24.x is required. Please check node version `node -v` and update it if required.

To get started, you will need to install the dependencies for the project. To do so, run:

```bash
pnpm install
```

Then, you will need to switch directories into `libs/langchain-core` and build core by running:

```bash
cd libs/langchain-core
pnpm install
pnpm build
```

### Linting

We use [eslint](https://eslint.org/) to enforce standard lint rules.
To run the linter, run:

```bash
pnpm lint
```

### Formatting

We use [prettier](https://prettier.io) to enforce code formatting style.
To run the formatter, run:

```bash
pnpm format
```

To just check for formatting differences, without fixing them, run:

```bash
pnpm format:check
```

### Testing

In general, tests should be added within a `tests/` folder alongside the modules they
are testing.

**Unit tests** cover modular logic that does not require calls to outside APIs.

If you add new logic, please add a unit test.
Unit tests should be called `*.test.ts`.

To run only unit tests, run:

```bash
pnpm test
```

#### Running a single test

To run a single test, run the following from within a workspace:

```bash
pnpm test:single /path/to/yourtest.test.ts
```

This is useful for developing individual features.

**Integration tests** cover logic that requires making calls to outside APIs (often integration with other services).

If you add support for a new external API, please add a new integration test.
Integration tests should be called `*.int.test.ts`.

Note that most integration tests require credentials or other setup. You will likely need to set up a `libs/langchain/.env` or `libs/langchain-community/.env` file
like the example [here](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain/.env.example).

We generally recommend only running integration tests with `pnpm test:single`, but if you want to run all integration tests, run:

```bash
pnpm test:integration
```

### Building

To build the project, run:

```bash
pnpm build
```

### Adding an Entrypoint

LangChain exposes multiple subpaths the user can import from, e.g.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

We call these subpaths "entrypoints". In general, you should create a new entrypoint if you are adding a new integration with a 3rd party library. If you're adding self-contained functionality without any external dependencies, you can add it to an existing entrypoint.

In order to declare a new entrypoint that users can import from, you
should edit the `libs/langchain/langchain.config.js` or `libs/langchain-community/langchain.config.js` file. To add an
entrypoint `tools` that imports from `tools/index.ts` you'd add
the following to the `entrypoints` key inside the `config` variable:

```typescript
// ...
entrypoints: {
  // ...
  tools: "tools/index",
},
// ...
```

If you're adding a new integration which requires installing a third party dependency, you must add the entrypoint to the `requiresOptionalDependency` array, also located inside `libs/langchain/langchain.config.js` or `libs/langchain-community/langchain.config.js`.

```typescript
// ...
requiresOptionalDependency: [
  // ...
  "tools/index",
],
// ...
```

This will make sure the entrypoint is included in the published package,
and in generated documentation.

## Advanced

**Environment tests** test whether LangChain works across different JS environments, including Node.js (both ESM and CJS), Edge environments (eg. Cloudflare Workers), and browsers (using Webpack).

To run the environment tests with Docker, run the following command from the project root:

```bash
pnpm test:exports:docker
```
