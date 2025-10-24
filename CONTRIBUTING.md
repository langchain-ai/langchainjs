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

LangChain supports several different types of integrations with third-party providers and frameworks, including LLM providers (e.g. [OpenAI](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-openai/src/chat_models.ts)), vector stores (e.g. [FAISS](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community/src/vectorstores/faiss.ts), document loaders (e.g. [Apify](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community/src/document_loaders/web/apify_dataset.ts)) persistent message history stores (e.g. [Redis](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-redis/src/caches.ts)), and more.

We welcome such contributions, but ask that you read our dedicated [integration contribution guide](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) for specific details and patterns to consider before opening a pull request.

You can also check out the [guides on extending LangChain.js](https://js.langchain.com/docs/how_to/#custom) in our docs.

#### Integration packages

Integrations should generally reside in the `libs/langchain-community` workspace and be imported as `@langchain/community/module/name`. More in-depth integrations or suites of integrations may also reside in separate packages that depend on and extend `@langchain/core`. See [`@langchain/google-genai`](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-google-genai) for an example.

To make creating packages like this easier, we offer the [`create-langchain-integration`](https://github.com/langchain-ai/langchainjs/blob/main/libs/create-langchain-integration/) utility that will automatically scaffold a repo with support for both ESM + CJS entrypoints. You can run it like this:

```bash
npx create-langchain-integration
```

After creating the new integration package, you should add it to the [`unit-tests-integrations.yml`](./.github/workflows/unit-tests-integrations.yml) GitHub action workflow so that it is tested in CI. To do this,simply update the `env` section of the `prepare-matrix` job with your package name inside the `PACKAGES` variable:

```yaml
prepare-matrix:
  needs: get-changed-files
  runs-on: ubuntu-latest
  env:
    PACKAGES: "anthropic,azure-openai,cloudflare,<your-package>"
    ...
```

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

LangChain follows the [semver](https://semver.org/) versioning standard. However, as pre-1.0 software,
even patch releases may contain [non-backwards-compatible changes](https://semver.org/#spec-item-4).

If your contribution has made its way into a release, we will want to give you credit on Twitter (only if you want though)!
If you have a Twitter account you would like us to mention, please let us know in the PR or in another manner.

#### Integration releases

The release script can be executed only while on a fresh `main` branch, with no un-committed changes, from the package root. If working from a fork of the repository, make sure to sync the forked `main` branch with the upstream `main` branch first.

You can invoke the script by calling `yarn release`. If new dependencies have been added to the integration package, install them first (i.e. run `yarn`, then `yarn release`).

There are three parameters which can be passed to this script, one required and two optional.

- **Required**: `<workspace name>`. eg: `@langchain/core` The name of the package to release. Can be found in the `name` value of the package's `package.json`
- **Optional**: `--bump-deps` eg `--bump-deps` Will find all packages in the repo which depend on this workspace and checkout a new branch, update the dep version, run yarn install, commit & push to new branch. Generally, this is not necessary.
- **Optional**: `--tag <tag>` eg `--tag beta` Add a tag to the NPM release. Useful if you want to push a release candidate.

This script automatically bumps the package version, creates a new release branch with the changes, pushes the branch to GitHub, uses `release-it` to automatically release to NPM, and more depending on the flags passed.

Halfway through this script, you'll be prompted to enter an NPM OTP (typically from an authenticator app). This value is not stored anywhere and is only used to authenticate the NPM release.

> **Note** Unless releasing `langchain`, `no` should be answered to all prompts following `Publish @langchain/<package> to npm?`. Then, the change should be manually committed with the following commit message: `<package>[patch]: Release <new version>`. E.g.: `groq[patch]: Release 0.0.1`.

Docker must be running if releasing one of `langchain`, `@langchain/core` or `@langchain/community`. These packages run LangChain's export tests, which run inside docker containers.

Full example: `yarn release @langchain/core`.

### 🛠️ Tooling

This project uses the following tools, which are worth getting familiar
with if you plan to contribute:

- **[yarn](https://yarnpkg.com/) (v3.4.1)** - dependency management
- **[eslint](https://eslint.org/)** - enforcing standard lint rules
- **[prettier](https://prettier.io/)** - enforcing standard code formatting
- **[jest](https://jestjs.io/)** - testing code
- **[TypeDoc](https://typedoc.org/)** - reference doc generation from
  comments
- **[Docusaurus](https://docusaurus.io/)** - static site generation for documentation

## 🚀 Quick Start

Clone this repo, then cd into it:

```bash
cd langchainjs
```

Next, try running the following common tasks:

## ✅ Common Tasks

Our goal is to make it as easy as possible for you to contribute to this project.
All of the below commands should be run from within a workspace directory (e.g. `langchain`, `libs/langchain-community`) unless otherwise noted.

```bash
cd langchain
```

Or, if you are working on a community integration:

```bash
cd libs/langchain-community
```

### Setup

**Prerequisite**: Node version 18+ is required. Please check node version `node -v` and update it if required.

To get started, you will need to install the dependencies for the project. To do so, run:

```bash
yarn
```

Then, you will need to switch directories into `langchain-core` and build core by running:

```bash
cd ../../langchain-core
yarn
yarn build
```

### Linting

We use [eslint](https://eslint.org/) to enforce standard lint rules.
To run the linter, run:

```bash
yarn lint
```

### Formatting

We use [prettier](https://prettier.io) to enforce code formatting style.
To run the formatter, run:

```bash
yarn format
```

To just check for formatting differences, without fixing them, run:

```bash
yarn format:check
```

### Testing

In general, tests should be added within a `tests/` folder alongside the modules they
are testing.

**Unit tests** cover modular logic that does not require calls to outside APIs.

If you add new logic, please add a unit test.
Unit tests should be called `*.test.ts`.

To run only unit tests, run:

```bash
yarn test
```

#### Running a single test

To run a single test, run the following from within a workspace:

```bash
yarn test:single /path/to/yourtest.test.ts
```

This is useful for developing individual features.

**Integration tests** cover logic that requires making calls to outside APIs (often integration with other services).

If you add support for a new external API, please add a new integration test.
Integration tests should be called `*.int.test.ts`.

Note that most integration tests require credentials or other setup. You will likely need to set up a `langchain/.env` or `libs/langchain-community/.env` file
like the example [here](https://github.com/langchain-ai/langchainjs/blob/main/langchain/.env.example).

We generally recommend only running integration tests with `yarn test:single`, but if you want to run all integration tests, run:

```bash
yarn test:integration
```

### Building

To build the project, run:

```bash
yarn build
```

### Adding an Entrypoint

LangChain exposes multiple subpaths the user can import from, e.g.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

We call these subpaths "entrypoints". In general, you should create a new entrypoint if you are adding a new integration with a 3rd party library. If you're adding self-contained functionality without any external dependencies, you can add it to an existing entrypoint.

In order to declare a new entrypoint that users can import from, you
should edit the `langchain/langchain.config.js` or `libs/langchain-community/langchain.config.js` file. To add an
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

If you're adding a new integration which requires installing a third party dependency, you must add the entrypoint to the `requiresOptionalDependency` array, also located inside `langchain/langchain.config.js` or `libs/langchain-community/langchain.config.js`.

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

## Documentation

### Contribute Documentation

#### Install dependencies

##### Note: you only need to follow these steps if you are building the docs site locally

1. [Quarto](https://quarto.org/) - package that converts Jupyter notebooks (`.ipynb` files) into `.mdx` files for serving in Docusaurus.
2. `yarn build --filter=core_docs` - It's as simple as that! (or you can simply run `yarn build` from `docs/core_docs/`)

All notebooks are converted to `.md` files and automatically gitignored. If you would like to create a non notebook doc, it must be a `.mdx` file.

### Writing Notebooks

When adding new dependencies inside the notebook you must update the import map inside `deno.json` in the root of the LangChain repo.

This is required because the notebooks use the Deno runtime, and Deno formats imports differently than Node.js.

Example:

```typescript
// Import in Node:
import { z } from "zod";
// Import in Deno:
import { z } from "npm:/zod";
```

See examples inside `deno.json` for more details.

Docs are largely autogenerated by [TypeDoc](https://typedoc.org/) from the code.

For that reason, we ask that you add good documentation to all classes and methods.

Similar to linting, we recognize documentation can be annoying. If you do not want to do it, please contact a project maintainer, and they can help you with it. We do not want this to be a blocker for good code getting contributed.

Documentation and the skeleton lives under the `docs/` folder. Example code is imported from under the `examples/` folder.

**If you are contributing an integration, please copy and use the appropriate template from here:**

<https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-scripts/src/cli/docs/templates>

### Running examples

If you add a new major piece of functionality, it is helpful to add an
example to showcase how to use it. Most of our users find examples to be the
most helpful kind of documentation.

Examples can be added in the `examples/src` directory, e.g.
`examples/src/path/to/example`. This
example can then be invoked with `yarn example path/to/example` at the top
level of the repo.

To run examples that require an environment variable, you'll need to add a `.env` file under `examples/.env`.

### Build Documentation Locally

To generate and view the documentation locally, change to the project root and run `yarn` to ensure dependencies get installed
in both the `docs/` and `examples/` workspaces:

```bash
cd ..
yarn
```

Then run:

```bash
yarn docs
```

## Advanced

**Environment tests** test whether LangChain works across different JS environments, including Node.js (both ESM and CJS), Edge environments (eg. Cloudflare Workers), and browsers (using Webpack).

To run the environment tests with Docker, run the following command from the project root:

```bash
yarn test:exports:docker
```
