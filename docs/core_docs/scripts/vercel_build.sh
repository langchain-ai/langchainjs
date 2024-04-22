#!/bin/bash

# install quarto
wget -q https://github.com/quarto-dev/quarto-cli/releases/download/v1.3.450/quarto-1.3.450-linux-amd64.tar.gz
tar -xzf quarto-1.3.450-linux-amd64.tar.gz
export PATH=$PATH:$(pwd)/quarto-1.3.450/bin/

quarto render docs/