# LangChain google-common

This package contains common resources to access Google AI/ML models
and other Google services in an auth-independent way.

AI/ML models are supported using the same interface no matter if
you are using the Google AI Studio-based version of the model or
the Google Cloud Vertex AI version of the model.

## Installation

This is **not** a stand-alone package since it does not contain code to do
authorization.

Instead, you should install *one* of the following packages:
* @langchain/google-gauth
* @langchain/google-webauth

See those packages for details about installation.

This package does **not** depend on any Google library. Instead, it relies on
REST calls to Google endpoints. This is deliberate to reduce (sometimes
conflicting) dependencies and make it usable on platforms that do not include
file storage.


## Google services supported

* Gemini model through LLM and Chat classes (both through Google AI Studio and 
  Google Cloud Vertex AI). Including:
  * Function/Tool support 


## TODO

Tasks and services still to be implemented:

* PaLM Vertex AI support and backwards compatibility
* PaLM MakerSuite support and backwards compatibility
* Semantic Retrieval / AQA model
* PaLM embeddings
* Gemini embeddings
* Multimodal embeddings
* Vertex AI Search
* Vertex AI Model Garden
  * Online prediction endpoints
    * Gemma
  * Google managed models
    * Claude
* AI Studio Tuned Models
* MakerSuite / Google Drive Hub
* Google Cloud Vector Store