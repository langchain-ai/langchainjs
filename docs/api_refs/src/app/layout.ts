import { Metadata } from "next";

const DESCRIPTION_COPY = "API documentation for LangChain.js";
const TITLE_COPY = "LangChain JS/TS API Refs";
const URL = "https://api.js.langchain.com";

// either Static metadata
export const metadata: Metadata = {
  title: TITLE_COPY,
  description: DESCRIPTION_COPY,
  twitter: {
    card: "summary",
    description: DESCRIPTION_COPY,
    title: TITLE_COPY,
    site: URL,
  },
  openGraph: {
    type: "website",
    description: DESCRIPTION_COPY,
    title: TITLE_COPY,
    url: URL,
    siteName: TITLE_COPY,
  },
};
