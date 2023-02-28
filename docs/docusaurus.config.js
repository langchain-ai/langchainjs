/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @format
 */
// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion
// eslint-disable-next-line import/no-extraneous-dependencies
const { ProvidePlugin } = require("webpack");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Langchain",
  tagline: "The tagline of my site",
  favicon: "img/favicon.ico",
  customFields: {
    mendableAnonKey: process.env.MENDABLE_ANON_KEY,
  },
  // Set the production url of your site here
  url: "https://hwchase17.github.io",
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: "/langchainjs/",

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: "hwchase17", // Usually your GitHub org/user name.
  projectName: "langchainjs", // Usually your repo name.
  deploymentBranch: "gh-pages",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  plugins: [
    [
      "docusaurus-plugin-typedoc",
      {
        tsconfig: "../langchain/tsconfig.json",
        sidebar: {
          fullNames: true,
        },
      },
    ],
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
        },
        module: {
          rules: [
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
          editUrl: "https://github.com/hwchase17/langchainjs/",
          async sidebarItemsGenerator({
            defaultSidebarItemsGenerator,
            ...args
          }) {
            const allInternal = [];
            const filterInternal = (items) =>
              items
                .filter((item) => {
                  const isInternal = item.label?.includes("internal");
                  if (isInternal) {
                    allInternal.push(item);
                  }
                  return !isInternal;
                })
                .map((item) => {
                  if (item.items && Array.isArray(item.items)) {
                    return { ...item, items: filterInternal(item.items) };
                  }
                  return item;
                });
            const sidebarItems = await defaultSidebarItemsGenerator(args);
            const filtered = filterInternal(sidebarItems);
            if (allInternal.length > 0) {
              return [
                ...filtered,
                {
                  type: "category",
                  label: "Internal",
                  collapsible: true,
                  collapsed: true,
                  items: allInternal,
                },
              ];
            }
            return filtered;
          },
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/docusaurus.png",
      navbar: {
        title: "Langchain",
        logo: {
          alt: "Langchain logo",
          src: "img/docusaurus.png",
        },
        items: [
          // Please keep GitHub link to the right for consistency.
          {
            href: "https://github.com/hwchase17/langchainjs",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      footer: {
        style: "dark",
        // Please do not remove the credits, help to publicize Docusaurus :)
        copyright: `Copyright © ${new Date().getFullYear()} Langchain, Inc. Built with Docusaurus.`,
      },
    }),
};

module.exports = config;
