---
"@langchain/typesafe": patch
---

refactor(typesafe): deprecate experimental middleware

- Deprecate `autoModeMiddleware` and `modelRouterMiddleware` from `@langchain/typesafe/middleware`. They warn once when called and will be removed in 0.2.0
- Use `autoModeMiddleware` and `modelRouterMiddleware` from `langchain` with `classifier: new TypeSafeClassifier()` instead
