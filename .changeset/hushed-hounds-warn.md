---
"@langchain/classic": patch
---

Stop `@langchain/classic/load` and `/hub` from printing the empty root entrypoint warning

The import map behind `load()` re-exported the package's root entrypoint,
which exports nothing and only prints
`[WARNING]: The root "langchain" entrypoint is empty.` So importing
`@langchain/classic/load`, `@langchain/classic/hub` or
`@langchain/classic/hub/node` printed that warning even though nothing
imported the root entrypoint. The root entrypoint is no longer in the import
map; importing `@langchain/classic` itself still prints the warning.
