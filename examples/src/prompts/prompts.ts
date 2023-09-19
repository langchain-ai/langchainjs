import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";

export const run = async () => {
  // A `PromptTemplate` consists of a template string and a list of input variables.
  const template = "What is a good name for a company that makes {product}?";
  const promptA = new PromptTemplate({ template, inputVariables: ["product"] });

  // We can use the `format` method to format the template with the given input values.
  const responseA = await promptA.format({ product: "colorful socks" });
  console.log({ responseA });
  /*
  {
    responseA: 'What is a good name for a company that makes colorful socks?'
  }
  */

  // We can also use the `fromTemplate` method to create a `PromptTemplate` object.
  const promptB = PromptTemplate.fromTemplate(
    "What is a good name for a company that makes {product}?"
  );
  const responseB = await promptB.format({ product: "colorful socks" });
  console.log({ responseB });
  /*
  {
    responseB: 'What is a good name for a company that makes colorful socks?'
  }
  */

  // For chat models, we provide a `ChatPromptTemplate` class that can be used to format chat prompts.
  const chatPrompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(
      "You are a helpful assistant that translates {input_language} to {output_language}."
    ),
    HumanMessagePromptTemplate.fromTemplate("{text}"),
  ]);

  // The result can be formatted as a string using the `format` method.
  const responseC = await chatPrompt.format({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });
  console.log({ responseC });
  /*
  {
    responseC: '[{"text":"You are a helpful assistant that translates English to French."},{"text":"I love programming."}]'
  }
  */

  // The result can also be formatted as a list of `ChatMessage` objects by returning a `PromptValue` object and calling the `toChatMessages` method.
  // More on this below.
  const responseD = await chatPrompt.formatPromptValue({
    input_language: "English",
    output_language: "French",
    text: "I love programming.",
  });
  const messages = responseD.toChatMessages();
  console.log({ messages });
  /*
  {
    messages: [
        SystemMessage {
          text: 'You are a helpful assistant that translates English to French.'
        },
        HumanMessage { text: 'I love programming.' }
      ]
  }
  */
};
