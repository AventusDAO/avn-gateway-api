FROM node:16-alpine

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?

RUN apk update && \
    apk add g++ make py3-pip

COPY src .

RUN npm ci --production

ENTRYPOINT npm start