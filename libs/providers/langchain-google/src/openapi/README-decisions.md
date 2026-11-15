# Gemini Decisions API OpenAPI Specification Setup

## Why This Exists

The Gemini Decisions API (`POST /{api_version}/decisions`) shares core schema types (`Content`, `TextContent`, `ImageContent`, `AudioContent`, `VideoContent`, `DocumentContent`, `Usage`, etc.) with the Gemini Interactions API (`https://ai.google.dev/static/api/interactions.openapi.json`).

Google plans to publish the Decisions API paths and schemas directly inside the upstream Interactions OpenAPI specification, **but they are not included there yet**.

Because `sparktype` validates and resolves `#/components/...` `$ref`s within each OpenAPI file independently at load time, a partial Decisions fragment cannot be passed to `sparktype` standalone. Conversely, using an older standalone Decisions spec slice would duplicate Interactions schemas and introduce wrapper types (`DecisionInputContent` / `DecisionInstructionContent`) instead of referencing `Interactions.Content` directly.

## Files Involved

- **`interactions-openapi.json`**: Direct, unmodified copy of upstream `https://ai.google.dev/static/api/interactions.openapi.json` fetched by `pnpm run typegen:fetch:interactions`.
- **`decisions-partial-openapi.json`**: Temporary partial OpenAPI fragment containing **only** the Decisions API `paths` and `components.schemas` additions that will eventually land in `interactions-openapi.json`.
  - Both `CreateDecisionRequest.input` and `*Question.instructions` reference `#/components/schemas/Content` (`string | Content | Content[]`). Even though the current Gemini Decisions API documentation notes that question `instructions` accept text only, keeping `Content` at the type level lets media blocks pass through so the API itself enforces modality constraints (and avoids breaking changes if question-level media is enabled later).
  - `DecisionInputContent` and `DecisionInstructionContent` appear in `decisions-partial-openapi.json` as unreferenced leftover schemas and are intentionally omitted from `typegen.jsonc`.
- **`interactions-decisions-openapi.json`**: Generated OpenAPI 3.0.3 specification produced by merging `decisions-partial-openapi.json` underneath `interactions-openapi.json` via `pnpm run typegen:merge:decisions`.
  - `typegen.jsonc` points `"specs.interactions.path"` to `src/openapi/interactions-decisions-openapi.json` and emits the Decisions schemas under a top-level `Decisions` TypeScript namespace alongside `Interactions` in `src/api_types/interactions.ts`.

## How Merging Works

The `typegen:merge:decisions` script in `package.json` runs:

```bash
jq -S -s '.[0] | .paths = (.[1].paths + .paths) | .components.schemas = (.[1].components.schemas + .components.schemas)' \
  src/openapi/interactions-openapi.json \
  src/openapi/decisions-partial-openapi.json \
  > src/openapi/interactions-decisions-openapi.json
```

Using `jq`'s shallow `+` operator with `interactions-openapi.json` (`?.[0]`) on the **right-hand side** guarantees:

1. Zero existing paths or schemas in `interactions-openapi.json` are modified today.
2. If upstream `interactions.openapi.json` begins adding any Decisions paths or schemas, the upstream definition automatically takes precedence over `decisions-partial-openapi.json` as a complete unit (avoiding half-merged schema objects).

### Updating Specs Today

- After editing `decisions-partial-openapi.json` locally (without fetching from the network):
  ```bash
  pnpm run typegen:merge:decisions
  pnpm run typegen
  ```
- When refreshing all OpenAPI specs from upstream (`pnpm run typegen:fetch`), `typegen:merge:decisions` runs automatically after `typegen:fetch:interactions`.

## What to Do Once Decisions Lands in Upstream `interactions.openapi.json`

Once `pnpm run typegen:fetch:interactions` pulls all 12 active Decisions schemas (`CreateDecisionRequest`, `CreateDecisionResponse`, `Question`, `ChoiceQuestion`, `NoulQuestion`, `ScoreQuestion`, `Criteria`, `Answer`, `ChoiceAnswer`, `NoulAnswer`, `ScoreAnswer`, `PromptFeedback`) directly into `src/openapi/interactions-openapi.json`:

1. **Verify upstream coverage**: Check that all 12 schemas listed under the `Decisions` namespace in `typegen.jsonc` exist in `src/openapi/interactions-openapi.json` (and review any schema diffs—for example, whether upstream `ChoiceQuestion.instructions` uses `Content` or `TextContent`).
2. **Update `typegen.jsonc`**: Change `specs.interactions.path` back from `"src/openapi/interactions-decisions-openapi.json"` to `"src/openapi/interactions-openapi.json"`. Because `typegen.jsonc` already uses `"interactions:<SchemaName>"` for every Decisions schema, none of the `contents` entries need to change.
3. **Update `package.json`**: Remove the `"typegen:merge:decisions"` script and remove `&& pnpm run typegen:merge:decisions` from `"typegen:fetch"`.
4. **Delete temporary files**:
   - `src/openapi/decisions-partial-openapi.json`
   - `src/openapi/interactions-decisions-openapi.json`
   - `src/openapi/README-decisions.md`
5. **Regenerate and verify types**:
   ```bash
   pnpm run typegen
   pnpm run typegen:check
   ```
