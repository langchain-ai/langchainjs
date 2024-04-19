#!/bin/bash

# Install Python 3.11
yum install -y python311

# Install pip for Python 3.11
python3.11 -m ensurepip

# Upgrade pip to the latest version
python3.11 -m pip install --upgrade pip

# Install setuptools using pip
python3.11 -m pip install setuptools

# Install remaining dependencies
yarn install