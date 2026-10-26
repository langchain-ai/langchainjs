---
"langchain": patch
---

fix(langchain): re-throw a drained tool from the agent's `ToolNode`

A tool that throws `GraphDrained`, for example one whose inner graph run is drained with `RunControl.requestDrain()`, now stops the agent run with that error, as an interrupt already did, instead of coming back as an error `ToolMessage` that lets the agent go on as if the tool had failed.
