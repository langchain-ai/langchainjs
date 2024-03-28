# LangChain google-vertexai

This package contains resources to access Google AI/ML models
and other Google services via Vertex AI. Authorization to these
services use service account credentials stored on the local
file system or provided through the Google Cloud Platform
environment it is running on.

If you are running this on a platform where the credentials cannot
be provided this way, consider using the @langchain/google-vertexai-web
package *instead*. You do not need to use both packages. See the
section on **Authorization** below.


## Installation

```bash
$ yarn add @langchain/google-vertexai
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

