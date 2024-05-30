FROM node:16-alpine

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?

RUN apk update && \
    apk add g++ make py3-pip

# Set the working directory inside the container
# WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

# Copy the rest of the application code to the working directory
COPY src/* ./

# Ensure the config directory is copied
# COPY src/config ./config

# Build the TypeScript code
RUN npm run build

RUN npm ci --production

ENTRYPOINT npm start