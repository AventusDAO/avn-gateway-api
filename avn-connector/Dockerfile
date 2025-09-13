FROM node:16-alpine

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?

RUN apk update && \
    apk add g++ make py3-pip

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code to the working directory
COPY . .

# Copy the configuration files to /config directory
RUN mkdir -p /config && cp -r src/config/* /config/

# Copy the contents of the src directory to the build directory
RUN cp -r src/. build/

# Build the TypeScript code
RUN npm run build

RUN npm ci --production

ENTRYPOINT npm start