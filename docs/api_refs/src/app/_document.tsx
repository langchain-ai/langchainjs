// pages/_document.js
import Document, { Html, Head, Main, NextScript } from "next/document";

const DESCRIPTION_COPY = "API documentation for LangChain.js";

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="description" content={DESCRIPTION_COPY} />
          <meta property="og:description" content={DESCRIPTION_COPY} />
          <meta name="twitter:description" content={DESCRIPTION_COPY} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
