# @langchain/oci-genai

Oracle Cloud Infrastructure (OCI) Generative AI is a fully managed
service that provides a set of state-of-the-art, customizable large
language models (LLMs) that cover a wide range of use cases, and which
is available through a single API. Using the OCI Generative AI service
you can access ready-to-use pretrained models, or create and host your
own fine-tuned custom models based on your own data on dedicated AI
clusters. Detailed documentation of the service and API is available
[here](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm)
and
[here](https://docs.oracle.com/en-us/iaas/api/#/en/generative-ai/20231130/).

This package enables you to use OCI Generative AI in your LangChainJS applications.

## Prerequisites

In order to use this integration you will need the following:

1. An OCI
   tenancy. If you do not already have and account, please create one
   [here](https://signup.cloud.oracle.com?sourceType=:ex:of:::::LangChainJSIntegration&SC=:ex:of:::::LangChainJSIntegration&pcode=). 2. Setup an [authentication
   method](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm)
   (Using a [configuration
   file](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm)
   with [API Key
   authentication](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/apisigningkey.htm#apisigningkey_topic_How_to_Generate_an_API_Signing_Key_Console)
   is the simplest to start with). 3. Please make sure that your OCI
   tenancy is registered in one of the [supported
   regions](https://docs.oracle.com/en-us/iaas/Content/generative-ai/overview.htm#regions). 4. You will need the ID (aka OCID) of a compartment in which your OCI
   user has [access to use the Generative AI
   service](https://docs.oracle.com/en-us/iaas/Content/generative-ai/iam-policies.htm).
   You can either use the `root` compartment or [create your
   own](https://docs.oracle.com/en-us/iaas/Content/Identity/compartments/To_create_a_compartment.htm). 5. Retrieve the desired model name from the [available
   models](https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm)
   list (please make sure not to select a deprecated model).

## Installation

The integration makes use of the [OCI TypeScript
SDK](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/typescriptsdk.htm).
To install the integration dependencies, execute the following:

```bash npm2yarn
npm install oci-common oci-generativeaiinference @langchain/core @langchain/oci-genai
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate field to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/oci-genai": "^0.0.0"
  },
  "resolutions": {
    "@langchain/core": "^0.3.0"
  },
  "overrides": {
    "@langchain/core": "^0.3.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^0.3.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Instantiation

The OCI Generative AI service supports two groups of LLMs: 1. Cohere
family of LLMs. 2. Generic family of LLMs which include model such as
Llama.

The following code demonstrates how to create an instance for each of
the families. The only mandatory two parameters are: 1.
`compartmentId` - A compartment OCID in which the user you are using for
authentication was granted permissions to access the Generative AI
service. 2. `onDemandModelId` or `dedicatedEndpointId` - Either a
[pre-trained
model](https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm)
name/OCID or a dedicated endpoint OCID for an endpoint configured on a
[dedicated AI cluster
(DAC)](https://docs.oracle.com/en-us/iaas/Content/generative-ai/ai-cluster.htm).
Either `onDemandModelId` or `dedicatedEndpointId` must be provided but
not both.

In this example, since no other parameters are specified, a default SDK
client will be created with the following configuration: 1.
Authentication will be attempted using a [configuration
file](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm)
which should be already setup and available under `~/.oci/config`. The
`config` file is expected to contain a `DEFAULT` profile with the
correct information. Please see the prerequisites for more information. 2. The retry strategy will be set to a single attempt. If the first API
call was not successful, the request will fail. 3. The region will be
set to `us-chicago-1`. Please make sure that your tenancy is registered
this region.

```ts
import { OciGenAiCohereChat, OciGenAiGenericChat } from "@langchain/oci-genai";

const cohereLlm = new OciGenAiCohereChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "cohere.command-r-plus-08-2024",
  // dedicatedEndpointId: "oci.dedicatedendpoint..."
});

const genericLlm = new OciGenAiGenericChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "meta.llama-3.3-70b-instruct",
  // dedicatedEndpointId: "oci.dedicatedendpoint..."
});
```

## SDK client options

The above example used default values to create the SDK client behind
the scenes. If you need more control in the creation of the client, here
are additional options (the options are the same for
`OciGenAiCohereChat` and `OciGenAiGenericChat`).

The first example will create an SDK client with the following
configuration: 1. [Instance Principal
authentication](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm#sdk_authentication_methods_instance_principaldita).
Please note that this authentication method requires
[configuration](https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm). 2. Using the Sao Paulo region. 3. Up to 3 attempts will be made in case
API calls fail.

```ts
import { MaxAttemptsTerminationStrategy, Region } from "oci-common";
import {
  OciGenAiCohereChat,
  OciGenAiNewClientAuthType,
} from "@langchain/oci-genai";

const cohereLlm = new OciGenAiCohereChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "cohere.command-r-plus-08-2024",
  newClientParams: {
    authType: OciGenAiNewClientAuthType.InstancePrincipal,
    regionId: Region.SA_SAOPAULO_1.regionId,
    clientConfiguration: {
      retryConfiguration: {
        terminationStrategy: new MaxAttemptsTerminationStrategy(3),
      },
    },
  },
});
```

The second example will create an SDK client with the following
configuration: 1. Config file authentication. 1. Use the config file:
`/my/path/config`. 1. Use the details under the
`MY_PROFILE_IN_CONFIG_FILE` profile in the specified config file. 1. The
retry strategy will be set to a single attempt. If the first API call
was not successful, the request will fail. 1. The region will be set to
`us-chicago-1`. Please make sure that your tenancy is registered this
region.

```ts
import { OciGenAiCohereChat } from "@langchain/community/chat_models/oci_genai/cohere_chat";
import { OciGenAiNewClientAuthType } from "@langchain/community/chat_models/oci_genai/types";

const cohereLlm = new OciGenAiCohereChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "cohere.command-r-plus-08-2024",
  newClientParams: {
    authType: OciGenAiNewClientAuthType.ConfigFile,
    authParams: {
      clientConfigFilePath: "/my/path/config",
      clientProfile: "MY_PROFILE_IN_CONFIG_FILE",
    },
  },
});
```

The third example will create an SDK client with the following
configuration: 1. Config file authentication. 1. Use [Resource
Principal](https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm#sdk_authentication_methods_resource_principal)
authentication. 1. The retry strategy will be set to a single attempt.
If the first API call was not successful, the request will fail. 1. The
region will be set to `us-chicago-1`. Please make sure that your tenancy
is registered this region.

```ts
import { ResourcePrincipalAuthenticationDetailsProvider } from "oci-common";
import {
  OciGenAiCohereChat,
  OciGenAiNewClientAuthType,
} from "@langchain/oci-genai";

const cohereLlm = new OciGenAiCohereChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "cohere.command-r-plus-08-2024",
  newClientParams: {
    authType: OciGenAiNewClientAuthType.Other,
    authParams: {
      authenticationDetailsProvider:
        ResourcePrincipalAuthenticationDetailsProvider.builder(),
    },
  },
});
```

You can also instantiate the OCI Generative AI chat classes using
`GenerativeAiInferenceClient` that you create on your own. This way you
control the creation and configuration of the client to suit your
specific needs:

```ts
import { ConfigFileAuthenticationDetailsProvider } from "oci-common";
import { GenerativeAiInferenceClient } from "oci-generativeaiinference";
import { OciGenAiCohereChat } from "@langchain/community/chat_models/oci_genai/cohere_chat";

const client = new GenerativeAiInferenceClient({
  authenticationDetailsProvider: new ConfigFileAuthenticationDetailsProvider(),
});

const cohereLlm = new OciGenAiCohereChat({
  compartmentId: "oci.compartment...",
  onDemandModelId: "cohere.command-r-plus-08-2024",
  client,
});
```

## Invocation

In this example, we make a simple call to the OCI Generative AI service
while leveraging the power of the `cohere.command-r-plus-08-2024` model.
Please note that you can pass additional request parameters under the
`requestParams` key as shown in the `invoke` call below. For more
information please see the [Cohere request
parameters](https://docs.oracle.com/en-us/iaas/api/#/en/generative-ai-inference/20231130/datatypes/CohereChatRequest)
(the `apiFormat`, `chatHistory`, `isStream`, `message` & `stopSequences`
parameters are automatically generated or inferred from the call
context) and the [Generic request
parameters](https://docs.oracle.com/en-us/iaas/api/#/en/generative-ai-inference/20231130/datatypes/GenericChatRequest)
(the `apiFormat`, `isStream`, `messages` & `stop` parameters are
automatically generated or inferred from the call context).

If you wish to specify the chat history for a Cohere request, the list
of messages passed into the request will be analyzed and split into the
current message and history messages. The last `Human` message sent in
the list (regardless of it’s position in the list) will be considered as
the `message` parameter for the request and the rest of the messages
will be added to the `chatHistory` parameter. If there are more than one
`Human` messages, the very last one will be considered as the `message`
to be sent to the LLM in the current request and the other will be
appended to the `chatHistory`.

```ts
import { OciGenAiCohereChat } from "@langchain/oci-genai";

(async () => {
  const llm = new OciGenAiCohereChat({
    compartmentId: "oci.compartment...",
    onDemandModelId: "cohere.command-r-plus-08-2024",
  });

  const result = await llm.invoke("Tell me a joke about beagles", {
    requestParams: {
      temperature: 1,
      maxTokens: 300,
    },
  });

  console.log(result);
})();
```

AIMessage { “content”: “Why did the beagle cross the road?he was tied to
the chicken!hope you enjoyed the joke! Would you like to hear another
one?”, “additional_kwargs”: {}, “response_metadata”: {}, “tool_calls”:
\[\], “invalid_tool_calls”: \[\] }

## Additional information

For additional information, please checkout the [OCI Generative AI
service
documentation](https://docs.oracle.com/en-us/iaas/Content/generative-ai/home.htm).

If you are interested in the python version of this integration, you can
find more information
[here](https://python.langchain.com/docs/integrations/llms/oci_generative_ai/).

## Related

- Chat model [conceptual guide](/docs/concepts/#chat-models)
- Chat model [how-to guides](/docs/how_to/#chat-models)
