---
"langchain": patch
---

fix(langchain/agents): Fix ReactAgent routing with returnDirect + beforeModel middleware

This fixes a routing error when an agent has both tools with returnDirect: true and middleware with beforeModel hooks (e.g., summarizationMiddleware). Before this fix, non-returnDirect tools would fail with "Branch condition returned unknown or null destination".
