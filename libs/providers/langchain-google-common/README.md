# LangChain google-common

This package contains common resources to access Google AI/ML models
and other Google services in an auth-independent way.

AI/ML models are supported using the same interface no matter if
you are using the Google AI Studio-based version of the model or
the Google Cloud Vertex AI version of the model.

## Installation

This is **not** a stand-alone package since it does not contain code to do
authorization.

Instead, you should install _one_ of the following packages:

- @langchain/google-gauth
- @langchain/google-webauth

See those packages for details about installation.

This package does **not** depend on any Google library. Instead, it relies on
REST calls to Google endpoints. This is deliberate to reduce (sometimes
conflicting) dependencies and make it usable on platforms that do not include
file storage.

## Google services supported

- Gemini model through LLM and Chat classes (both through Google AI Studio and
  Google Cloud Vertex AI). Including:
  - Function/Tool support

## Known Limitations

### Tool/Function Schema Limitations

Tool schemas using `anyOf` are supported, including MCP schemas and Zod object unions. Simple nullable unions are converted to `nullable: true`.

The following limitations still apply:

- **Union types encoded as a `type` array** (for example, Zod 3 `z.union([z.string(), z.number()])`) - Use an `anyOf` schema instead. A single type combined with `null` is supported.
- **`oneOf` schemas** - Only simple nullable unions are supported. Use `anyOf` when its semantics fit your schema.
- **Positive Refinement** (`z.number().positive()`) - Automatically converted to `z.number().min(0.01)`

For detailed examples and workarounds, see the Tool Schema Limitations section in the @langchain/google-vertexai or @langchain/google-genai package documentation.

## Planned Features

Tasks and services that may be implemented in the future:

- Gemini embeddings
- Multimodal embeddings
- Vertex AI Search
- Vertex AI Model Garden
  - Online prediction endpoints
    - Gemma
  - Google managed models
    - Claude
- AI Studio Tuned Models
- Google Cloud Vector Store
