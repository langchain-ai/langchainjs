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

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Langchain',
  tagline: 'The tagline of my site',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://hwchase17.github.io',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/langchainjs/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'hwchase17', // Usually your GitHub org/user name.
  projectName: 'langchainjs', // Usually your repo name.
  deploymentBranch: 'gh-pages',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        tsconfig: '../langchain/tsconfig.json',
        sidebar: {
          fullNames: true,
        },
      },
    ],
  ],

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/hwchase17/langchainjs/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/docusaurus-social-card.jpg',
      navbar: {
        title: 'Langchain',
        logo: {
          alt: 'Langchain logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc', // 'api' is the 'out' directory
            docId: 'getting-started',
            position: 'left',
            label: 'Docs',
          },
          {
            to: 'docs/api/',
            activeBasePath: 'docs',
            position: 'left',
            label: 'API',
          },
          // Please keep GitHub link to the right for consistency.
          {
            href: 'https://github.com/hwchase17/langchainjs',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Learn',
            items: [
              {
                label: 'Get started',
                to: 'docs/getting-started',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Discord',
                href: 'https://discord.gg/6adMQxSpJS',
              },
            ],
          },
        ],
        // Please do not remove the credits, help to publicize Docusaurus :)
        copyright: `Copyright © ${new Date().getFullYear()} Langchain, Inc. Built with Docusaurus.`,
      },
    }),
};

module.exports = config;
