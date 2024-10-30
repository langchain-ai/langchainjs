// eslint-disable-next-line no-unused-vars
import React from "react";

function RedirectAnchors() {
  if (typeof window === "undefined") return null;

  // get # anchor from url
  const lookup = {
    "#conceptual-guide": "/docs/concepts",
    "#architecture": "/docs/concepts/architecture",
    "#langchaincore": "/docs/concepts/architecture/#langchaincore",
    "#langchain": "/docs/concepts/architecture/#langchain",
    "#langchaincommunity": "/docs/concepts/architecture/#langchaincommunity",
    "#partner-packages": "/docs/concepts/architecture/#integration-packages",
    "#langgraph": "/docs/concepts/architecture/#langchianlanggraph",
    "#langsmith": "/docs/concepts/architecture/#langsmith",
    "#langchain-expression-language-lcel": "/docs/concepts/lcel",
    "#langchain-expression-language": "/docs/concepts/lcel",
    "#runnable-interface": "/docs/concepts/runnables",
    "#components": "/docs/concepts/",
    "#chat-models": "/docs/concepts/chat_models",
    "#multimodality": "/docs/concepts/multimodality",
    "#llms": "/docs/concepts/chat_models",
    "#messages": "/docs/concepts/messages",
    "#message-types": "/docs/concepts/messages",
    "#humanmessage": "/docs/concepts/messages/#humanmessage",
    "#aimessage": "/docs/concepts/messages/#aimessage",
    "#systemmessage": "/docs/concepts/messages/#systemmessage",
    "#toolmessage": "/docs/concepts/messages/#toolmessage",
    "#legacy-functionmessage":
      "/docs/concepts/messages/#legacy-functionmessage",
    "#prompt-templates": "/docs/concepts/prompt_templates",
    "#string-prompttemplates": "/docs/concepts/prompt_templates",
    "#chatprompttemplates": "/docs/concepts/prompt_templates",
    "#messagesplaceholder": "/docs/concepts/prompt_templates",
    "#example-selectors": "/docs/concepts/example_selectors",
    "#output-parsers": "/docs/concepts/output_parsers",
    "#chat-history": "/docs/concepts/chat_history",
    "#documents":
      "https://api.js.langchain.com/classes/_langchain_core.documents.Document.html",
    "#document":
      "https://api.js.langchain.com/classes/_langchain_core.documents.Document.html",
    "#document-loaders": "/docs/concepts/document_loaders",
    "#text-splitters": "/docs/concepts/text_splitters",
    "#embedding-models": "/docs/concepts/embedding_models",
    "#vector-stores": "/docs/concepts/vectorstores",
    "#vectorstore": "/docs/concepts/vectorstores",
    "#retrievers": "/docs/concepts/retrievers",
    "#keyvalue-stores": "/docs/concepts/key_value_stores",
    "#interface": "/docs/concepts/runnables",
    "#tools": "/docs/concepts/tools",
    "#invoke-with-just-the-arguments": "/docs/concepts/tools",
    "#invoke-with-toolcall": "/docs/concepts/tools",
    "#best-practices": "/docs/concepts/tools/#best-practices",
    "#related": "/docs/concepts/tools",
    "#toolkits": "/docs/concepts/toosl/#toolkits",
    "#initialize-a-toolkit": "/docs/concepts/toosl/#toolkits",
    "#get-list-of-tools": "/docs/concepts/toosl/#toolkits",
    "#agents": "/docs/concepts/agents",
    "#react-agents": "/docs/concepts/agents",
    "#callbacks": "/docs/concepts/callbacks",
    "#callback-events": "/docs/concepts/callbacks/#callback-events",
    "#callback-handlers": "/docs/concepts/callbacks/#callback-handlers",
    "#passing-callbacks": "/docs/concepts/callbacks/#passing-callbacks",
    "#techniques": "/docs/concepts/",
    "#streaming": "/docs/concepts/streaming",
    "#stream": "/docs/concepts/streaming#stream",
    "#streamevents": "/docs/concepts/streaming#streamevents",
    "#tokens": "/docs/concepts/tokens",
    "#functiontool-calling": "/docs/concepts/tool_calling",
    "#tool-usage": "/docs/concepts/tool_calling",
    "#structured-output": "/docs/concepts/structured_outputs",
    "#withstructuredoutput": "/docs/concepts/structured_outputs",
    "#raw-prompting": "/docs/concepts/structured_outputs",
    "#json-mode": "/docs/concepts/structured_outputs/#json-mode",
    "#tool-calling-structuredoutputtoolcalling":
      "/docs/concepts/structured_outputs",
    "#fewshot-prompting": "/docs/concepts/few_shot_prompting",
    "#1-generating-examples":
      "/docs/concepts/few_shot_prompting/#1-generating-examples",
    "#2-number-of-examples":
      "/docs/concepts/few_shot_prompting/#2-number-of-examples",
    "#3-selecting-examples":
      "/docs/concepts/few_shot_prompting/#3-selecting-examples",
    "#4-formatting-examples":
      "/docs/concepts/few_shot_prompting/#4-formatting-examples",
    "#retrieval": "/docs/concepts/retrieval",
    "#query-translation": "/docs/concepts/retrieval/#query-re-writing",
    "#routing": "/docs/concepts/",
    "#query-construction": "/docs/concepts/retrieval/#query-construction",
    "#indexing": "/docs/concepts/retrieval/",
    "#postprocessing": "/docs/concepts/retrieval/",
    "#generation": "/docs/concepts/rag",
    "#text-splitting": "/docs/concepts/text_splitting",
    "#evaluation": "/docs/concepts/evaluation",
    "#tracing": "/docs/concepts/tracing",
    "#few-shot-prompting": "/docs/concepts/few_shot_prompting",
  };

  const hash = window?.location?.hash;
  if (hash) {
    if (lookup[hash]) {
      window.location.href = lookup[hash];
      return null;
    }
  }

  return null;
}

export default RedirectAnchors;
