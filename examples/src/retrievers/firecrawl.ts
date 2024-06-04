import { FirecrawlRetriever } from "@langchain/firecrawl";
import FirecrawlApp from "@mendable/firecrawl-js";

const retriever = new FirecrawlRetriever({
  // @ts-expect-error Some TS Config's will cause this to give a TypeScript error, even though it works.
  client: new FirecrawlApp(
    process.env.FIRECRAWL_API_KEY // default API key
  ),
});

const retrievedDocs = await retriever.invoke(
  "What did the speaker say about Justice Breyer in the 2022 State of the Union?"
);
console.log(retrievedDocs);


/*
[
  Document {
    pageContent: "\n\n[The White House\\\n\\\nThe White House](https://www.whitehouse.gov/)\n\n[The White House](https://www.whitehouse.gov/)\n\n*   [Home](https://www.whitehouse.gov/)\n    \n\n*   [Administration](https://www.whitehouse.gov/administration/)\n    \n*   [Priorities](https://www.whitehouse.gov/priorities/)\n...",
    metadata: {
      title: "2022 State of the Union Address | The White House\n\t\tScroll to Top\t",
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      ogTitle: "2022 State of the Union Address | The White House",
      ogDescription: "President Biden’s State of the Union Address Madam Speaker, Madam Vice President, and our First Lady and Second Gentleman, members of Congress and the Cabinet, Justices of the Supreme Court, my fellow Americans: Last year, COVID-19 kept us apart. This year, we’re finally together again.",
      ogUrl: "https://www.whitehouse.gov/state-of-the-union-2022/",
      ogImage: "https://www.whitehouse.gov/wp-content/uploads/2022/02/YouTube-Thumbnail_SOTU-1_1280x720_Digital_021822_v2.png",
      ogLocale: "en_US",
      ogLocaleAlternate: [],
      ogSiteName: "The White House",
      modifiedTime: "2022-03-03T00:25:18+00:00",
      sourceURL: "https://www.whitehouse.gov/state-of-the-union-2022/"
    }
  },
  Document {
    pageContent: "\n\n[The White House\\\n\\\nThe White House](https://www.whitehouse.gov/)\n\n[The White House](https://www.whitehouse.gov/)\n\n*   [Home](https://www.whitehouse.gov/)\n    \n\n*   [Administration](https://www.whitehouse.gov/administration/)\n    \n*   [Priorities](https://www.whitehouse.gov/priorities/)\n    \n*   [The Record](https://www.whitehouse.gov/therecord/)\n    \n*...",
    metadata: {
      title: "Remarks of President Joe Biden – State of the Union Address As Prepared for Delivery | The White House\n\t\tScroll to Top\t",
      robots: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
      ogTitle: "Remarks of President Joe Biden – State of the Union Address As Prepared for Delivery | The White House",
      ogDescription: "United States Capitol Madam Speaker, Madam Vice President, our First Lady and Second Gentleman. Members of Congress and the Cabinet. Justices of the Supreme Court. My fellow Americans.   Last year COVID-19 kept us apart. This year we are finally together again.  Tonight, we meet as Democrats Republicans and Independents. But most importantly as Americans.  With a duty to one…",
      ogUrl: "https://www.whitehouse.gov/briefing-room/speeches-remarks/2022/03/01/remarks-of-president-joe-biden-state-of-the-union-address-as-delivered/",
      ogImage: "https://www.whitehouse.gov/wp-content/uploads/2021/01/wh_social-share.png",
      ogLocale: "en_US",
      ogLocaleAlternate: [],
      ogSiteName: "The White House",
      modifiedTime: "2022-03-02T02:16:56+00:00",
      publishedTime: "2022-03-02T02:11:06+00:00",
      sourceURL: "https://www.whitehouse.gov/briefing-room/speeches-remarks/2022/03/01/remarks-of-president-joe-biden-state-of-the-union-address-as-delivered/"
    }
  },
  Document {
    pageContent: "Biden Honors Justice Breyer During State of the Union Address\n\nSearch\n\nWatch later\n\nShare\n\nCopy link\n\nInfo\n\nShopping\n\nTap to unmute\n\n2x\n\nIf playback doesn't begin shortly, try restarting your device.\n\n•\n\nUp next\n\nLive\n\nUpcoming\n\nCancelPlay Now\n\n[Bloomberg Quicktake](https://www.youtube.com/channel/UChirEOpgFCupRAk5etXqPaA...",
    metadata: {
      title: "YouTube",
      description: "President Joe Biden delivered his first State of the Union address to Congress, set against the turmoil of Russia invading Ukraine, surging inflation, deadlo...",
      keywords: "video, sharing, camera phone, video phone, free, upload",
      ogTitle: "Biden Honors Justice Breyer During State of the Union Address",
      ogDescription: "President Joe Biden delivered his first State of the Union address to Congress, set against the turmoil of Russia invading Ukraine, surging inflation, deadlo...",
      ogUrl: "https://www.youtube.com/watch?v=Vi1iaXA4rDQ",
      ogImage: "https://i.ytimg.com/vi/Vi1iaXA4rDQ/hqdefault.jpg",
      ogLocaleAlternate: [],
      ogSiteName: "YouTube",
      sourceURL: "https://www.youtube.com/watch?v=Vi1iaXA4rDQ"
    }
  }
]
*/
