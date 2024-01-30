# @langchain/yandex

This package contains the LangChain.js integrations for YandexGPT through their [Foundation Models REST API](https://cloud.yandex.ru/en/docs/yandexgpt/api-ref/v1/).

## Installation

```bash npm2yarn
npm install @langchain/yandex
```

## Setup your environment
First, you should [create a service account](https://cloud.yandex.com/en/docs/iam/operations/sa/create) with the `ai.languageModels.user` role.

Next, you have two authentication options:

- [IAM token](https://cloud.yandex.com/en/docs/iam/operations/iam-token/create-for-sa).
  You can specify the token in a constructor parameter as `iam_token` or in an environment variable `YC_IAM_TOKEN`.
- [API key](https://cloud.yandex.com/en/docs/iam/operations/api-key/create)
  You can specify the key in a constructor parameter as `api_key` or in an environment variable `YC_API_KEY`.

## Chat Models and LLM Models

This package contains the `ChatYandexGPT` and `YandexGPT` classes for working with the YandexGPT series of models.

To specify the model you can use `model_uri` parameter, see [the documentation](https://cloud.yandex.com/en/docs/yandexgpt/concepts/models#yandexgpt-generation) for more details.

By default, the latest version of `yandexgpt-lite` is used from the folder specified in the parameter `folder_id` or `YC_FOLDER_ID` environment variable.

### Examples

```typescript
import { ChatYandexGPT } from "@langchain/yandex";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const chat = new ChatYandexGPT();
const response = await chat.invoke([
  new SystemMessage(
    "You are a helpful assistant that translates English to French."
  ),
  new HumanMessage("I love programming."),
]);
```

```typescript
import { YandexGPT } from "@langchain/yandex";
const model = new YandexGPT();
const res = await model.invoke([`Translate "I love programming" into French.`]);
```

## Embeddings

This package also adds support for YandexGPT embeddings models.

To specify the model you can use `model_uri` parameter, see [the documentation](https://cloud.yandex.com/en/docs/yandexgpt/concepts/models#yandexgpt-embeddings) for more details.

By default, the latest version of `text-search-query` embeddings model is used from the folder specified in the parameter `folder_id` or `YC_FOLDER_ID` environment variable.

### Example

```typescript
import { YandexGPTEmbeddings } from "@langchain/yandex";

const model = new YandexGPTEmbeddings({});

/* Embed queries */
const res = await model.embedQuery(
  "This is a test document."
);
/* Embed documents */
const documentRes = await model.embedDocuments(["This is a test document."]);
```

## Development

To develop the yandex package, you'll need to follow these instructions:

### Install dependencies

```bash
yarn install
```

### Build the package

```bash
yarn build
```

Or from the repo root:

```bash
yarn build --filter=@langchain/yandex
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `entrypoints` field in the `config` variable located inside `langchain.config.js` and run `yarn build` to generate the new entrypoint.
