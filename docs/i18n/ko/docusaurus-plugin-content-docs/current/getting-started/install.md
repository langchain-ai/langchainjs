---
sidebar_position: 1
---

# 초기 세팅과 설치

:::info
0.0.52 이하 버전에서 업데이트 하고 계신가요? [이 섹션](#updating-from-0052)을 참고하세요.
:::

## 지원 환경

LangChain은 TypeScript로 작성되었으며 다음 환경에서 사용할 수 있습니다.

- Node.js (ESM and CommonJS) - 18.x, 19.x, 20.x
- Cloudflare Workers
- Vercel / Next.js (Browser, Serverless and Edge functions)
- Supabase Edge Functions
- Browser
- Deno

## 빠른 시작

Node.js에서 LangChain을 빠르게 사용해보고 싶다면, [이 저장소](https://github.com/domeccleston/langchain-ts-starter)를 클론하고 README에 따라 프로젝트를 설정하세요.

직접 설정하거나 다른 환경에서 LangChain을 실행하려는 경우, 아래 설명을 읽어보세요.

## 설치

시작하려면, 다음 명령어로 LangChain을 설치하세요.

```bash npm2yarn
npm install -S langchain
```

### TypeScript

LangChain은 TypeScript로 작성되었으며, 모든 퍼블릭 API에 대한 타입 정의를 제공합니다.

## 라이브러리 로딩

### ESM

LangChain은 Node.js 환경을 대상으로 ESM 빌드를 제공합니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

ESM 프로젝트에서 TypeScript를 사용하는 경우, 다음을 포함하여 `tsconfig.json`을 업데이트하는 것이 좋습니다.

```json title="tsconfig.json"
{
  "compilerOptions": {
    ...
    "target": "ES2020", // or higher
    "module": "nodenext",
  }
}
```

### CommonJS

LangChain은 Node.js의 CommonJS 빌드를 제공합니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
const { OpenAI } = require("langchain/llms/openai");
```

### Cloudflare Workers

LangChain은 Cloudflare Workers에서 사용할 수 있습니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

### Vercel / Next.js

LangChain은 Vercel / Next.js에서 사용할 수 있습니다. LangChain을 프론트엔드 컴포넌트, 서버리스 함수, Edge 함수에서 사용할 수 있습니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

프론트엔드 `pages`에서 LangChain을 사용하려면, 토크나이저 라이브러리인 `@dqbd/tiktoken`가 필요로 하는 WebAssembly 모듈을 지원하도록 다음을 `next.config.js`에 추가해야 합니다.


```js title="next.config.js"
const nextConfig = {
  webpack(config) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};
```

### Deno / Supabase Edge Functions

LangChain은 Deno / Supabase Edge Functions에서 사용할 수 있습니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
import { OpenAI } from "https://esm.sh/langchain/llms/openai";
```

LangChain을 Supabase Edge Functions에서 사용하는 방법에 대한 예제는 [Supabase Template](https://github.com/langchain-ai/langchain-template-supabase)를 참고하세요.

### Browser

LangChain은 브라우저에서 사용할 수 있습니다. CI에서는 Webpack과 Vite로 LangChain을 번들링하고 있지만, 다른 번들러도 작동할 것입니다. 다음 구문을 사용하여 가져올 수 있습니다.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

#### Create React App

만약 `create-react-app`을 사용하고 있다면, 기본적으로 WebAssembly 모듈을 지원하지 않기 때문에 토크나이저 라이브러리인 `@dqbd/tiktoken`이 브라우저에서 작동하지 않습니다. WebAssembly 모듈을 지원하도록 하려면 [여기](https://github.com/dqbd/tiktoken/tree/main/js#create-react-app) 설명을 참고하세요.

#### Vite

Vite를 사용하는 경우, WebAssembly 모듈을 지원하도록 다음을 `vite.config.js`에 추가해야 합니다. (토크나이저 라이브러리인 `@dqbd/tiktoken`이 필요로 합니다.)

```bash npm2yarn
npm install -D vite-plugin-wasm vite-plugin-top-level-await
```

```js title="vite.config.js"
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
});
```

## Updating from <0.0.52

만약 0.0.52 이전 버전의 LangChain을 업데이트하려면, 새로운 경로 구조를 사용하도록 import를 업데이트해야 합니다.

예를 들면, 이전에 이렇게 사용했다면,

```typescript
import { OpenAI } from "langchain/llms";
```

이렇게 바꿔주어야 합니다.

```typescript
import { OpenAI } from "langchain/llms/openai";
```

이는 각 통합에 대한 하위 모듈로 분리된 다음 6개 모듈에 적용됩니다. 이전 모듈은 사용이 중지되었으며, Node.js 외부에서 작동하지 않습니다. 향후 버전에서 제거될 예정입니다.

- `langchain/llms`을 사용하고 있다면, [대규모 언어 모델(LLM)](../modules/models/llms/integrations)에서 업데이트 된 import 경로를 찾을 수 있습니다.
- `langchain/chat_models`을 사용하고 있다면, [채팅 모델](../modules/models/chat/integrations)에서 업데이트 된 import 경로를 찾을 수 있습니다.
- `langchain/embeddings`을 사용하고 있다면, [임베딩](../modules/models/embeddings/integrations)에서 업데이트 된 import 경로를 찾을 수 있습니다.
- `langchain/vectorstores`을 사용하고 있다면, [벡터 저장소](../modules/indexes/vector_stores/integrations/)에서 업데이트 된 import 경로를 찾을 수 있습니다.
- `langchain/document_loaders`을 사용하고 있다면, [문서 로더](../modules/indexes/document_loaders/examples/)에서 업데이트 된 import 경로를 찾을 수 있습니다.
- `langchain/retrievers`을 사용하고 있다면, [리트리버](../modules/indexes/retrievers/)에서 업데이트 된 import 경로를 찾을 수 있습니다.

다른 모듈은 영향을 받지 않으며, 이전과 동일한 경로에서 가져올 수 있습니다.

추가로, 새로운 환경을 지원하기 위해 필요한 몇 가지 변경 사항이 있습니다.

- `import { Calculator } from "langchain/tools";`은 이제
  - `import { Calculator } from "langchain/tools/calculator";`로 이동되었습니다.
- `import { loadLLM } from "langchain/llms";`은 이제
  - `import { loadLLM } from "langchain/llms/load";`로 이동되었습니다.
- `import { loadAgent } from "langchain/agents";`은 이제
  - `import { loadAgent } from "langchain/agents/load";`로 이동되었습니다.
- `import { loadPrompt } from "langchain/prompts";`은 이제
  - `import { loadPrompt } from "langchain/prompts/load";`로 이동되었습니다.
- `import { loadChain } from "langchain/chains";`은 이제
  - `import { loadChain } from "langchain/chains/load";`로 이동되었습니다.

## Unsupported: Node.js 16

우리는 Node.js 16을 지원하지 않지만, 그럼에도 Node.js 16에서 LangChain을 실행하려 한다면 이 섹션의 설명을 따라야 합니다. 미래에도 계속 작동할 것은 보장하지 않습니다.

`fetch` 함수를 전역으로 사용할 수 있도록 해야 합니다. 다음 중 하나를 사용하세요.

- 당신의 애플리케이션을 `NODE_OPTIONS='--experimental-fetch' node ...`와 함께 실행하거나,
- `node-fetch`를 설치하고 [여기](https://github.com/node-fetch/node-fetch#providing-global-access)의 설명을 따르세요.

추가로, `unstructuredClone`을 지원 가능하도록 변환해야 합니다. 예를 들면, `core-js`를 설치하고 [여기](https://github.com/zloirock/core-js)의 설명을 따르세요.

Node.js 18 이상에서 실행하는 경우, 아무것도 할 필요가 없습니다.
