#!/bin/bash

# Install Python 3.11
yum install -y python311

# Install pip for Python 3.11
yum install -y python3-pip

# Install setuptools using pip
python3.11 -m pip install setuptools

# Install remaining dependencies
yarn install