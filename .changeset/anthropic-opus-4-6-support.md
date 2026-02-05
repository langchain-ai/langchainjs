---
"@langchain/anthropic": patch
---

feat(anthropic): add Claude Opus 4.6 support with adaptive thinking, effort parameter, compaction API, output_config migration, inference_geo, and structured outputs GA

- Upgrade `@anthropic-ai/sdk` from `^0.71.0` to `^0.73.0`
- Add `claude-opus-4-6` model with 16384 default max output tokens
- Support adaptive thinking (`thinking: { type: "adaptive" }`) recommended for Opus 4.6
- Add `outputConfig` parameter with effort levels (`low`, `medium`, `high`, `max`) for controlling token usage
- Migrate `outputFormat` to `outputConfig.format` (backwards compatible, `outputFormat` deprecated)
- Add compaction API support (beta) with auto-detection of `compact_20260112` edits and streaming handlers for compaction content blocks
- Add `inferenceGeo` parameter for data residency controls
- Remove structured-outputs beta header requirement (now GA)
