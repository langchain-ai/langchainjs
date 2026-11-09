---
"@langchain/google": patch
---

Fix type errors in `ChatGoogle`'s error parsing

`RequestError.fromResponse` and `AuthError.fromResponse` read the message
from an error body typed `unknown`. They now take `error.message`,
`message`, `error` or `error_description` only when that field is a string.
Google's error bodies carry string messages, so those errors read as before;
a body whose matching field isn't a string now gets the status-code message
instead of one like `[object Object]`.
