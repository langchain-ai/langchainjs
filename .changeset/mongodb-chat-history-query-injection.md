---
"@langchain/mongodb": patch
---

fix(mongodb): reject non-string sessionId in MongoDBChatMessageHistory and wrap query filters with $eq (GHSA-m6rx-h84q-8r95)

Breaking: `sessionId: ""` now throws instead of silently working.
