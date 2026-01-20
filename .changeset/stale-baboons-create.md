---
"@langchain/community": patch
---

Add multi-region support for Alibaba Tongyi chat models. Users can now specify their region (China, Singapore, or US) when initializing ChatAlibabaTongyi. This enables proper API endpoint routing for users with region-specific API keys.

- Added `region` parameter to ChatAlibabaTongyi constructor
- Supported regions: `"china"` (default), `"singapore"`, `"us"`
- Maintains backward compatibility by defaulting to China region
