import { test } from "@jest/globals";
import { SitemapLoader } from "../web/sitemap.js";

test("SitemapLoader", async () => {
  const regexFailIfNotJsLangChain = /^https:\/\/js\.langchain\.com\//;
  const regexContainsToolsDynamic = /tools\/dynamic/;

  // Filter our 1 bad url (has since been fixed in vercel, but keep the test!)
  const loader = new SitemapLoader("https://js.langchain.com/", {
    filterUrls: [regexFailIfNotJsLangChain, regexContainsToolsDynamic],
  });

  const docs = await loader.load();
  expect(docs.length).toBeGreaterThan(0);
});

test("checkUrlPatterns can properly identify unwanted links", async () => {
  const links = [
    "https://js.langchain.com/docs/use_cases/agent_simulations/",
    "https://js.langchain.com/docs/use_cases/agent_simulations/generative_agents",
    "https://js.langchain.com/docs/integrations/platforms/google",
    "https://js.langchain.com/docs/integrations/vectorstores/analyticdb",
    "https://js.langchain.com/docs/expression_language/interface",
    "https://js.langchain.com/docs/modules/data_connection/",
  ];

  const linkRegex =
    /^(https:\/\/js\.langchain\.com\/docs\/use_cases)|.*interface$/;

  const loader = new SitemapLoader("https://www.langchain.com/", {
    filterUrls: [linkRegex.source],
  });

  const matches = links.map((link) => loader._checkUrlPatterns(link));
  expect(matches).toEqual([true, true, false, false, true, false]);
});
