# Document

언어 모델(Language Model)들은 오직 자신이 학습한 정보에 관한것만을 알고 있습니다. 그렇기 때문에, 질문에 대한 답이나 다른 정보에 대한 요약을 얻기 위해서는 Document 를 모델에게 전달해주어야 합니다. 그러므로, Document 를 이해하고 있는것은 정말 중요햡니다.

Document 의 핵심은 매우 간단합니다. 텍스트와 선택적인 Metadata 로 이루어져 있습니다. 텍스트는 언어 모델과 소통하는 부분이며, 메타데이터 정보는 document 에 대한 메타데이터를 추적하는데 용이합니다. (출저와 같은).

```typescript
interface Document {
  pageContent: string;
  metadata: Record<string, any>;
}
```

## Creating a Document

랭체인(LangChain) 에서는 아래와 같이 Document 객체를 쉽게 생성할 수 있습니다.

```typescript
import { Document } from "langchain/document";

const doc = new Document({ pageContent: "foo" });
```

도큐먼트 객체를 "1" 이라는 메타데이터와 함께 생성할 수 있습니다.

```typescript
import { Document } from "langchain/document";

const doc = new Document({ pageContent: "foo", metadata: { source: "1" } });
```

다양한 출저로 부터 도큐먼트를 로딩 하는 방법을 알고 싶다면 [Document Loaders](../indexes/document_loaders/)를 확인해보세요.
