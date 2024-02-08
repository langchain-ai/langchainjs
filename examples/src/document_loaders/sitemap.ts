import { SitemapLoader } from "langchain/document_loaders/web/sitemap";

const loader = new SitemapLoader("https://www.langchain.com/");

const docs = await loader.load();
console.log(docs.length);
/**
26
 */
console.log(docs[0]);
/**
Document {
  pageContent: '\n' +
    '    \n' +
    '\n' +
    '    \n' +
    '    \n' +
    '    Blog ArticleApr 8, 2022As the internet continues to develop and grow exponentially, jobs related to the industry do too, particularly those that relate to web design and development. The prediction is that by 2029, the job outlook for these two fields will grow by 8%—significantly faster than average. Whether you’re seeking salaried employment or aiming to work in a freelance capacity, a career in web design can offer a variety of employment arrangements, competitive salaries, and opportunities to utilize both technical and creative skill sets.What does a career in web design involve?A career in website design can involve the design, creation, and coding of a range of website types. Other tasks will typically include liaising with clients and discussing website specifications, incorporating feedback, working on graphic design and image editing, and enabling multimedia features such as audio and video.  Requiring a range of creative and technical skills, web designers may be involved in work across a range of industries, including software companies, IT consultancies, web design companies, corporate organizations, and more. In contrast with web developers, web designers tend to play a more creative role, crafting the overall vision and design of a site, and determining how to best incorporate the necessary functionality. However, there can be significant overlap between the roles.Full-stack, back-end, and front-end web developmentThe U.S. Bureau of Labor Statistics (BLS) Occupational Outlook Handbook tends to group web developers and digital designers into one category. However, they define them separately, stating that web developers create and maintain websites and are responsible for the technical aspects including performance and capacity.  Web or digital designers, on the other hand, are responsible for the look and functionality of websites and interfaces. They develop, create, and test the layout, functions, and navigation for usability. Web developers can focus on the back-end, front-end, or full-stack development, and typically utilize a range of programming languages, libraries, and frameworks to do so. Web designers may work more closely with front-end engineers to establish the user-end functionality and appearance of a site.Are web designers in demand in 2022?In our ever-increasingly digital environment, there is a constant need for websites—and therefore for web designers and developers. With 17.4 billion websites in existence as of January 2020, the demand for web developers is only expected to rise.Web designers with significant coding experience are typically in higher demand, and can usually expect a higher salary. Like all jobs, there are likely to be a range of opportunities, some of which are better paid than others. But certain skill sets are basic to web design, most of which are key to how to become a web designer in 2022.const removeHiddenBreakpointLayers = function ie(e){function t(){for(let{hash:r,mediaQuery:i}of e){if(!i)continue;if(window.matchMedia(i).matches)return r}return e[0]?.hash}let o=t();if(o)for(let r of document.querySelectorAll(".hidden-"+o))r.parentNode?.removeChild(r);for(let r of document.querySelectorAll(".ssr-variant")){for(;r.firstChild;)r.parentNode?.insertBefore(r.firstChild,r);r.parentNode?.removeChild(r)}for(let r of document.querySelectorAll("[data-framer-original-sizes]")){let i=r.getAttribute("data-framer-original-sizes");i===""?r.removeAttribute("sizes"):r.setAttribute("sizes",i),r.removeAttribute("data-framer-original-sizes")}};removeHiddenBreakpointLayers([{"hash":"1ksv3g6"}])\n' +
    '\n' +
    '    \n' +
    '    \n' +
    '    \n' +
    '    \n' +
    '    \n' +
    '\n' +
    '\n',
  metadata: {
    changefreq: '',
    lastmod: '',
    priority: '',
    source: 'https://www.langchain.com/blog-detail/starting-a-career-in-design'
  }
}
 */
