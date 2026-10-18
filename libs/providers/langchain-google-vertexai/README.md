# LangChain google-vertexai

This package contains resources to access Google AI/ML models
and other Google services via Vertex AI. Authorization to these
services use service account credentials stored on the local
file system or provided through the Google Cloud Platform
environment it is running on.

If you are running this on a platform where the credentials cannot
be provided this way, consider using the @langchain/google-vertexai-web
package _instead_. You do not need to use both packages. See the
section on **Authorization** below.

## Installation

```bash
$ pnpm install @langchain/google-vertexai
```

## Authorization

Authorization is done through a Google Cloud Service Account.

To handle service accounts, this package uses the `google-auth-library`
package, and you may wish to consult the documentation for that library
about how it does so. But in short, classes in this package will use
credentials from the first of the following that apply:

1. An API Key that is passed to the constructor using the `apiKey` attribute
2. Credentials that are passed to the constructor using the `authInfo` attribute
3. An API Key that is set in the environment variable `API_KEY`
4. The Service Account credentials that are saved in a file. The path to
   this file is set in the `GOOGLE_APPLICATION_CREDENTIALS` environment
   variable.
5. If you are running on a Google Cloud Platform resource, or if you have
   logged in using `gcloud auth application-default login`, then the
   default credentials.

## Tool Schema Limitations

Tool schemas using `anyOf` are supported, including MCP schemas and Zod discriminated unions. Simple nullable unions are converted to `nullable: true`.

### Unsupported Schema Features

1. **Union types encoded as a `type` array** - For example, Zod 3 `z.union([z.string(), z.number()])` emits a type array. Use an `anyOf` JSON schema instead. A single type combined with `null` is supported.

2. **`oneOf` schemas** - Only simple nullable unions are supported. Use `anyOf` when its semantics fit your schema.

3. **Positive Refinement** - `.positive()` is automatically converted

   ```typescript
   // ⚠️ This is automatically converted to .min(0.01)
   z.number().positive();

   // ✅ Prefer using .min() directly
   z.number().min(0.01);
   ```

### Error Messages

If you use unsupported schema features, you'll receive descriptive error messages:

- For type arrays: `"Gemini cannot handle union types"`
- For unsupported `oneOf` schemas: `"Gemini cannot handle oneOf schemas"`
- For tool conversion failures: `"Failed to convert tool '[toolName]' schema for Gemini"`

### Best Practices

1. Use simple, flat object structures when possible
2. Use `anyOf` for schemas that accept multiple types
3. Use `.min()` instead of `.positive()` for number constraints
4. Test your tool schemas before deploying to production
