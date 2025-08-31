import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { JsonOutputFunctionsParser } from "@langchain/core/output_parsers/openai_functions";

const schema = z.object({
  setup: z.string().describe("The setup for the joke"),
  punchline: z.string().describe("The punchline to the joke"),
});

const prompt = ChatPromptTemplate.fromTemplate(
  `tell me a long joke about {foo}`
);
const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
})
  .bindTools([
    {
      name: "joke",
      description: "A joke",
      schema,
    },
  ])
  .withConfig({
    function_call: { name: "joke" },
  });

const chain = prompt
  .pipe(model)
  .pipe(new JsonOutputFunctionsParser({ diff: true }));

const stream = await chain.stream({
  foo: "bears",
});

// Stream a diff as JSON patch operations
for await (const chunk of stream) {
  console.log(chunk);
}

/*
  []
  [ { op: 'add', path: '/setup', value: '' } ]
  [ { op: 'replace', path: '/setup', value: 'Why' } ]
  [ { op: 'replace', path: '/setup', value: 'Why don' } ]
  [ { op: 'replace', path: '/setup', value: "Why don't" } ]
  [ { op: 'replace', path: '/setup', value: "Why don't bears" } ]
  [ { op: 'replace', path: '/setup', value: "Why don't bears wear" } ]
  [
    {
      op: 'replace',
      path: '/setup',
      value: "Why don't bears wear shoes"
    }
  ]
  [
    {
      op: 'replace',
      path: '/setup',
      value: "Why don't bears wear shoes?"
    },
    { op: 'add', path: '/punchline', value: '' }
  ]
  [ { op: 'replace', path: '/punchline', value: 'Because' } ]
  [ { op: 'replace', path: '/punchline', value: 'Because they' } ]
  [ { op: 'replace', path: '/punchline', value: 'Because they have' } ]
  [
    {
      op: 'replace',
      path: '/punchline',
      value: 'Because they have bear'
    }
  ]
  [
    {
      op: 'replace',
      path: '/punchline',
      value: 'Because they have bear feet'
    }
  ]
  [
    {
      op: 'replace',
      path: '/punchline',
      value: 'Because they have bear feet!'
    }
  ]
*/

const chain2 = prompt.pipe(model).pipe(new JsonOutputFunctionsParser());

const stream2 = await chain2.stream({
  foo: "beets",
});

// Stream the entire aggregated JSON object
for await (const chunk of stream2) {
  console.log(chunk);
}

/*
  {}
  { setup: '' }
  { setup: 'Why' }
  { setup: 'Why did' }
  { setup: 'Why did the' }
  { setup: 'Why did the beet' }
  { setup: 'Why did the beet go' }
  { setup: 'Why did the beet go to' }
  { setup: 'Why did the beet go to therapy' }
  { setup: 'Why did the beet go to therapy?', punchline: '' }
  { setup: 'Why did the beet go to therapy?', punchline: 'Because' }
  { setup: 'Why did the beet go to therapy?', punchline: 'Because it' }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a lot'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a lot of'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a lot of unresolved'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a lot of unresolved issues'
  }
  {
    setup: 'Why did the beet go to therapy?',
    punchline: 'Because it had a lot of unresolved issues!'
  }
*/
