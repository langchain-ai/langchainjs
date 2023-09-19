import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

export const run = async () => {
  const template = "What is a good name for a company that makes {product}?";
  const promptA = new PromptTemplate({ template, inputVariables: ["product"] });

  // The `formatPromptValue` method returns a `PromptValue` object that can be used to format the prompt as a string or a list of `ChatMessage` objects.
  const responseA = await promptA.formatPromptValue({
    product: "colorful socks",
  });
  const responseAString = responseA.toString();
  console.log({ responseAString });
  /*
    {
        responseAString: 'What is a good name for a company that makes colorful socks?'
    }
    */

  const responseAMessages = responseA.toChatMessages();
  console.log({ responseAMessages });
  /*
    {
        responseAMessages: [
            HumanMessage {
                text: 'What is a good name for a company that makes colorful socks?'
            }
        ]
    }
    */

  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant that translates {input_language} to {output_language}."
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  // `formatPromptValue` also works with `ChatPromptTemplate`.
  const responseB = await chatPrompt.formatPromptValue({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });
  const responseBString = responseB.toString();
  console.log({ responseBString });
  /*
    {
        responseBString: '[{"text":"You are a helpful assistant that translates English to French."},{"text":"I love programming."}]'
    }
    */

  const responseBMessages = responseB.toChatMessages();
  console.log({ responseBMessages });
  /*
    {
        responseBMessages: [
            SystemMessage {
                text: 'You are a helpful assistant that translates English to French.'
            },
            HumanMessage { text: 'I love programming.' }
        ]
    }
    */
};
