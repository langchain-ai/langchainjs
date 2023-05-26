import { test, expect } from "@jest/globals";

import { load } from "../index.js";
import { OpenAI } from "../../llms/openai.js";
import { PromptTemplate } from "../../prompts/prompt.js";
import { LLMChain } from "../../chains/llm_chain.js";
import { Cohere } from "../../llms/cohere.js";
import {
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate,
  ChatPromptTemplate,
} from "../../prompts/chat.js";
import { ChatOpenAI } from "../../chat_models/openai.js";
import { LangChainTracer } from "../../callbacks/index.js";
import {
  FewShotPromptTemplate,
  LengthBasedExampleSelector,
} from "../../prompts/index.js";

test("serialize + deserialize llm", async () => {
  const llm = new OpenAI({ temperature: 0.5, modelName: "davinci" });
  const str = JSON.stringify(llm, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "llms",
        "openai",
        "OpenAI"
      ],
      "arguments": [
        {
          "temperature": 0.5,
          "modelName": "davinci"
        }
      ]
    }"
  `);
  const llm2 = await load<OpenAI>(str);
  expect(llm2).toBeInstanceOf(OpenAI);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
});

test("serialize + deserialize llm with optional deps", async () => {
  const llm = new Cohere({ temperature: 0.5 });
  const str = JSON.stringify(llm, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "llms",
        "cohere",
        "Cohere"
      ],
      "arguments": [
        {
          "temperature": 0.5
        }
      ]
    }"
  `);
  const llm2 = await load<Cohere>(str, {
    "langchain/llms/cohere": { Cohere },
  });
  expect(llm2).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm2, null, 2)).toBe(str);
  const llm3 = await load<Cohere>(str, {
    "langchain/llms/cohere": import("../../llms/cohere.js"),
  });
  expect(llm3).toBeInstanceOf(Cohere);
  expect(JSON.stringify(llm3, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain string prompt", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    verbose: true,
    callbacks: [
      new LangChainTracer(),
      // This custom handler is not serialized
      {
        handleLLMEnd(output) {
          console.log(output);
        },
      },
    ],
  });
  const prompt = PromptTemplate.fromTemplate("Hello, {name}!");
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "chains",
        "llm_chain",
        "LLMChain"
      ],
      "arguments": [
        {
          "llm": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "llms",
              "openai",
              "OpenAI"
            ],
            "arguments": [
              {
                "callbacks": [
                  {
                    "v": 1,
                    "type": "constructor",
                    "identifier": [
                      "langchain",
                      "callbacks",
                      "langchain_tracer",
                      "LangChainTracer"
                    ],
                    "arguments": [
                      {}
                    ]
                  },
                  {}
                ],
                "temperature": 0.5,
                "modelName": "davinci",
                "verbose": true
              }
            ]
          },
          "prompt": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "prompts",
              "prompt",
              "PromptTemplate"
            ],
            "arguments": [
              {
                "inputVariables": [
                  "name"
                ],
                "templateFormat": "f-string",
                "template": "Hello, {name}!"
              }
            ]
          }
        }
      ]
    }"
  `);
  const chain2 = await load<LLMChain>(str);
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain chat prompt", async () => {
  const llm = new ChatOpenAI({
    temperature: 0.5,
    modelName: "gpt-4",
    streaming: true,
    prefixMessages: [
      {
        role: "system",
        content: "You're a nice assistant",
      },
    ],
  });
  const prompt = ChatPromptTemplate.fromPromptMessages([
    SystemMessagePromptTemplate.fromTemplate("You are talking to {name}."),
    HumanMessagePromptTemplate.fromTemplate("Hello, nice model."),
  ]);
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "chains",
        "llm_chain",
        "LLMChain"
      ],
      "arguments": [
        {
          "llm": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "chat_models",
              "openai",
              "ChatOpenAI"
            ],
            "arguments": [
              {
                "temperature": 0.5,
                "modelName": "gpt-4",
                "streaming": true,
                "prefixMessages": [
                  {
                    "role": "system",
                    "content": "You're a nice assistant"
                  }
                ]
              }
            ]
          },
          "prompt": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "prompts",
              "chat",
              "ChatPromptTemplate"
            ],
            "arguments": [
              {
                "inputVariables": [
                  "name"
                ],
                "promptMessages": [
                  {
                    "v": 1,
                    "type": "constructor",
                    "identifier": [
                      "langchain",
                      "prompts",
                      "chat",
                      "SystemMessagePromptTemplate"
                    ],
                    "arguments": [
                      {
                        "v": 1,
                        "type": "constructor",
                        "identifier": [
                          "langchain",
                          "prompts",
                          "prompt",
                          "PromptTemplate"
                        ],
                        "arguments": [
                          {
                            "inputVariables": [
                              "name"
                            ],
                            "templateFormat": "f-string",
                            "template": "You are talking to {name}."
                          }
                        ]
                      }
                    ]
                  },
                  {
                    "v": 1,
                    "type": "constructor",
                    "identifier": [
                      "langchain",
                      "prompts",
                      "chat",
                      "HumanMessagePromptTemplate"
                    ],
                    "arguments": [
                      {
                        "v": 1,
                        "type": "constructor",
                        "identifier": [
                          "langchain",
                          "prompts",
                          "prompt",
                          "PromptTemplate"
                        ],
                        "arguments": [
                          {
                            "inputVariables": [],
                            "templateFormat": "f-string",
                            "template": "Hello, nice model."
                          }
                        ]
                      }
                    ]
                  }
                ],
                "partialVariables": {}
              }
            ]
          }
        }
      ]
    }"
  `);
  const chain2 = await load<LLMChain>(str);
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain few shot prompt w/ examples", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    callbacks: [new LangChainTracer()],
  });
  const prompt = new FewShotPromptTemplate({
    examples: [{ yo: "1" }, { yo: "2" }],
    prefix: "You are a nice assistant",
    examplePrompt: PromptTemplate.fromTemplate("An example about {yo}"),
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "chains",
        "llm_chain",
        "LLMChain"
      ],
      "arguments": [
        {
          "llm": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "llms",
              "openai",
              "OpenAI"
            ],
            "arguments": [
              {
                "callbacks": [
                  {
                    "v": 1,
                    "type": "constructor",
                    "identifier": [
                      "langchain",
                      "callbacks",
                      "langchain_tracer",
                      "LangChainTracer"
                    ],
                    "arguments": [
                      {}
                    ]
                  }
                ],
                "temperature": 0.5,
                "modelName": "davinci"
              }
            ]
          },
          "prompt": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "prompts",
              "few_shot",
              "FewShotPromptTemplate"
            ],
            "arguments": [
              {
                "examples": [
                  {
                    "yo": "1"
                  },
                  {
                    "yo": "2"
                  }
                ],
                "prefix": "You are a nice assistant",
                "examplePrompt": {
                  "v": 1,
                  "type": "constructor",
                  "identifier": [
                    "langchain",
                    "prompts",
                    "prompt",
                    "PromptTemplate"
                  ],
                  "arguments": [
                    {
                      "inputVariables": [
                        "yo"
                      ],
                      "templateFormat": "f-string",
                      "template": "An example about {yo}"
                    }
                  ]
                },
                "suffix": "My name is {name}",
                "inputVariables": [
                  "yo",
                  "name"
                ]
              }
            ]
          }
        }
      ]
    }"
  `);
  const chain2 = await load<LLMChain>(str);
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});

test("serialize + deserialize llm chain few shot prompt w/ selector", async () => {
  const llm = new OpenAI({
    temperature: 0.5,
    modelName: "davinci",
    callbacks: [new LangChainTracer()],
  });
  const examplePrompt = PromptTemplate.fromTemplate("An example about {yo}");
  const prompt = new FewShotPromptTemplate({
    exampleSelector: await LengthBasedExampleSelector.fromExamples(
      [{ yo: "1" }, { yo: "2" }],
      { examplePrompt }
    ),
    prefix: "You are a nice assistant",
    examplePrompt,
    suffix: "My name is {name}",
    inputVariables: ["yo", "name"],
  });
  const chain = new LLMChain({ llm, prompt });
  const str = JSON.stringify(chain, null, 2);
  expect(str).toMatchInlineSnapshot(`
    "{
      "v": 1,
      "type": "constructor",
      "identifier": [
        "langchain",
        "chains",
        "llm_chain",
        "LLMChain"
      ],
      "arguments": [
        {
          "llm": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "llms",
              "openai",
              "OpenAI"
            ],
            "arguments": [
              {
                "callbacks": [
                  {
                    "v": 1,
                    "type": "constructor",
                    "identifier": [
                      "langchain",
                      "callbacks",
                      "langchain_tracer",
                      "LangChainTracer"
                    ],
                    "arguments": [
                      {}
                    ]
                  }
                ],
                "temperature": 0.5,
                "modelName": "davinci"
              }
            ]
          },
          "prompt": {
            "v": 1,
            "type": "constructor",
            "identifier": [
              "langchain",
              "prompts",
              "few_shot",
              "FewShotPromptTemplate"
            ],
            "arguments": [
              {
                "exampleSelector": {
                  "v": 1,
                  "type": "constructor",
                  "identifier": [
                    "langchain",
                    "prompts",
                    "selectors",
                    "LengthBasedExampleSelector"
                  ],
                  "arguments": [
                    {
                      "examplePrompt": {
                        "v": 1,
                        "type": "constructor",
                        "identifier": [
                          "langchain",
                          "prompts",
                          "prompt",
                          "PromptTemplate"
                        ],
                        "arguments": [
                          {
                            "inputVariables": [
                              "yo"
                            ],
                            "templateFormat": "f-string",
                            "template": "An example about {yo}"
                          }
                        ]
                      }
                    }
                  ],
                  "fields": {
                    "examples": [
                      {
                        "yo": "1"
                      },
                      {
                        "yo": "2"
                      }
                    ],
                    "exampleTextLengths": [
                      4,
                      4
                    ]
                  }
                },
                "prefix": "You are a nice assistant",
                "examplePrompt": {
                  "v": 1,
                  "type": "constructor",
                  "identifier": [
                    "langchain",
                    "prompts",
                    "prompt",
                    "PromptTemplate"
                  ],
                  "arguments": [
                    {
                      "inputVariables": [
                        "yo"
                      ],
                      "templateFormat": "f-string",
                      "template": "An example about {yo}"
                    }
                  ]
                },
                "suffix": "My name is {name}",
                "inputVariables": [
                  "yo",
                  "name"
                ]
              }
            ]
          }
        }
      ]
    }"
  `);
  const chain2 = await load<LLMChain>(str);
  expect(chain2).toBeInstanceOf(LLMChain);
  expect(JSON.stringify(chain2, null, 2)).toBe(str);
});
