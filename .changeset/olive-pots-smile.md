---
"@langchain/google": patch
---

Fix service account authentication on the Node client. `NodeApiClient.fetch` interpolated the unresolved access token promise, sending `Bearer [object Promise]`, and the JWT it exchanges carried no `scope` claim, which Google requires on the assertion for an access token request. Credentials supplied through `GOOGLE_CLOUD_CREDENTIALS` now reach Vertex AI instead of failing with invalid credentials and then an invalid scope error.
