# LangChain google-vertexai-web

This package contains resources to access Google AI/ML models
and other Google services via Vertex AI. Authorization to these
services use either an API Key or service account credentials
that are included in an environment variable.

If you are running this on the Google Cloud Platform, or in a way
where service account credentials can be stored on a file system,
consider using the @langchain/google-vertexai
package _instead_. You do not need to use both packages. See the
section on **Authorization** below.

## Installation

```bash
$ pnpm install @langchain/google-vertexai-web
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
4. The Service Account credentials that are saved directly into the
   `GOOGLE_WEB_CREDENTIALS`
5. The Service Account credentials that are saved directly into the
   `GOOGLE_VERTEX_AI_WEB_CREDENTIALS` (deprecated)

## LangSmith gateway

Set `LANGSMITH_GATEWAY=true` and `LANGSMITH_GATEWAY_API_KEY` to route
`ChatVertexAI` through the gateway's `/vertex` endpoint. The gateway key falls
back to `LANGSMITH_API_KEY`. Set `LANGSMITH_GATEWAY` to a custom gateway root URL
to use a different host or path prefix.

```typescript
import { ChatVertexAI } from "@langchain/google-vertexai-web";

const model = new ChatVertexAI({ model: "gemini-2.5-flash" });
const response = await model.invoke("Hello!");
console.log(response.content);
```

Vertex Express requests do not require Google web credentials when a gateway API
key is configured. To preserve project and regional routing, pass service-account
credentials in `authOptions.credentials` and a `location`. The project ID comes
from those credentials, but requests use the selected API key rather than Google
OAuth. An explicit `apiKey` takes precedence over the gateway key. An explicit
`endpoint` opts out of automatic gateway routing and gateway-key selection.

Keep gateway API keys in trusted server or edge runtimes, not public browser
bundles.
