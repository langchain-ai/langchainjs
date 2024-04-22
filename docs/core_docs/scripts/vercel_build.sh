#!/bin/bash

yum -y update
# Not sure we need all these
yum install gcc bzip2-devel libffi-devel zlib-devel wget tar gzip -y

# install quarto
wget -q https://github.com/quarto-dev/quarto-cli/releases/download/v1.3.450/quarto-1.3.450-linux-amd64.tar.gz
tar -xzf quarto-1.3.450-linux-amd64.tar.gz
export PATH=$PATH:$(pwd)/quarto-1.3.450/bin/

quarto render docs/