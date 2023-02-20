# Contributing to LangChain

Hi there! Thank you for even being interested in contributing to LangChain.
As an open source project in a rapidly developing field, we are extremely open
to contributions, whether it be in the form of a new feature, improved infra, or better documentation.

To contribute to this project, please follow a ["fork and pull request"](https://docs.github.com/en/get-started/quickstart/contributing-to-projects) workflow.
Please do not try to push directly to this repo unless you are maintainer.

## 🗺️Contributing Guidelines

### 🚩GitHub Issues

Our [issues](https://github.com/hwchase17/langchainjs/issues) page is kept up to date
with bugs, improvements, and feature requests. There is a taxonomy of labels to help
with sorting and discovery of issues of interest. These include:

- prompts: related to prompt tooling/infra.
- llms: related to LLM wrappers/tooling/infra.
- chains
- utilities: related to different types of utilities to integrate with (Python, SQL, etc.).
- agents
- memory
- applications: related to example applications to build

If you start working on an issue, please assign it to yourself.

If you are adding an issue, please try to keep it focused on a single modular bug/improvement/feature.
If the two issues are related, or blocking, please link them rather than keep them as one single one.

We will try to keep these issues as up to date as possible, though
with the rapid rate of develop in this field some may get out of date.
If you notice this happening, please just let us know.

### 🙋Getting Help

Although we try to have a developer setup to make it as easy as possible for others to contribute (see below)
it is possible that some pain point may arise around environment setup, linting, documentation, or other.
Should that occur, please contact a maintainer! Not only do we want to help get you unblocked,
but we also want to make sure that the process is smooth for future contributors.

In a similar vein, we do enforce certain linting, formatting, and documentation standards in the codebase.
If you are finding these difficult (or even just annoying) to work with,
feel free to contact a maintainer for help - we do not want these to get in the way of getting
good code into the codebase.

### 🏭Release process

# TODO:

As of now, LangChain has an ad hoc release process: releases are cut with high frequency via by
a developer and published to [npm](https://www.npmjs.com/package/langchain).

LangChain follows the [semver](https://semver.org/) versioning standard. However, as pre-1.0 software,
even patch releases may contain [non-backwards-compatible changes](https://semver.org/#spec-item-4).

If your contribution has made its way into a release, we will want to give you credit on Twitter (only if you want though)!
If you have a Twitter account you would like us to mention, please let us know in the PR or in another manner.

## 🚀Quick Start

### Tooling

This project uses the following tools, which are worth getting familiar
with if you plan to contribute:

- **[yarn](https://yarnpkg.com/) (v3.4.1)** - dependency management
- **[eslint](https://eslint.org/)** - enforcing standard lint rules
- **[prettier](https://prettier.io/)** - enforcing standard code formatting
- **[jest](https://jestjs.io/)** - testing code
- **[TypeDoc](https://typedoc.org/)** - reference doc generation from
  comments
- **[Docusaurus](https://docusaurus.io/)** - static site generation for documentation

Now, you should be able to run the common tasks in the following section.

## ✅Common Tasks

### Testing

Tests should be added within a `tests/` folder alongside the modules they
are testing.

**Unit tests** cover modular logic that does not require calls to outside APIs.

If you add new logic, please add a unit test.
Unit tests should be called `*.test.ts`.

**Integration tests** cover logic that requires making calls to outside APIs (often integration with other services).

If you add support for a new external API, please add a new integration test.
Integration tests should be called `*.int.test.ts`.

To run tests, run:

```bash
yarn test
```

### Running examples

If you add a new major piece of functionality, it is helpful to add an
example to showcase how to use it. Most of our users find examples to be the
most helpful kind of documentation.

Examples can be added in the `examples/src` directory, e.g.
`examples/src/path/to/example` and should export a `run` function. This
example can then be invoked with `yarn example path/to/example` at the top
level of the repo.

### Adding an Entrypoint

Langchain let's user import from multiple subpaths, e.g.

```ts
import { OpenAI } from "langchain/llms";
```

In order to declare a new entrypoint that users can import from, you
should edit the `langchain/create-entrypoints.js` script. To add an
entrypoint `tools` that imports from `agents/tools/index.ts` you could add
the following to the `entrypoints` variable:

```ts
const entrypoints = {
  // ...
  tools: "agents/tools/index.ts",
};
```

This will make sure the entrypoint is included in the published package,
and in generated documentation.

## Documentation

### Contribute Documentation

Docs are largely autogenerated by [TypeDoc](https://typedoc.org/) from the code.

For that reason, we ask that you add good documentation to all classes and methods.

Similar to linting, we recognize documentation can be annoying. If you do not want to do it, please contact a project maintainer, and they can help you with it. We do not want this to be a blocker for good code getting contributed.

### Build Documentation Locally

You can run a hot-reloading dev version of the docs static site by
running:

```bash
cd docs && yarn start
```
