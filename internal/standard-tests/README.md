# LangChain.js Standard Tests

This package contains the base standard tests for LangChain.js. It includes unit, and integration test classes.
This package is not intended to be used outside of the LangChain.js project, and thus it is not published to npm.

At the moment, we only have support for standard tests for chat models.

## Usage

Each LangChain.js integration should contain both unit and integration standard tests.
The package should have `@langchain/standard-tests` as a dev workspace dependency like so:

`package.json`:

```json
{
  "devDependencies": {
    "@langchain/standard-tests": "workspace:*"
  }
}
```

To use the standard tests, you could create two files:

- `src/tests/chat_models.standard.test.ts` - chat model unit tests
- `src/tests/chat_models.standard.int.test.ts` - chat model integration tests

Your unit test file should look like this:

`chat_models.standard.test.ts`:

```typescript
/* eslint-disable no-process-env */
import { test, expect } from "@jest/globals";
import { ChatModelUnitTests } from "@langchain/standard-tests";
import { AIMessageChunk } from "@langchain/core/messages";
import { MyChatModel, MyChatModelCallOptions } from "../chat_models.js";

class MyChatModelStandardUnitTests extends ChatModelUnitTests<
  MyChatModelCallOptions,
  AIMessageChunk
> {
  constructor() {
    super({
      Cls: MyChatModel,
      chatModelHasToolCalling: true, // Set to true if the model has tool calling support
      chatModelHasStructuredOutput: true, // Set to true if the model has withStructuredOutput support
      constructorArgs: {}, // Any additional constructor args
    });
    // This must be set so method like `.bindTools` or `.withStructuredOutput`
    // which we call after instantiating the model will work.
    // (constructor will throw if API key is not set)
    process.env.CHAT_MODEL_API_KEY = "test";
  }

  testChatModelInitApiKey() {
    // Unset the API key env var here so this test can properly check
    // the API key class arg.
    process.env.CHAT_MODEL_API_KEY = "";
    super.testChatModelInitApiKey();
    // Re-set the API key env var here so other tests can run properly.
    process.env.CHAT_MODEL_API_KEY = "test";
  }
}

const testClass = new MyChatModelStandardUnitTests();

test("MyChatModelStandardUnitTests", () => {
  const testResults = testClass.runTests();
  expect(testResults).toBe(true);
});
```

To use the standard tests, extend the `ChatModelUnitTests` class, passing in your chat model's call options and message chunk types. Super the constructor with your chat model class, any additional constructor args, and set the `chatModelHasToolCalling` and `chatModelHasStructuredOutput` flags if supported.

Set the model env var in the constructor directly to `process.env` for the tests to run properly. You can optionally override test methods to replace or add code before/after the test runs.

Run all tests by calling `.runTests()`, which returns `true` if all tests pass, `false` otherwise. Tests are called in `try`/`catch` blocks so that failing tests are caught and marked as failed, but the rest still run.

For integration tests, extend `ChatModelIntegrationTests` instead. Integration tests have an optional arg for all methods (except `withStructuredOutput`) to pass in "invoke" time call options. For example, in the OpenAI integration test:

```typescript
async testUsageMetadataStreaming() {
  // ChatOpenAI does not support streaming tokens by
  // default, so we must pass in a call option to
  // enable streaming tokens.
  const callOptions: ChatOpenAI["ParsedCallOptions"] = {
    stream_options: {
      include_usage: true,
    },
  };
  await super.testUsageMetadataStreaming(callOptions);
}
```

This overrides the base `testUsageMetadataStreaming` to pass a `callOptions` arg enabling streaming tokens.
