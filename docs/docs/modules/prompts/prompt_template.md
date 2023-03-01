---
sidebar_position: 1
---

# Prompt Templates

This example walks through how to use PromptTemplates. At their core, prompt templates are objects that are made up of a template with certain input variables. This object can then be called with `.format(...)` to format the input variables accordingly.

```typescript
import { PromptTemplate } from "langchain/prompts";
const template = "What is a good name for a company that makes {product}?";
const prompt = new PromptTemplate({
  template: template,
  inputVariables: ["product"],
});
```

Let's now see how this works! We can call the `.format` method to format it.

```typescript
const res = prompt.format({ product: "colorful socks" });
console.log({ res });
```

```shell
{ res: 'What is a good name for a company that makes colorful socks?' }
```
