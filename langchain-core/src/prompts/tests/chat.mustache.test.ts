import { test, expect } from "@jest/globals";
import { AIMessage } from "../../messages/ai.js";
import { HumanMessage } from "../../messages/human.js";
import { SystemMessage } from "../../messages/system.js";
import { ChatPromptTemplate, HumanMessagePromptTemplate } from "../chat.js";
import { load } from "../../load/index.js";

test("Test creating a chat prompt template from role string messages", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      ["system", "You are a helpful AI bot. Your name is {{name}}."],
      ["human", "Hello, how are you doing?"],
      ["ai", "I'm doing well, thanks!"],
      ["human", "{{userInput}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    userInput: "What is your name?",
  });

  expect(messages).toEqual([
    new SystemMessage({
      content: "You are a helpful AI bot. Your name is Bob.",
    }),
    new HumanMessage({
      content: "Hello, how are you doing?",
    }),
    new AIMessage({
      content: "I'm doing well, thanks!",
    }),
    new HumanMessage({
      content: "What is your name?",
    }),
  ]);
});

test("Multiple input variables with repeats.", async () => {
  const template = "This {{bar}} is a {{foo}} test {{foo}}.";
  const prompt = ChatPromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  expect(prompt.inputVariables).toEqual(["bar", "foo"]);
  const formattedPrompt = await prompt.formatPromptValue({
    bar: "baz",
    foo: "bar",
  });
  expect(formattedPrompt.toChatMessages()).toEqual([
    new HumanMessage("This baz is a bar test bar."),
  ]);
});

test("Ignores f-string inputs input variables with repeats.", async () => {
  const template = "This {bar} is a {foo} test {foo}.";
  const prompt = ChatPromptTemplate.fromTemplate(template, {
    templateFormat: "mustache",
  });
  expect(prompt.inputVariables).toEqual([]);
  const formattedPrompt = await prompt.formatPromptValue({
    bar: "baz",
    foo: "bar",
  });
  expect(formattedPrompt.toChatMessages()).toEqual([
    new HumanMessage("This {bar} is a {foo} test {foo}."),
  ]);
});

test("Mustache template with image and chat prompts inside one template (fromMessages)", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      [
        "human",
        [
          {
            type: "image_url",
            image_url: "{{image_url}}",
          },
          {
            type: "text",
            text: "{{other_var}}",
          },
        ],
      ],
      ["human", "hello {{name}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    image_url: "https://foo.com/bar.png",
    other_var: "bar",
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: [
        { type: "image_url", image_url: { url: "https://foo.com/bar.png" } },
        { type: "text", text: "bar" },
      ],
    }),
    new HumanMessage({
      content: "hello Bob",
    }),
  ]);

  expect(template.inputVariables.sort()).toEqual([
    "image_url",
    "name",
    "other_var",
  ]);
});

test("Mustache image template with nested URL and chat prompts HumanMessagePromptTemplate.fromTemplate", async () => {
  const template = HumanMessagePromptTemplate.fromTemplate(
    [
      {
        text: "{{name}}",
      },
      {
        image_url: {
          url: "{{image_url}}",
        },
      },
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    name: "Bob",
    image_url: "https://foo.com/bar.png",
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: [
        { type: "text", text: "Bob" },
        { type: "image_url", image_url: { url: "https://foo.com/bar.png" } },
      ],
    }),
  ]);

  expect(template.inputVariables.sort()).toEqual(["image_url", "name"]);
});

test("Mustache image template with nested props", async () => {
  const template = ChatPromptTemplate.fromMessages(
    [
      ["human", "{{agent.name}}"],
      ["placeholder", "{{messages}}"],
    ],
    {
      templateFormat: "mustache",
    }
  );

  const messages = await template.formatMessages({
    agent: { name: "testing" },
    messages: [
      {
        role: "assistant",
        content: "hi there!",
      },
    ],
  });

  expect(messages).toEqual([
    new HumanMessage({
      content: "testing",
    }),
    new AIMessage("hi there!"),
  ]);

  expect(template.inputVariables.sort()).toEqual(["agent", "messages"]);
});

test("with ChatPromptTemplate", async () => {
  const samplePrompt = "Hey {{name}}, {{#isTrue}}how are {{myvar}}?{{/isTrue}}";

  const sampleVariables = {
    name: "John",
    isTrue: true,
    myvar: "you", // <-- this is not included in the inputVariables
  };

  const expectedResult = "Hey John, how are you?";
  const prompt = ChatPromptTemplate.fromMessages([["system", samplePrompt]], {
    templateFormat: "mustache",
  });
  expect(prompt.inputVariables).toEqual(["name", "isTrue", "myvar"]);
  expect(await prompt.format(sampleVariables)).toBe(
    `System: ${expectedResult}`
  );
});

test("nested object", async () => {
  const samplePrompt =
    "Here are the {{name}}:\n\n{{#locations}}\n- {{name}}\n{{/locations}}\n{{name}} end";

  const sampleVariables = {
    locations: [
      {
        name: "Tokyo",
      },
      {
        name: "Los Angeles",
      },
      {
        name: "Palo Alto",
      },
    ],
    name: "locations",
  };

  const expectedResult =
    "Here are the locations:\n\n- Tokyo\n- Los Angeles\n- Palo Alto\nlocations end";
  const prompt = ChatPromptTemplate.fromMessages([["system", samplePrompt]], {
    templateFormat: "mustache",
  });
  expect(await prompt.format(sampleVariables)).toBe(
    `System: ${expectedResult}`
  );
});

test("Rendering a prompt with conditionals doesn't result in empty text blocks", async () => {
  const manifest = {
    lc: 1,
    type: "constructor",
    id: ["langchain_core", "prompts", "chat", "ChatPromptTemplate"],
    kwargs: {
      messages: [
        {
          lc: 1,
          type: "constructor",
          id: [
            "langchain_core",
            "prompts",
            "chat",
            "SystemMessagePromptTemplate",
          ],
          kwargs: {
            prompt: {
              lc: 1,
              type: "constructor",
              id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
              kwargs: {
                input_variables: [],
                template_format: "mustache",
                template: "Always echo back whatever I send you.",
              },
            },
          },
        },
        {
          lc: 1,
          type: "constructor",
          id: [
            "langchain_core",
            "prompts",
            "chat",
            "HumanMessagePromptTemplate",
          ],
          kwargs: {
            prompt: [
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template: "Here is the teacher's prompt:",
                  additional_content_fields: {
                    text: "Here is the teacher's prompt:",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["promptDescription"],
                  template_format: "mustache",
                  template: '"{{promptDescription}}"\n',
                  additional_content_fields: {
                    text: '"{{promptDescription}}"\n',
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template:
                    "Here is the expected answer or success criteria given by the teacher:",
                  additional_content_fields: {
                    text: "Here is the expected answer or success criteria given by the teacher:",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["expectedResponse"],
                  template_format: "mustache",
                  template: '"{{expectedResponse}}"\n',
                  additional_content_fields: {
                    text: '"{{expectedResponse}}"\n',
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template:
                    "Note: This may be just one example many possible correct ways for the student to respond.\n",
                  additional_content_fields: {
                    text: "Note: This may be just one example many possible correct ways for the student to respond.\n",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template: "For your evaluation of the student's response:\n",
                  additional_content_fields: {
                    text: "For your evaluation of the student's response:\n",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template:
                    "Here is a transcript of the student's explanation:",
                  additional_content_fields: {
                    text: "Here is a transcript of the student's explanation:",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["responseTranscript"],
                  template_format: "mustache",
                  template: '"{{responseTranscript}}"\n',
                  additional_content_fields: {
                    text: '"{{responseTranscript}}"\n',
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["readingFluencyAnalysis"],
                  template_format: "mustache",
                  template:
                    "{{#readingFluencyAnalysis}} For this task, the student's reading pronunciation and fluency were important. Here is analysis of the student's oral response: \"{{readingFluencyAnalysis}}\" {{/readingFluencyAnalysis}}",
                  additional_content_fields: {
                    text: "{{#readingFluencyAnalysis}} For this task, the student's reading pronunciation and fluency were important. Here is analysis of the student's oral response: \"{{readingFluencyAnalysis}}\" {{/readingFluencyAnalysis}}",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["readingFluencyAnalysis"],
                  template_format: "mustache",
                  template:
                    "{{#readingFluencyAnalysis}}Root analysis of the student's response (step 3) in this oral analysis rather than inconsistencies in the transcript.{{/readingFluencyAnalysis}}",
                  additional_content_fields: {
                    text: "{{#readingFluencyAnalysis}}Root analysis of the student's response (step 3) in this oral analysis rather than inconsistencies in the transcript.{{/readingFluencyAnalysis}}",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["readingFluencyAnalysis"],
                  template_format: "mustache",
                  template:
                    "{{#readingFluencyAnalysis}}Remember this is a student, so we care about general fluency - not voice acting. {{/readingFluencyAnalysis}}\n",
                  additional_content_fields: {
                    text: "{{#readingFluencyAnalysis}}Remember this is a student, so we care about general fluency - not voice acting. {{/readingFluencyAnalysis}}\n",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: ["multipleChoiceAnalysis"],
                  template_format: "mustache",
                  template:
                    "{{#multipleChoiceAnalysis}}Here is an analysis of the student's multiple choice response: {{multipleChoiceAnalysis}}{{/multipleChoiceAnalysis}}\n",
                  additional_content_fields: {
                    text: "{{#multipleChoiceAnalysis}}Here is an analysis of the student's multiple choice response: {{multipleChoiceAnalysis}}{{/multipleChoiceAnalysis}}\n",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: ["langchain_core", "prompts", "prompt", "PromptTemplate"],
                kwargs: {
                  input_variables: [],
                  template_format: "mustache",
                  template: "Here is the student's whiteboard:\n",
                  additional_content_fields: {
                    text: "Here is the student's whiteboard:\n",
                  },
                },
              },
              {
                lc: 1,
                type: "constructor",
                id: [
                  "langchain_core",
                  "prompts",
                  "image",
                  "ImagePromptTemplate",
                ],
                kwargs: {
                  template: {
                    url: "{{whiteboard}}",
                  },
                  input_variables: ["whiteboard"],
                  template_format: "mustache",
                  additional_content_fields: {
                    image_url: {
                      url: "{{whiteboard}}",
                    },
                  },
                },
              },
            ],
            additional_options: {},
          },
        },
      ],
      input_variables: [
        "promptDescription",
        "expectedResponse",
        "responseTranscript",
        "readingFluencyAnalysis",
        "readingFluencyAnalysis",
        "readingFluencyAnalysis",
        "multipleChoiceAnalysis",
        "whiteboard",
      ],
      template_format: "mustache",
      metadata: {
        lc_hub_owner: "jacob",
        lc_hub_repo: "mustache-conditionals",
        lc_hub_commit_hash:
          "836ad82d512409ea6024fb760b76a27ba58fc68b1179656c0ba2789778686d46",
      },
    },
  };
  const prompt = await load<ChatPromptTemplate>(JSON.stringify(manifest));
  const res = await prompt.invoke({
    promptDescription: "What is the capital of the USA?",
    expectedResponse: "Washington, D.C.",
    responseTranscript: "Washington, D.C.",
    readingFluencyAnalysis: undefined,
    multipleChoiceAnalysis: "testing2",
    whiteboard: "https://foo.com/bar.png",
  });
  const content = res.messages[1].content;
  expect(Array.isArray(content)).toBe(true);
  const emptyTextBlocks = (content as Record<string, unknown>[]).filter(
    (block: Record<string, unknown>) =>
      block.type === "text" && block.text === ""
  );
  expect(emptyTextBlocks.length).toBe(0);
});
