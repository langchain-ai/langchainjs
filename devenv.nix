{ pkgs, lib, config, inputs, ... }:

{
  # ============================================
  # Language & Package Manager Setup
  # ============================================
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_24;
    pnpm = {
      enable = true;
      install.enable = true;
    };
  };

  # ============================================
  # Packages (minimal - tools available via pnpm)
  # ============================================
  packages = with pkgs; [
    git
    jq
  ];

  # ============================================
  # Environment Variables
  # ============================================
  env = {
    NODE_ENV = "development";
  };

  # ============================================
  # Scripts - Common Development Tasks
  # ============================================
  scripts = {
    install.exec = "pnpm install";
    build.exec = "pnpm build";
    build-core.exec = "pnpm --filter @langchain/core build";
    test.exec = "pnpm test:unit";
    lint.exec = "pnpm lint";
    lint-fix.exec = "pnpm lint:fix";
    format.exec = "pnpm format";
    watch.exec = "pnpm watch";
    clean.exec = "pnpm clean";
  };

  # ============================================
  # Welcome Message
  # ============================================
  enterShell = ''
    echo "LangChain.js Development Environment"
    echo "====================================="
    node -v | sed 's/^/Node.js:   /'
    pnpm -v | sed 's/^/pnpm:      /'
    echo ""
    echo "Scripts: install, build, build-core, test, lint, format, watch, clean"
    echo "Run 'devenv run <script>' to execute"
  '';

  # Dotenv Integration
  dotenv.enable = true;
}
