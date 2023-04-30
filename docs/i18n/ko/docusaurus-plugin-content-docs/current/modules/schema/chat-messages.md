---
hide_table_of_contents: true
sidebar_position: 1
---

# Chat Messages

사용자가 LLM 과 상호작용하는 주요 인터페이스는 채팅 인터페이스 입니다. 이러한 이유로, 몇몇 모델 제공자들은 메세지 채팅 방식으로 접근할 수 있는 API 를 제공하기 시작했습니다. 이러한 메세지들은 컨텐츠 필드(일반적인 메세지)와 사용자 또는 역할과 관련있는 필드를 가지고 있습니다. 현재 지원되는 사용자(users)는 System, Human, AI 이 지원됩니다.

## SystemChatMessage

이 채팅 메세지는 AI System 이 따라야 하는 명령을 나타냅니다.

```typescript
import { SystemChatMessage } from "langchain/schema";

new SystemChatMessage("You are a nice assistant");
```

## HumanChatMessage

이 채팅 메세지는 AI 시스템과 사람이 상호작용을 하는 메세지를 나타냅니다.

```typescript
import { HumanChatMessage } from "langchain/schema";

new HumanChatMessage("Hello, how are you?");
```

## AIChatMessage

이 채팅 메세지는 AI 시스템으로 부터 오는 메세지를 나타냅니다.

```typescript
import { AIChatMessage } from "langchain/schema";

new AIChatMessage("I am doing well, thank you!");
```
