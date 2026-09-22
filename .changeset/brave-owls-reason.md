---
"@langchain/openai": minor
---

Add opt-in `reasoningParameterPolicy: "passthrough"` to forward explicit reasoning settings for any model or custom deployment, preserving existing detection with the default `"auto"` policy. The provider validates passthrough settings; message-role, token-limit, and endpoint-selection behavior is unchanged by the policy.

Recognize non-chat gpt-6 models as reasoning models under the default policy.
