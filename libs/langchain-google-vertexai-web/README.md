# LangChain google-vertexai-web

This package contains resources to access Google AI/ML models
and other Google services via Vertex AI. Authorization to these
services use either an API Key or service account credentials
that are included in an environment variable.

If you are running this on the Google Cloud Platform, or in a way
where service account credentials can be stored on a file system,
consider using the @langchain/google-vertexai
package *instead*. You do not need to use both packages. See the
section on **Authorization** below.


## Installation

```bash
$ yarn add @langchain/google-vertexai-web
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

