#!/bin/bash

yum -y update
# yum install gcc bzip2-devel libffi-devel zlib-devel wget tar gzip -y
yum install wget tar -y
# amazon-linux-extras install python3.8 -y

# install quarto
wget -q https://github.com/quarto-dev/quarto-cli/releases/download/v1.3.450/quarto-1.3.450-linux-amd64.tar.gz
tar -xzf quarto-1.3.450-linux-amd64.tar.gz
export PATH=$PATH:$(pwd)/quarto-1.3.450/bin/

quarto render docs/