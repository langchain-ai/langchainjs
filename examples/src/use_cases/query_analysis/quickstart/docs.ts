import { DocumentInterface } from "@langchain/core/documents";
import { YoutubeLoader } from "langchain/document_loaders/web/youtube";
import { getYear } from "date-fns";

const urls = [
  "https://www.youtube.com/watch?v=HAn9vnJy6S4", // Jan 31, 2024
  "https://www.youtube.com/watch?v=dA1cHGACXCo", // Jan 26, 2024
  "https://www.youtube.com/watch?v=ZcEMLz27sL4", // Jan 24, 2024
  "https://www.youtube.com/watch?v=hvAPnpSfSGo", // Jan 23, 2024
  "https://www.youtube.com/watch?v=EhlPDL4QrWY", // Jan 16, 2024
  "https://www.youtube.com/watch?v=mmBo8nlu2j0", // Jan 5, 2024
  "https://www.youtube.com/watch?v=rQdibOsL1ps", // Jan 2, 2024
  "https://www.youtube.com/watch?v=28lC4fqukoc", // Dec 20, 2023
  "https://www.youtube.com/watch?v=es-9MgxB-uc", // Dec 19, 2023
  "https://www.youtube.com/watch?v=wLRHwKuKvOE", // Nov 27, 2023
  "https://www.youtube.com/watch?v=ObIltMaRJvY", // Nov 22, 2023
  "https://www.youtube.com/watch?v=DjuXACWYkkU", // Nov 16, 2023
  "https://www.youtube.com/watch?v=o7C9ld6Ln-M", // Nov 2, 2023
];

const dates = [
  new Date("Jan 31, 2024"),
  new Date("Jan 26, 2024"),
  new Date("Jan 24, 2024"),
  new Date("Jan 23, 2024"),
  new Date("Jan 16, 2024"),
  new Date("Jan 5, 2024"),
  new Date("Jan 2, 2024"),
  new Date("Dec 20, 2023"),
  new Date("Dec 19, 2023"),
  new Date("Nov 27, 2023"),
  new Date("Nov 22, 2023"),
  new Date("Nov 16, 2023"),
  new Date("Nov 2, 2023"),
];

const getDocs = async () => {
  const docs: Array<DocumentInterface> = [];

  for await (const url of urls) {
    const doc = await YoutubeLoader.createFromUrl(url, {
      language: "en",
      addVideoInfo: true,
    }).load();
    docs.push(...doc);
  }

  docs.forEach((doc, idx) => {
    // eslint-disable-next-line no-param-reassign
    doc.metadata.publish_year = getYear(dates[idx]);
    // eslint-disable-next-line no-param-reassign
    doc.metadata.publish_date = dates[idx];
  });

  return docs;
};

export { getDocs };
