# Base Node image
FROM node:22-bookworm-slim AS base

# Set for base and all layer that inherit from it
ENV PORT="8080"
ENV NODE_ENV="production"
ARG DEBIAN_FRONTEND="noninteractive"
WORKDIR /src

# Install openssl for Prisma and pnpm
RUN apt-get update && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/* && \
    corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install dependencies using turbo prune for minimal install
FROM base AS pruner

RUN npm i -g turbo@^2.4.4
COPY . .
RUN turbo prune @shelf/webapp --docker

# Install all node_modules (including devDependencies for build)
FROM base AS deps

COPY --from=pruner /src/out/json/ .
RUN NODE_ENV=development pnpm install --frozen-lockfile

# Build the app
FROM base AS build

RUN npm i -g turbo@^2.4.4

COPY --from=deps /src/ /src/
COPY --from=pruner /src/out/full/ .

RUN turbo build --filter=@shelf/webapp

# Compile the migration runner to a self-contained CJS bundle before stripping
# devDependencies. dotenv (devDep) is bundled in; @libsql/client (prod dep)
# stays external so its native bindings are resolved at runtime.
RUN node_modules/.bin/esbuild packages/database/src/migrate.ts \
      --bundle \
      --platform=node \
      --format=cjs \
      --external:@libsql/client \
      --outfile=packages/database/src/migrate.cjs

RUN pnpm prune --prod

# Finally, build the production image with minimal footprint
FROM base AS release

COPY --from=build /src/node_modules /src/node_modules
COPY --from=build /src/apps/webapp/node_modules /src/apps/webapp/node_modules
COPY --from=build /src/packages/database /src/packages/database
COPY --from=build /src/apps/webapp/build /src/apps/webapp/build
COPY --from=build /src/apps/webapp/package.json /src/apps/webapp/package.json
COPY --from=build /src/package.json /src/package.json
COPY --from=build /src/apps/webapp/prisma.config.ts /src/apps/webapp/prisma.config.ts
COPY --from=build /src/apps/webapp/start.sh /src/apps/webapp/start.sh

WORKDIR /src/apps/webapp

RUN chmod +x /src/apps/webapp/start.sh

ENTRYPOINT [ "/src/apps/webapp/start.sh" ]
