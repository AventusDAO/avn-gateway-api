FROM node:16-alpine

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?

RUN apk update && \
    apk add g++ make py3-pip

RUN npm i

RUN npm run build

RUN pwd

COPY build .

RUN npm ci --production

ENTRYPOINT npm start