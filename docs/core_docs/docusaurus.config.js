/* eslint-disable global-require,import/no-extraneous-dependencies */

// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
// eslint-disable-next-line import/no-extraneous-dependencies
const { ProvidePlugin } = require("webpack");
const path = require("path");
require("dotenv").config();

const examplesPath = path.resolve(__dirname, "..", "..", "examples", "src");
const mdxComponentsPath = path.resolve(__dirname, "docs", "mdx_components");

const baseLightCodeBlockTheme = require("prism-react-renderer/themes/vsLight");
const baseDarkCodeBlockTheme = require("prism-react-renderer/themes/vsDark");

const baseUrl = "/";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "🦜️🔗 Langchain",
  tagline: "LangChain.js Docs",
  favicon: "img/brand/favicon.png",
  // Set the production url of your site here
  url: "https://js.langchain.com",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl,

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "throw",

  plugins: [
    () => ({
      name: "custom-webpack-config",
      configureWebpack: () => ({
        plugins: [
          new ProvidePlugin({
            process: require.resolve("process/browser"),
          }),
        ],
        resolve: {
          fallback: {
            path: false,
            url: false,
          },
          alias: {
            "@examples": examplesPath,
            "@mdx_components": mdxComponentsPath,
            react: path.resolve("../../node_modules/react"),
          },
        },
        module: {
          rules: [
            {
              test: examplesPath,
              use: ["json-loader", "./scripts/code-block-loader.js"],
            },
            {
              test: /\.ya?ml$/,
              use: "yaml-loader",
            },
            {
              test: /\.m?js/,
              resolve: {
                fullySpecified: false,
              },
            },
          ],
        },
      }),
    }),
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          remarkPlugins: [
            [require("@docusaurus/remark-plugin-npm2yarn"), { sync: true }],
          ],
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            const sidebarItems = await defaultSidebarItemsGenerator(args);
            sidebarItems.forEach((subItem) => {
              // This allows breaking long sidebar labels into multiple lines
              // by inserting a zero-width space after each slash.
              if (
                "label" in subItem &&
                subItem.label &&
                subItem.label.includes("/")
              ) {
                // eslint-disable-next-line no-param-reassign
                subItem.label = subItem.label.replace(/\//g, "/\u200B");
              }
              if (args.item.className) {
                subItem.className = args.item.className;
              }
            });
            return sidebarItems;
          },
        },
        pages: {
          remarkPlugins: [require("@docusaurus/remark-plugin-npm2yarn")],
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  webpack: {
    jsLoader: (isServer) => ({
      loader: require.resolve("swc-loader"),
      options: {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
          },
          target: "es2017",
        },
        module: {
          type: isServer ? "commonjs" : "es6",
        },
      },
    }),
  },

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      announcementBar: {
        content:
          '<strong class="announcement-bar-text">Join us at <a href="https://interrupt.langchain.com/" target="_blank" rel="noopener noreferrer"> Interrupt: The Agent AI Conference by LangChain</a> on May 13 & 14 in San Francisco!</strong>',
        backgroundColor: "#d0c9fe",
      },
      prism: {
        theme: {
          ...baseLightCodeBlockTheme,
          plain: {
            ...baseLightCodeBlockTheme.plain,
            backgroundColor: "#F5F5F5",
          },
        },
        darkTheme: {
          ...baseDarkCodeBlockTheme,
          plain: {
            ...baseDarkCodeBlockTheme.plain,
            backgroundColor: "#222222",
          },
        },
      },
      image: "img/brand/theme-image.png",
      navbar: {
        logo: {
          src: "img/brand/wordmark.png",
          srcDark: "img/brand/wordmark-dark.png",
        },
        items: [
          {
            type: "docSidebar",
            position: "left",
            sidebarId: "integrations",
            label: "Integrations",
          },
          {
            href: "https://v03.api.js.langchain.com",
            label: "API Reference",
            position: "left",
          },
          {
            type: "dropdown",
            label: "More",
            position: "left",
            items: [
              {
                to: "/docs/people/",
                label: "People",
              },
              {
                to: "/docs/community",
                label: "Community",
              },
              {
                to: "/docs/troubleshooting/errors",
                label: "Error reference",
              },
              {
                to: "/docs/additional_resources/tutorials",
                label: "External guides",
              },
              {
                to: "/docs/contributing",
                label: "Contributing",
              },
            ],
          },
          {
            type: "dropdown",
            label: "v0.3",
            position: "right",
            items: [
              {
                label: "v0.3",
                href: "/docs/introduction",
              },
              {
                label: "v0.2",
                href: "https://js.langchain.com/v0.2/docs/introduction",
              },
              {
                label: "v0.1",
                href: "https://js.langchain.com/v0.1/docs/get_started/introduction",
              },
            ],
          },
          {
            type: "dropdown",
            label: "🦜🔗",
            position: "right",
            items: [
              {
                href: "https://smith.langchain.com",
                label: "LangSmith",
              },
              {
                href: "https://docs.smith.langchain.com",
                label: "LangSmith Docs",
              },
              {
                href: "https://smith.langchain.com/hub",
                label: "LangChain Hub",
              },
              {
                href: "https://github.com/langchain-ai/langserve",
                label: "LangServe",
              },
              {
                href: "https://python.langchain.com/",
                label: "Python Docs",
              },
            ],
          },
          {
            href: "https://chatjs.langchain.com",
            label: "Chat",
            position: "right",
          },
          // Please keep GitHub link to the right for consistency.
          {
            href: "https://github.com/langchain-ai/langchainjs",
            className: "header-github-link",
            position: "right",
            "aria-label": "GitHub repository",
          },
        ],
      },
      footer: {
        style: "light",
        links: [
          {
            title: "Community",
            items: [
              {
                label: "Twitter",
                href: "https://twitter.com/LangChainAI",
              },
            ],
          },
          {
            title: "GitHub",
            items: [
              {
                label: "Python",
                href: "https://github.com/langchain-ai/langchain",
              },
              {
                label: "JS/TS",
                href: "https://github.com/langchain-ai/langchainjs",
              },
            ],
          },
          {
            title: "More",
            items: [
              {
                label: "Homepage",
                href: "https://langchain.com",
              },
              {
                label: "Blog",
                href: "https://blog.langchain.dev",
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} LangChain, Inc.`,
      },
      algolia: {
        // The application ID provided by Algolia
        appId: "3EZV6U1TYC",

        // Public API key: it is safe to commit it
        // this is linked to erick@langchain.dev currently
        apiKey: "180851bbb9ba0ef6be9214849d6efeaf",

        indexName: "js-langchain-latest",

        contextualSearch: false,
      },
    }),

  scripts: [
    baseUrl + "js/google_analytics.js",
    {
      src: "https://www.googletagmanager.com/gtag/js?id=G-TVSL7JBE9Y",
      async: true,
    },
  ],

  customFields: {
    supabasePublicKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_KEY,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  },
};

module.exports = config;
