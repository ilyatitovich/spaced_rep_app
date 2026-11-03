# Postgres client matching the server (17) plus what backup.sh needs:
# gnupg for authenticated encryption, aws-cli for the offsite copy to R2.
FROM postgres:17-alpine
RUN apk add --no-cache gnupg aws-cli
COPY backup.sh backup-loop.sh restore.sh /scripts/
ENTRYPOINT ["/bin/sh", "/scripts/backup-loop.sh"]
