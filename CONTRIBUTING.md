# Contributing to LangChain

👋 Welcome! Thank you for your interest in contributing. LangChain has helped form the largest developer community in generative AI, and we're always open to new contributors. Whether you're fixing bugs, adding features, improving documentation, or sharing feedback, your involvement helps make LangChain and LangGraph better for everyone 🦜❤️

To contribute to this project, please follow a ["fork and pull request"](https://docs.github.com/en/get-started/quickstart/contributing-to-projects) workflow. Please do not try to push directly to this repo unless you are a maintainer.

## Ways to Contribute

### 🐛 Report Bugs

Found a bug? Please help us fix it by following these steps:

1. **Search**: Check if the issue already exists in our [GitHub Issues](https://github.com/langchain-ai/langchainjs/issues)
2. **Create issue**: If no issue exists, create a new one. When writing, be sure to follow the template provided and include a [minimal, reproducible example](https://stackoverflow.com/help/minimal-reproducible-example). Attach any relevant labels to the final issue once created.
3. **Wait**: A project maintainer will triage the issue and may ask for additional information. Please be patient as we manage a high volume of issues. Do not bump the issue unless you have new information to provide.

> **Note**: If a project maintainer is unable to reproduce the issue, it is unlikely to be addressed in a timely manner.

If you are adding an issue, please try to keep it focused on a single topic. If two issues are related, or blocking, please link them rather than combining them. For example: "This issue is blocked by #123 and related to #456."

### 💡 Request Features

Have an idea for a new feature or enhancement?

1. **Search**: Search the [issues](https://github.com/langchain-ai/langchainjs/issues) for existing feature requests
2. **Discuss**: If no requests exist, start a new discussion under the relevant category so that project maintainers and the community can provide feedback
3. **Describe**: Be sure to describe the use case and why it would be valuable to others. If possible, provide examples or mockups where applicable. Outline test cases that should pass.

### 📖 Improve Documentation

Documentation improvements are always welcome! We strive to keep our docs clear and comprehensive, and your perspective can make a big difference. See our [documentation contribution guide](https://docs.langchain.com/oss/javascript/contributing/documentation) for details.

### 🛠️ Contribute Code

With a large userbase, it can be hard for our small team to keep up with all the feature requests and bug fixes. If you have the skills and time, we would love your help!

- If you start working on an issue, please assign it to yourself or ask a maintainer to do so. This helps avoid duplicate work.
- If you are looking for something to work on, check out the issues labeled ["good first issue"](https://github.com/langchain-ai/langchainjs/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) or ["help wanted"](https://github.com/langchain-ai/langchainjs/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

### 🔌 Add an Integration

Integrations are a core component of LangChain. LangChain provides standard interfaces for several different components (language models, vector stores, etc) that are crucial when building LLM applications. Contributing an integration helps expand LangChain's ecosystem and makes your service discoverable to millions of developers.

**Why contribute an integration to LangChain?**

- **Discoverability**: LangChain is the most used framework for building LLM applications, with over 20 million monthly downloads.
- **Interoperability**: LangChain components expose a standard interface, allowing developers to easily swap them for each other. If you implement a LangChain integration, any developer using a different component will easily be able to swap yours in.
- **Best Practices**: Through their standard interface, LangChain components encourage and facilitate best practices (streaming, async, etc.) that improve developer experience and application performance.

See our dedicated [integration contribution guide](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) for specific details and patterns. You can also check out the [guides on extending LangChain.js](https://js.langchain.com/docs/how_to/#custom) in our docs.

#### Integration Packages

> **Important**: We no longer accept new integrations to the `@langchain/community` package. The package is already very crowded with many dependencies, and we want to keep it maintainable.

New integrations **must** be published as standalone packages. Here's how to contribute a new integration:

1. **Create your own repository** to distribute LangChain integrations (e.g., `https://github.com/yourname/langchain-yourservice`)
2. **Publish the package to npm** (e.g., `@yourname/langchain-yourservice` or `langchain-yourservice`)
3. **Let us know** by opening an issue or discussion so we can add it to the list of recommended integrations

## 📁 Project Structure

This is a monorepo managed with [pnpm workspaces](https://pnpm.io/workspaces) and [Turborepo](https://turbo.build/). Here's an overview of the main packages:

| Package                    | Path                                 | Description                                                      |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| `langchain`                | `libs/langchain`                     | Main LangChain package with agents, prompts, and orchestration   |
| `@langchain/core`          | `libs/langchain-core`                | Core abstractions and interfaces (base classes, runnables, etc.) |
| `@langchain/community`     | `libs/langchain-community`           | Community-maintained integrations                                |
| `@langchain/textsplitters` | `libs/langchain-textsplitters`       | Text splitting utilities                                         |
| `@langchain/openai`        | `libs/providers/langchain-openai`    | OpenAI integration                                               |
| `@langchain/anthropic`     | `libs/providers/langchain-anthropic` | Anthropic integration                                            |
| Other providers            | `libs/providers/langchain-*`         | First-party provider integrations                                |

## 📝 Pull Request Guidelines

When submitting a pull request:

1. **Fill out the PR template** - Describe what your PR does, why it's needed, and any relevant context
2. **Link related issues** - Use closing keywords like `Fixes #123` to automatically close issues when your PR is merged
3. **Keep PRs focused** - One feature or fix per PR makes review easier and faster
4. **Add tests** - Include unit tests for new functionality; integration tests for new external APIs
5. **Update documentation** - If your change affects public APIs, update the relevant docs
6. **Run checks locally** - Make sure `pnpm lint`, `pnpm format:check`, and `pnpm test` pass before pushing

### Review Process

- A maintainer will review your PR and may request changes
- Please respond to feedback in a timely manner
- Once approved, a maintainer will merge your PR

> **Tip**: If you'd like a shout-out on Twitter when your contribution is released, include your Twitter handle in the PR description!

## 💬 Communication

- **[LangChain Forum](https://forum.langchain.com)**: Connect with the community for technical questions, ideas, and feedback
- **[GitHub Issues](https://github.com/langchain-ai/langchainjs/issues)**: Bug reports and feature requests
- **[Slack](https://www.langchain.com/join-community)**: LangChain Community Slack

## 🙋 Getting Help

Although we try to have a developer setup to make it as easy as possible for others to contribute (see below), it is possible that some pain point may arise around environment setup, linting, documentation, or other.

Should that occur, please contact a maintainer! Not only do we want to help get you unblocked, but we also want to make sure that the process is smooth for future contributors.

In a similar vein, we do enforce certain linting, formatting, and documentation standards in the codebase. If you are finding these difficult (or even just annoying) to work with, feel free to contact a maintainer for help - we do not want these to get in the way of getting good code into the codebase.

## 🏭 Release Process

As of now, LangChain has an ad hoc release process: releases are cut with high frequency by a developer and published to [npm](https://www.npmjs.com/package/langchain).

If your contribution has made its way into a release, we will want to give you credit on Twitter (only if you want though)! If you have a Twitter account you would like us to mention, please let us know in the PR or in another manner.

### 🧪 Dev Releases

For testing unreleased changes, maintainers can publish dev releases of individual packages. Dev releases are published to npm with a special tag and version format that includes the git commit SHA.

**To create a dev release:**

1. Go to [Actions → 📦 Publish](https://github.com/langchain-ai/langchainjs/actions/workflows/release.yml)
2. Click "Run workflow"
3. Select the branch you want to release from (defaults to `main`, but you can choose your feature branch)
4. Optionally change the npm tag (defaults to `dev`)
5. Click "Run workflow"

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

## 🛠️ Tooling

This project uses the following tools, which are worth getting familiar with if you plan to contribute:

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

Our goal is to make it as easy as possible for you to contribute to this project. All commands can be run from the project root using `pnpm --filter <package>` to target specific workspaces.

Common package filters:

- `--filter langchain` - the main `langchain` package
- `--filter @langchain/core` - the core package
- `--filter @langchain/community` - community integrations
- `--filter @langchain/openai` - OpenAI integration (and similarly for other providers)

### Setup

**Prerequisite**: Node version v24.x is required. Please check node version `node -v` and update it if required.

To get started, install the dependencies for the project from the root:

```bash
pnpm install
```

Then, build the core package (required before working on other packages):

```bash
pnpm --filter @langchain/core build
```

### Linting

We use [eslint](https://eslint.org/) to enforce standard lint rules. To run the linter on a specific package:

```bash
pnpm --filter langchain lint
pnpm --filter @langchain/community lint
```

### Formatting

We use [prettier](https://prettier.io) to enforce code formatting style. To run the formatter:

```bash
pnpm --filter langchain format
```

To just check for formatting differences, without fixing them:

```bash
pnpm --filter langchain format:check
```

### Testing

In general, tests should be added within a `tests/` folder alongside the modules they are testing.

**Unit tests** cover modular logic that does not require calls to outside APIs.

If you add new logic, please add a unit test. Unit tests should be called `*.test.ts`.

To run unit tests for a specific package:

```bash
pnpm --filter langchain test
pnpm --filter @langchain/core test
```

**Integration tests** cover logic that requires making calls to outside APIs (often integration with other services).

If you add support for a new external API, please add a new integration test. Integration tests should be called `*.int.test.ts`.

Note that most integration tests require credentials or other setup. You will likely need to set up a `libs/langchain/.env` or `libs/langchain-community/.env` file based on the [`.env.example` file](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain/.env.example).

We generally recommend only running integration tests with `pnpm --filter <package> test:single`, but if you want to run all integration tests:

```bash
pnpm --filter langchain test:integration
```

#### Type Tests

We use type tests to verify that TypeScript types work correctly. Type tests are files ending in `.test-d.ts` and use `expectTypeOf` from vitest to assert type behavior.

```typescript
import { expectTypeOf } from "vitest";

expectTypeOf(someFunction).returns.toMatchTypeOf<ExpectedType>();
```

Type tests ensure that:

- Public APIs have correct type signatures
- Generic types resolve correctly
- Type inference works as expected

To run type tests along with unit tests:

```bash
pnpm --filter langchain test
```

Find more information on writing type tests in the [Vitest docs](https://vitest.dev/guide/testing-types.html).

### Building

To build a specific package:

```bash
pnpm --filter langchain build
pnpm --filter @langchain/core build
```

## Advanced

**Environment tests** test whether LangChain works across different JS environments, including Node.js (both ESM and CJS), Edge environments (eg. Cloudflare Workers), and browsers (using Webpack).

To run the environment tests with Docker, run the following command from the project root:

```bash
pnpm test:exports:docker
```
