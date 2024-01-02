module.exports = {
    extends: ['@commitlint/config-conventional'],
    rules: {
      'type-enum': [ 2, 'always', [
        'feat',
        'fix',
        'patch',
        'docs',
        'refactor',
        'chore',
        'test',
        'ci',
        'perf',
        'release',
        'build',
        'revert',
        'style',
      ]
    ],
      'scope-enum': [ 2, 'always', [
        'core',
        'libs',
        'config',
        'devcontainer',
        'api_refs',
        'api_docs',
        'examples',
        'cookbook',
      ]
    ],
      'body-max-line-length': [0, 'never']
    },
  };
  