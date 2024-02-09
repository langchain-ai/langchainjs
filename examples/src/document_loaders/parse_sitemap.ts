import { SitemapLoader } from "langchain/document_loaders/web/sitemap";

const loader = new SitemapLoader("https://www.langchain.com/");

const sitemap = await loader.parseSitemap();
console.log(sitemap);
/**
[
  {
    loc: 'https://www.langchain.com/blog-detail/starting-a-career-in-design',
    changefreq: '',
    lastmod: '',
    priority: ''
  },
  {
    loc: 'https://www.langchain.com/blog-detail/building-a-navigation-component',
    changefreq: '',
    lastmod: '',
    priority: ''
  },
  {
    loc: 'https://www.langchain.com/blog-detail/guide-to-creating-a-website',
    changefreq: '',
    lastmod: '',
    priority: ''
  },
  {
    loc: 'https://www.langchain.com/page-1/terms-and-conditions',
    changefreq: '',
    lastmod: '',
    priority: ''
  },
...42 more items
]
 */
