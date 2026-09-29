---
"@langchain/pgvector": patch
---

Add a `jsonbContains` metadata filter operator for Postgres JSONB containment (`@>`). Previously the only way to filter on a nested JSONB value was to work around the filter builder, which was not extensible.

```ts
// Matches documents whose `metadata.profile` contains `{ tier: "gold" }`,
// including documents where `profile` also has other keys.
await store.similaritySearch(query, 10, {
  profile: { jsonbContains: { tier: "gold" } },
});
```

Also fixes two pre-existing problems in the filter builder:

- `in: []` and `notIn: []` produced invalid SQL (`IN ()`) and threw a raw
  database syntax error. An empty `in` list now matches nothing and an empty
  `notIn` list excludes nothing.
- Unrecognized filter operators were dropped silently, so a query returned
  every row instead of the intended subset. The store now emits a `console.warn`
  naming each ignored operator. Filtering behavior is otherwise unchanged.
