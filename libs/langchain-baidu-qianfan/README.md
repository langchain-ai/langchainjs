# @langchain/baidu-qianfan

This package contains the LangChain.js integrations for Baidu Qianfan via the qianfan/sdk package.

## Installation

```bash npm2yarn
npm install @langchain/baidu-qianfan @langchain/core
```

## Chat models

This package adds support for Qianfan chat model inference.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export QIANFAN_AK=""
export QIANFAN_SK=""
export QIANFAN_ACCESS_KEY=""
export QIANFAN_SECRET_KEY=""
```

```typescript
import { ChatBaiduQianfan } from "@langchain/baidu-qianfan";
import { HumanMessage } from "@langchain/core/messages";

const chat = new ChatBaiduQianfan({
  model: "ERNIE-Lite-8K",
});
const message = new HumanMessage("北京天气");

const res = await chat.invoke([message]);
```

```typescript
import { BaiduQianfanEmbeddings } from "@langchain/baidu-qianfan";

const embeddings = new BaiduQianfanEmbeddings();
const res = await embeddings.embedQuery("Introduce the city Beijing");
```
