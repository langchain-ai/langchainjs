/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, jest } from "@jest/globals";
import { AIMessage, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { InMemoryCache } from "@langchain/core/caches";
import { ChatOpenAI } from "../chat_models.js";

test("Test ChatOpenAI JSON mode", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).bind({
    response_format: {
      type: "json_object",
    },
  });
  const message = new HumanMessage("Hello!");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const res = await chat.invoke([["system", "Only return JSON"], message]);
  // console.log(JSON.stringify(res));
});

test("Test ChatOpenAI seed", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    temperature: 1,
  }).bind({
    seed: 123454930394983,
  });
  const message = new HumanMessage("Say something random!");

  const res = await chat.invoke([message]);

  const res2 = await chat.invoke([message]);

  expect(res.response_metadata.system_fingerprint).toBeDefined();
  expect(res2.response_metadata.system_fingerprint).toBeDefined();

  // These are unfortunately not consistently the same
  delete res.response_metadata.system_fingerprint;
  delete res2.response_metadata.system_fingerprint;

  const resAsObject = {
    ...res,
    id: undefined,
    lc_kwargs: { ...res.lc_kwargs, id: undefined },
  };
  const res2AsObject = {
    ...res2,
    id: undefined,
    lc_kwargs: { ...res2.lc_kwargs, id: undefined },
  };
  expect(resAsObject).toEqual(res2AsObject);
});

test("Test ChatOpenAI tool calling", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const res = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toEqual(3);
  expect(res.tool_calls?.[0].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[0].function.arguments ?? "{}")
  );
  expect(res.tool_calls?.[1].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[1].function.arguments ?? "{}")
  );
  expect(res.tool_calls?.[2].args).toEqual(
    JSON.parse(res.additional_kwargs.tool_calls?.[2].function.arguments ?? "{}")
  );
});

test("Test ChatOpenAI streaming logprobs", async () => {
  const model = new ChatOpenAI({
    maxTokens: 50,
    modelName: "gpt-3.5-turbo",
    streaming: true,
    logprobs: true,
  });
  const res = await model.invoke("Print hello world.");
  // console.log(res.response_metadata.logprobs.content);
  expect(res.response_metadata.logprobs.content.length).toBeGreaterThan(0);
});

test("Test ChatOpenAI tool calling with ToolMessages", async () => {
  function getCurrentWeather(location: string) {
    if (location.toLowerCase().includes("tokyo")) {
      return JSON.stringify({ location, temperature: "10", unit: "celsius" });
    } else if (location.toLowerCase().includes("san francisco")) {
      return JSON.stringify({
        location,
        temperature: "72",
        unit: "fahrenheit",
      });
    } else {
      return JSON.stringify({ location, temperature: "22", unit: "celsius" });
    }
  }
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const res = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  // console.log(JSON.stringify(res));
  expect(res.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const toolMessages = res.additional_kwargs.tool_calls!.map(
    (toolCall) =>
      new ToolMessage({
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: getCurrentWeather(
          JSON.parse(toolCall.function.arguments).location
        ),
      })
  );
  let toolError;
  try {
    await chat.invoke([
      ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
      res,
    ]);
  } catch (e) {
    toolError = e;
  }
  expect(toolError).toBeDefined();
  expect((toolError as any)?.lc_error_code).toEqual("INVALID_TOOL_RESULTS");
  // @eslint-disable-next-line/@typescript-eslint/ban-ts-comment
  // @ts-expect-error unused var
  const finalResponse = await chat.invoke([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
    res,
    ...toolMessages,
  ]);
  // console.log(finalResponse);
});

test("Test ChatOpenAI tool calling with streaming", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 256,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const stream = await chat.stream([
    ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
  ]);
  let finalChunk;
  const chunks = [];
  for await (const chunk of stream) {
    // console.log(chunk.additional_kwargs.tool_calls);
    chunks.push(chunk);
    if (!finalChunk) {
      finalChunk = chunk;
    } else {
      finalChunk = finalChunk.concat(chunk);
    }
  }
  expect(chunks.length).toBeGreaterThan(1);
  // console.log(finalChunk?.additional_kwargs.tool_calls);
  expect(finalChunk?.additional_kwargs.tool_calls?.length).toBeGreaterThan(1);
});

test("ChatOpenAI in JSON mode can cache generations", async () => {
  const memoryCache = new InMemoryCache();
  const lookupSpy = jest.spyOn(memoryCache, "lookup");
  const updateSpy = jest.spyOn(memoryCache, "update");
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 1,
    cache: memoryCache,
  }).bind({
    response_format: {
      type: "json_object",
    },
  });
  const message = new HumanMessage(
    "Respond with a JSON object containing arbitrary fields."
  );
  const res = await chat.invoke([message]);
  // console.log(res);

  const res2 = await chat.invoke([message]);
  // console.log(res2);

  expect(res).toEqual(res2);

  expect(lookupSpy).toHaveBeenCalledTimes(2);
  expect(updateSpy).toHaveBeenCalledTimes(1);

  lookupSpy.mockRestore();
  updateSpy.mockRestore();
});

test("Few shotting with tool calls", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    temperature: 1,
  }).bind({
    tools: [
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA",
              },
              unit: { type: "string", enum: ["celsius", "fahrenheit"] },
            },
            required: ["location"],
          },
        },
      },
    ],
    tool_choice: "auto",
  });
  const res = await chat.invoke([
    new HumanMessage("What is the weather in SF?"),
    new AIMessage({
      content: "",
      tool_calls: [
        {
          id: "12345",
          name: "get_current_weather",
          args: {
            location: "SF",
          },
        },
      ],
    }),
    new ToolMessage({
      tool_call_id: "12345",
      content: "It is currently 24 degrees with hail in SF.",
    }),
    new AIMessage("It is currently 24 degrees in SF with hail in SF."),
    new HumanMessage("What did you say the weather was?"),
  ]);
  // console.log(res);
  expect(res.content).toContain("24");
});

test("Test ChatOpenAI with raw response", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    __includeRawResponse: true,
  });
  const message = new HumanMessage("Hello!");
  const res = await chat.invoke([message]);
  expect(res.additional_kwargs.__raw_response).toBeDefined();
});

test("Test ChatOpenAI with raw response", async () => {
  const chat = new ChatOpenAI({
    modelName: "gpt-3.5-turbo-1106",
    maxTokens: 128,
    __includeRawResponse: true,
  });
  const message = new HumanMessage("Hello!");
  const stream = await chat.stream([message]);
  for await (const chunk of stream) {
    expect(
      chunk.additional_kwargs.__raw_response || chunk.usage_metadata
    ).toBeDefined();
  }
});

const CACHED_TEXT = `## Components

LangChain provides standard, extendable interfaces and external integrations for various components useful for building with LLMs.
Some components LangChain implements, some components we rely on third-party integrations for, and others are a mix.

### Chat models

<span data-heading-keywords="chat model,chat models"></span>

Language models that use a sequence of messages as inputs and return chat messages as outputs (as opposed to using plain text).
These are generally newer models (older models are generally \`LLMs\`, see below).
Chat models support the assignment of distinct roles to conversation messages, helping to distinguish messages from the AI, users, and instructions such as system messages.

Although the underlying models are messages in, message out, the LangChain wrappers also allow these models to take a string as input.
This gives them the same interface as LLMs (and simpler to use).
When a string is passed in as input, it will be converted to a \`HumanMessage\` under the hood before being passed to the underlying model.

LangChain does not host any Chat Models, rather we rely on third party integrations.

We have some standardized parameters when constructing ChatModels:

- \`model\`: the name of the model

Chat Models also accept other parameters that are specific to that integration.

:::important
Some chat models have been fine-tuned for **tool calling** and provide a dedicated API for it.
Generally, such models are better at tool calling than non-fine-tuned models, and are recommended for use cases that require tool calling.
Please see the [tool calling section](/docs/concepts/#functiontool-calling) for more information.
:::

For specifics on how to use chat models, see the [relevant how-to guides here](/docs/how_to/#chat-models).

#### Multimodality

Some chat models are multimodal, accepting images, audio and even video as inputs.
These are still less common, meaning model providers haven't standardized on the "best" way to define the API.
Multimodal outputs are even less common. As such, we've kept our multimodal abstractions fairly light weight
and plan to further solidify the multimodal APIs and interaction patterns as the field matures.

In LangChain, most chat models that support multimodal inputs also accept those values in OpenAI's content blocks format.
So far this is restricted to image inputs. For models like Gemini which support video and other bytes input, the APIs also support the native, model-specific representations.

For specifics on how to use multimodal models, see the [relevant how-to guides here](/docs/how_to/#multimodal).

### LLMs

<span data-heading-keywords="llm,llms"></span>

:::caution
Pure text-in/text-out LLMs tend to be older or lower-level. Many popular models are best used as [chat completion models](/docs/concepts/#chat-models),
even for non-chat use cases.

You are probably looking for [the section above instead](/docs/concepts/#chat-models).
:::

Language models that takes a string as input and returns a string.
These are traditionally older models (newer models generally are [Chat Models](/docs/concepts/#chat-models), see above).

Although the underlying models are string in, string out, the LangChain wrappers also allow these models to take messages as input.
This gives them the same interface as [Chat Models](/docs/concepts/#chat-models).
When messages are passed in as input, they will be formatted into a string under the hood before being passed to the underlying model.

LangChain does not host any LLMs, rather we rely on third party integrations.

For specifics on how to use LLMs, see the [relevant how-to guides here](/docs/how_to/#llms).

### Message types

Some language models take an array of messages as input and return a message.
There are a few different types of messages.
All messages have a \`role\`, \`content\`, and \`response_metadata\` property.

The \`role\` describes WHO is saying the message.
LangChain has different message classes for different roles.

The \`content\` property describes the content of the message.
This can be a few different things:

- A string (most models deal this type of content)
- A List of objects (this is used for multi-modal input, where the object contains information about that input type and that input location)

#### HumanMessage

This represents a message from the user.

#### AIMessage

This represents a message from the model. In addition to the \`content\` property, these messages also have:

**\`response_metadata\`**

The \`response_metadata\` property contains additional metadata about the response. The data here is often specific to each model provider.
This is where information like log-probs and token usage may be stored.

**\`tool_calls\`**

These represent a decision from an language model to call a tool. They are included as part of an \`AIMessage\` output.
They can be accessed from there with the \`.tool_calls\` property.

This property returns a list of \`ToolCall\`s. A \`ToolCall\` is an object with the following arguments:

- \`name\`: The name of the tool that should be called.
- \`args\`: The arguments to that tool.
- \`id\`: The id of that tool call.

#### SystemMessage

This represents a system message, which tells the model how to behave. Not every model provider supports this.

#### ToolMessage

This represents the result of a tool call. In addition to \`role\` and \`content\`, this message has:

- a \`tool_call_id\` field which conveys the id of the call to the tool that was called to produce this result.
- an \`artifact\` field which can be used to pass along arbitrary artifacts of the tool execution which are useful to track but which should not be sent to the model.

#### (Legacy) FunctionMessage

This is a legacy message type, corresponding to OpenAI's legacy function-calling API. \`ToolMessage\` should be used instead to correspond to the updated tool-calling API.

This represents the result of a function call. In addition to \`role\` and \`content\`, this message has a \`name\` parameter which conveys the name of the function that was called to produce this result.

### Prompt templates

<span data-heading-keywords="prompt,prompttemplate,chatprompttemplate"></span>

Prompt templates help to translate user input and parameters into instructions for a language model.
This can be used to guide a model's response, helping it understand the context and generate relevant and coherent language-based output.

Prompt Templates take as input an object, where each key represents a variable in the prompt template to fill in.

Prompt Templates output a PromptValue. This PromptValue can be passed to an LLM or a ChatModel, and can also be cast to a string or an array of messages.
The reason this PromptValue exists is to make it easy to switch between strings and messages.

There are a few different types of prompt templates:

#### String PromptTemplates

These prompt templates are used to format a single string, and generally are used for simpler inputs.
For example, a common way to construct and use a PromptTemplate is as follows:

\`\`\`typescript
import { PromptTemplate } from "@langchain/core/prompts";

const promptTemplate = PromptTemplate.fromTemplate(
  "Tell me a joke about {topic}"
);

await promptTemplate.invoke({ topic: "cats" });
\`\`\`

#### ChatPromptTemplates

These prompt templates are used to format an array of messages. These "templates" consist of an array of templates themselves.
For example, a common way to construct and use a ChatPromptTemplate is as follows:

\`\`\`typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["user", "Tell me a joke about {topic}"],
]);

await promptTemplate.invoke({ topic: "cats" });
\`\`\`

In the above example, this ChatPromptTemplate will construct two messages when called.
The first is a system message, that has no variables to format.
The second is a HumanMessage, and will be formatted by the \`topic\` variable the user passes in.

#### MessagesPlaceholder

<span data-heading-keywords="messagesplaceholder"></span>

This prompt template is responsible for adding an array of messages in a particular place.
In the above ChatPromptTemplate, we saw how we could format two messages, each one a string.
But what if we wanted the user to pass in an array of messages that we would slot into a particular spot?
This is how you use MessagesPlaceholder.

\`\`\`typescript
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";

const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  new MessagesPlaceholder("msgs"),
]);

promptTemplate.invoke({ msgs: [new HumanMessage({ content: "hi!" })] });
\`\`\`

This will produce an array of two messages, the first one being a system message, and the second one being the HumanMessage we passed in.
If we had passed in 5 messages, then it would have produced 6 messages in total (the system message plus the 5 passed in).
This is useful for letting an array of messages be slotted into a particular spot.

An alternative way to accomplish the same thing without using the \`MessagesPlaceholder\` class explicitly is:

\`\`\`typescript
const promptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant"],
  ["placeholder", "{msgs}"], // <-- This is the changed part
]);
\`\`\`

For specifics on how to use prompt templates, see the [relevant how-to guides here](/docs/how_to/#prompt-templates).

### Example Selectors

One common prompting technique for achieving better performance is to include examples as part of the prompt.
This gives the language model concrete examples of how it should behave.
Sometimes these examples are hardcoded into the prompt, but for more advanced situations it may be nice to dynamically select them.
Example Selectors are classes responsible for selecting and then formatting examples into prompts.

For specifics on how to use example selectors, see the [relevant how-to guides here](/docs/how_to/#example-selectors).

### Output parsers

<span data-heading-keywords="output parser"></span>

:::note

The information here refers to parsers that take a text output from a model try to parse it into a more structured representation.
More and more models are supporting function (or tool) calling, which handles this automatically.
It is recommended to use function/tool calling rather than output parsing.
See documentation for that [here](/docs/concepts/#function-tool-calling).

:::

Responsible for taking the output of a model and transforming it to a more suitable format for downstream tasks.
Useful when you are using LLMs to generate structured data, or to normalize output from chat models and LLMs.

There are two main methods an output parser must implement:

- "Get format instructions": A method which returns a string containing instructions for how the output of a language model should be formatted.
- "Parse": A method which takes in a string (assumed to be the response from a language model) and parses it into some structure.

And then one optional one:

- "Parse with prompt": A method which takes in a string (assumed to be the response from a language model) and a prompt (assumed to be the prompt that generated such a response) and parses it into some structure. The prompt is largely provided in the event the OutputParser wants to retry or fix the output in some way, and needs information from the prompt to do so.

Output parsers accept a string or \`BaseMessage\` as input and can return an arbitrary type.

LangChain has many different types of output parsers. This is a list of output parsers LangChain supports. The table below has various pieces of information:

**Name**: The name of the output parser

**Supports Streaming**: Whether the output parser supports streaming.

**Input Type**: Expected input type. Most output parsers work on both strings and messages, but some (like OpenAI Functions) need a message with specific arguments.

**Output Type**: The output type of the object returned by the parser.

**Description**: Our commentary on this output parser and when to use it.

The current date is ${new Date().toISOString()}`;

test.skip("system prompt caching", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini-2024-07-18",
  });
  const date = new Date().toISOString();
  const messages = [
    {
      role: "system",
      content: `You are a pirate. Always respond in pirate dialect. The current date is ${date}.\nUse the following as context when answering questions: ${CACHED_TEXT}`,
    },
    {
      role: "user",
      content: "What types of messages are supported in LangChain?",
    },
  ];
  const res = await model.invoke(messages);
  expect(res.response_metadata?.usage.prompt_tokens_details.cached_tokens).toBe(
    0
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));
  const res2 = await model.invoke(messages);
  expect(
    res2.response_metadata?.usage.prompt_tokens_details.cached_tokens
  ).toBeGreaterThan(0);
  let aggregate;
  for await (const chunk of await model.stream(messages)) {
    aggregate = aggregate ? concat(aggregate, chunk) : chunk;
  }
  expect(
    aggregate?.response_metadata?.usage.prompt_tokens_details.cached_tokens
  ).toBeGreaterThan(0);
});

test("predicted output", async () => {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
  });
  const code = `
/// <summary>
/// Represents a user with a first name, last name, and username.
/// </summary>
public class User
{
    /// <summary>
    /// Gets or sets the user's first name.
    /// </summary>
    public string FirstName { get; set; }

    /// <summary>
    /// Gets or sets the user's last name.
    /// </summary>
    public string LastName { get; set; }

    /// <summary>
    /// Gets or sets the user's username.
    /// </summary>
    public string Username { get; set; }
}
`;
  const res = await model.invoke(
    [
      {
        role: "user",
        content:
          "Replace the Username property with an Email property. Respond only with code, and with no markdown formatting.",
      },
      {
        role: "user",
        content: code,
      },
    ],
    {
      prediction: {
        type: "content",
        content: code,
      },
    }
  );
  expect(
    typeof res.response_metadata?.usage?.completion_tokens_details
      .accepted_prediction_tokens
  ).toBe("number");
  expect(
    typeof res.response_metadata?.usage?.completion_tokens_details
      .rejected_prediction_tokens
  ).toBe("number");
});
