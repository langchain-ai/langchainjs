---
"langchain": patch
---

fix(langchain): keep tool call streams pending across any tool interrupt

A raw `interrupt()` raised from inside a tool surfaced as a `tool-error` and
rejected the call's un-awaited `output` promise, producing an unhandled
rejection that crashed HITL runs. The tool-call stream transformer now treats
any serialized graph interrupt as control flow (the call stays pending and
resumes), not just `humanInTheLoopMiddleware` interrupts.
