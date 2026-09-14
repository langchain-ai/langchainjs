---
"@langchain/core": patch
---

Prevent AsyncCaller from starting queued calls or further retries after cancellation. Abort retry delays promptly, including when cancellation occurs during a failure handler, while keeping running calls in their concurrency slot until they settle.
