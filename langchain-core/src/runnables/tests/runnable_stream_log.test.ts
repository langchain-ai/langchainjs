/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { test } from "@jest/globals";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "../../prompts/index.js";
import { Document } from "../../documents/document.js";
import { RunLog } from "../../tracers/log_stream.js";
import { RunnableSequence, RunnableMap } from "../base.js";
import {
  FakeLLM,
  FakeStreamingLLM,
  FakeChatModel,
  FakeRetriever,
} from "../../utils/testing/index.js";
import { SystemMessage, HumanMessage } from "../../messages/index.js";
import { CommaSeparatedListOutputParser } from "../../output_parsers/list.js";
import { ChatPromptValue } from "../../prompt_values.js";

test("Runnable streamLog method", async () => {
  const promptTemplate = PromptTemplate.fromTemplate("{input}");
  const llm = new FakeLLM({});
  const runnable = promptTemplate.pipe(llm);
  const result = await runnable.streamLog({ input: "Hello world!" });
  let finalState;
  for await (const chunk of result) {
    if (finalState === undefined) {
      finalState = chunk;
    } else {
      finalState = finalState.concat(chunk);
    }
  }
  expect((finalState as RunLog).state.final_output).toEqual({
    output: "Hello world!",
  });
});

test("Runnable streamLog method with a more complicated sequence", async () => {
  const promptTemplate = ChatPromptTemplate.fromMessages<{
    documents: string;
    question: string;
  }>([
    SystemMessagePromptTemplate.fromTemplate(`You are a nice assistant.`),
    HumanMessagePromptTemplate.fromTemplate(
      `Context:\n{documents}\n\nQuestion:\n{question}`
    ),
  ]);
  const llm = new FakeChatModel({});
  const retrieverOutputDocs = [
    new Document({ pageContent: "foo" }),
    new Document({ pageContent: "bar" }),
  ];
  const inputs = {
    question: (input: string) => input,
    documents: RunnableSequence.from([
      new FakeRetriever({
        output: retrieverOutputDocs,
      }),
      (docs: Document[]) => JSON.stringify(docs),
    ]).withConfig({ runName: "CUSTOM_NAME" }),
    extraField: new FakeLLM({
      response: "testing",
    }).withConfig({ tags: ["only_one"] }),
  };

  const runnable = new RunnableMap({
    steps: inputs,
  })
    .pipe(promptTemplate)
    .pipe(llm);
  const stream = await runnable.streamLog(
    "Do you know the Muffin Man?",
    {},
    {
      includeTags: ["only_one"],
      includeNames: ["CUSTOM_NAME"],
    }
  );
  let finalState;
  for await (const chunk of stream) {
    if (finalState === undefined) {
      finalState = chunk;
    } else {
      finalState = finalState.concat(chunk);
    }
  }
  expect((finalState as RunLog).state.logs.FakeLLM).toBeDefined();
  expect(
    (finalState as RunLog).state.logs.FakeLLM.final_output.generations[0][0]
      .text
  ).toEqual("testing");
  expect((finalState as RunLog).state.logs.CUSTOM_NAME).toBeDefined();
  expect(
    (finalState as RunLog).state.logs.CUSTOM_NAME.final_output.output
  ).toEqual(JSON.stringify(retrieverOutputDocs));
});

test("Test stream log aggregation", async () => {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "You are a nice assistant"],
    ["human", "{question}"],
  ]);
  const llm = new FakeStreamingLLM({
    responses: ["tomato, lettuce, onion"],
  });
  const parser = new CommaSeparatedListOutputParser({});
  const chain = prompt.pipe(llm).pipe(parser);
  const logStream = await chain.streamLog({
    question: "what is up?",
  });
  const chunks = [];
  for await (const chunk of logStream) {
    chunks.push(chunk);
  }
  expect(chunks).toMatchObject([
    {
      ops: [
        {
          op: "replace",
          path: "",
          value: {
            id: expect.any(String),
            streamed_output: [],
            logs: {},
          },
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/ChatPromptTemplate",
          value: {
            id: expect.any(String),
            name: "ChatPromptTemplate",
            type: "prompt",
            tags: ["seq:step:1"],
            metadata: {},
            start_time: expect.any(String),
            streamed_output: [],
            streamed_output_str: [],
          },
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/ChatPromptTemplate/final_output",
          value: new ChatPromptValue([
            new SystemMessage("You are a nice assistant"),
            new HumanMessage("what is up?"),
          ]),
        },
        {
          op: "add",
          path: "/logs/ChatPromptTemplate/end_time",
          value: expect.any(String),
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/FakeStreamingLLM",
          value: {
            id: expect.any(String),
            name: "FakeStreamingLLM",
            type: "llm",
            tags: ["seq:step:2"],
            metadata: {},
            start_time: expect.any(String),
            streamed_output: [],
            streamed_output_str: [],
          },
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser",
          value: {
            id: expect.any(String),
            name: "CommaSeparatedListOutputParser",
            type: "parser",
            tags: ["seq:step:3"],
            metadata: {},
            start_time: expect.any(String),
            streamed_output: [],
            streamed_output_str: [],
          },
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser/streamed_output/-",
          value: ["tomato"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/streamed_output/-",
          value: ["tomato"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser/streamed_output/-",
          value: ["lettuce"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/streamed_output/-",
          value: ["lettuce"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/FakeStreamingLLM/final_output",
          value: {
            generations: [
              [
                {
                  text: "tomato, lettuce, onion",
                  generationInfo: {},
                },
              ],
            ],
          },
        },
        {
          op: "add",
          path: "/logs/FakeStreamingLLM/end_time",
          value: expect.any(String),
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser/streamed_output/-",
          value: ["onion"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/streamed_output/-",
          value: ["onion"],
        },
      ],
    },
    {
      ops: [
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser/final_output",
          value: {
            output: ["tomato", "lettuce", "onion"],
          },
        },
        {
          op: "add",
          path: "/logs/CommaSeparatedListOutputParser/end_time",
          value: expect.any(String),
        },
      ],
    },
    {
      ops: [
        {
          op: "replace",
          path: "/final_output",
          value: {
            output: ["tomato", "lettuce", "onion"],
          },
        },
      ],
    },
  ]);
});
