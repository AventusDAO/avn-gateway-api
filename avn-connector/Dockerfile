FROM node:16.17.1-alpine3.15

# Need to be root to write logs to volume.
# TODO: use log driver to send stdout to CloudWatch?
ENV USER www
ENV GROUP www

WORKDIR /home/$USER
COPY src .

# the fewer commands in Dockerfile, the fewer layers will be created
RUN addgroup -S $GROUP \
    && adduser -D -G $GROUP -S $USER \
    && chmod 0700 /home/$USER \
    && npm install

USER $USER:$GROUP

ENTRYPOINT exec npm start
