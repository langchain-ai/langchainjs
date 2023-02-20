# LLMChain

An LLMChain is the simplest type of chain, and is used widely in other chains, so understanding it is important.

An LLMChain consists of a PromptTemplate and an LLM.

We can construct an LLMChain which takes user input, formats it with a PromptTemplate, and then passes the formatted response to an LLM.

```typescript
import { OpenAI } from "langchain/llms";
import { PromptTemplate } from "langchain/prompts";
const model = new OpenAI({ temperature: 0.9 });
const template = "What is a good name for a company that makes {product}?";
const prompt = new PromptTemplate({
  template: template,
  inputVariables: ["product"],
});
```

We can now create a very simple chain that will take user input, format the prompt with it, and then send it to the LLM:

```typescript
import { LLMChain } from "langchain/chains";

const chain = new LLMChain({ llm: model, prompt: prompt });
```

Now we can run that chain only specifying the product!

```typescript
const res = await chain.call({ product: "colorful socks" });
console.log({ res });
```

```shell
{ res: { text: '\n\nColorfulCo Sockery.' } }
```

LLMChain also supports output streaming by providing both the `streaming: true` parameter and the appropriate `callbackManager.handleNewToken` callback function.

```typescript
const model = new OpenAI({
  streaming: true,
  callbackManager: {
    handleNewToken: (token) => console.log(token),
  },
});
```
