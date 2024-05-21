FROM node:16-alpine

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?

RUN apk update && \
    apk add g++ make py3-pip

WORKDIR /

# Output the current working directory
RUN echo "Current working directory: $(pwd)"

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

COPY build .

RUN npm ci --production

ENTRYPOINT npm start