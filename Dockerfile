ARG NODE_IMAGE=node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995

FROM ${NODE_IMAGE} AS toolchain
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.22.0 --activate

FROM toolchain AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY tsconfig.json tsconfig.build.json vite.config.ts drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
RUN pnpm build

FROM toolchain AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
RUN apk add --no-cache dumb-init \
  && addgroup --system --gid 1001 issopen \
  && adduser --system --uid 1001 --ingroup issopen issopen
COPY --from=production-dependencies --chown=issopen:issopen /app/node_modules ./node_modules
COPY --from=builder --chown=issopen:issopen /app/dist ./dist
COPY --chown=issopen:issopen package.json ./package.json
COPY --chown=issopen:issopen drizzle ./drizzle
COPY --chmod=0555 --chown=issopen:issopen scripts/entrypoint.sh ./scripts/entrypoint.sh
USER issopen
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:8080/health/ready').then((response)=>process.exit(response.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["dumb-init", "--", "./scripts/entrypoint.sh"]
