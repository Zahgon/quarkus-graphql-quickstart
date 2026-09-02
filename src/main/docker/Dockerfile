####
# This Dockerfile is used in order to build a container that runs the
# application in Node.js mode.
#
# Build the image with:
#
# ```
# npm ci && npm run build
# docker build -f src/main/docker/Dockerfile -t quarkus/quarkus-graphql-quickstart .
# ```
#
# Then run the container using:
#
# ```
# docker run -i --rm -p 8080:8080 quarkus/quarkus-graphql-quickstart
# ```
#
# The application listens on 8080 by default; set `QUARKUS_HTTP_PORT` to change
# it. In the `prod` profile the datasource and the object store are read from
# `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `MINIO_USER_ACCESS_KEY` and
# `MINIO_USER_SECRET_KEY`.
###
FROM node:22-bookworm-slim AS build

WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev


FROM node:22-bookworm-slim

ENV LANGUAGE='en_US:en'
ENV NODE_ENV=production
ENV QUARKUS_PROFILE=prod

WORKDIR /deployments

# Four distinct layers, so that application changes do not invalidate the
# dependency layer.
COPY --from=build --chown=1000 /build/node_modules /deployments/node_modules
COPY --from=build --chown=1000 /build/dist /deployments/dist
COPY --chown=1000 package.json /deployments/package.json
COPY --chown=1000 src/main/resources /deployments/src/main/resources

EXPOSE 8080
USER 1000

ENTRYPOINT [ "node", "dist/main.js" ]
