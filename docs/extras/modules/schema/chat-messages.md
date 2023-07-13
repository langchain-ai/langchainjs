---
hide_table_of_contents: true
sidebar_position: 1
---

# Chat Messages

The primary interface through which end users interact with LLMs is a chat interface. For this reason, some model providers have started providing access to the underlying API in a way that expects chat messages. These messages have a content field (which is usually text) and are associated with a user (or role). Right now the supported users are System, Human, and AI.

## SystemMessage

A chat message representing information that should be instructions to the AI system.

```typescript
import { SystemMessage } from "langchain/schema";

new SystemMessage("You are a nice assistant");
```

## HumanMessage

A chat message representing information coming from a human interacting with the AI system.

```typescript
import { HumanMessage } from "langchain/schema";

new HumanMessage("Hello, how are you?");
```

## AIMessage

A chat message representing information coming from the AI system.

```typescript
import { AIMessage } from "langchain/schema";

new AIMessage("I am doing well, thank you!");
```
