---
hide_table_of_contents: true
---

import CodeBlock from "@theme/CodeBlock";
import Example from "@examples/agents/aiplugin-tool.ts";

# ChatGPT Plugins

This example shows how to use ChatGPT Plugins within LangChain abstractions.

Note 1: This currently only works for plugins with no auth.

Note 2: There are almost certainly other ways to do this, this is just a first pass. If you have better ideas, please open a PR!

<CodeBlock language="typescript">{Example}</CodeBlock>

````
Entering new agent_executor chain...
Thought: Klarna is a payment provider, not a store. I need to check if there is a Klarna Shopping API that I can use to search for t-shirts.
Action:
```

{
"action": "KlarnaProducts",
"action_input": ""
}

```

Usage Guide: Use the Klarna plugin to get relevant product suggestions for any shopping or researching purpose. The query to be sent should not include stopwords like articles, prepositions and determinants. The api works best when searching for words that are related to products, like their name, brand, model or category. Links will always be returned and should be shown to the user.

OpenAPI Spec: {"openapi":"3.0.1","info":{"version":"v0","title":"Open AI Klarna product Api"},"servers":[{"url":"https://www.klarna.com/us/shopping"}],"tags":[{"name":"open-ai-product-endpoint","description":"Open AI Product Endpoint. Query for products."}],"paths":{"/public/openai/v0/products":{"get":{"tags":["open-ai-product-endpoint"],"summary":"API for fetching Klarna product information","operationId":"productsUsingGET","parameters":[{"name":"q","in":"query","description":"query, must be between 2 and 100 characters","required":true,"schema":{"type":"string"}},{"name":"size","in":"query","description":"number of products returned","required":false,"schema":{"type":"integer"}},{"name":"budget","in":"query","description":"maximum price of the matching product in local currency, filters results","required":false,"schema":{"type":"integer"}}],"responses":{"200":{"description":"Products found","content":{"application/json":{"schema":{"$ref":"#/components/schemas/ProductResponse"}}}},"503":{"description":"one or more services are unavailable"}},"deprecated":false}}},"components":{"schemas":{"Product":{"type":"object","properties":{"attributes":{"type":"array","items":{"type":"string"}},"name":{"type":"string"},"price":{"type":"string"},"url":{"type":"string"}},"title":"Product"},"ProductResponse":{"type":"object","properties":{"products":{"type":"array","items":{"$ref":"#/components/schemas/Product"}}},"title":"ProductResponse"}}}}
Now that I know there is a Klarna Shopping API, I can use it to search for t-shirts. I will make a GET request to the API with the query parameter "t-shirt".
Action:
```

{
"action": "requests_get",
"action_input": "https://www.klarna.com/us/shopping/public/openai/v0/products?q=t-shirt"
}

```


{"products":[{"name":"Psycho Bunny Mens Copa Gradient Logo Graphic Tee","url":"https://www.klarna.com/us/shopping/pl/cl10001/3203663222/Clothing/Psycho-Bunny-Mens-Copa-Gradient-Logo-Graphic-Tee/?source=openai","price":"$35.00","attributes":["Material:Cotton","Target Group:Man","Color:White,Blue,Black,Orange"]},{"name":"T-shirt","url":"https://www.klarna.com/us/shopping/pl/cl10001/3203506327/Clothing/T-shirt/?source=openai","price":"$20.45","attributes":["Material:Cotton","Target Group:Man","Color:Gray,White,Blue,Black,Orange"]},{"name":"Palm Angels Bear T-shirt - Black","url":"https://www.klarna.com/us/shopping/pl/cl10001/3201090513/Clothing/Palm-Angels-Bear-T-shirt-Black/?source=openai","price":"$168.36","attributes":["Material:Cotton","Target Group:Man","Color:Black"]},{"name":"Tommy Hilfiger Essential Flag Logo T-shirt","url":"https://www.klarna.com/us/shopping/pl/cl10001/3201840629/Clothing/Tommy-Hilfiger-Essential-Flag-Logo-T-shirt/?source=openai","price":"$22.52","attributes":["Material:Cotton","Target Group:Man","Color:Red,Gray,White,Blue,Black","Pattern:Solid Color","Environmental Attributes :Organic"]},{"name":"Coach Outlet Signature T Shirt","url":"https://www.klarna.com/us/shopping/pl/cl10001/3203005573/Clothing/Coach-Outlet-Signature-T-Shirt/?source=openai","price":"$75.00","attributes":["Material:Cotton","Target Group:Man","Color:Gray"]}]}
Finished chain.
{
  result: {
    output: 'The available t-shirts in Klarna are Psycho Bunny Mens Copa Gradient Logo Graphic Tee, T-shirt, Palm Angels Bear T-shirt - Black, Tommy Hilfiger Essential Flag Logo T-shirt, and Coach Outlet Signature T Shirt.',
    intermediateSteps: [ [Object], [Object] ]
  }
}
````
