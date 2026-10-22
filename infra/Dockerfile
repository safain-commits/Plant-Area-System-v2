FROM node:26.12.1-bookworm-slim AS dependencies
WORKDIR /workspace
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.14.0
COPY . .
RUN pnpm install --frozen-lockfile

FROM dependencies AS tools
ENTRYPOINT ["pnpm"]

FROM dependencies AS builder
ARG APP
RUN pnpm --filter @plant/${APP} build

FROM node:26.12.1-bookworm-slim AS runtime
ARG APP
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 APP=${APP}
WORKDIR /workspace
COPY --from=builder --chown=node:node /workspace/apps/${APP}/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/apps/${APP}/.next/static ./apps/${APP}/.next/static
COPY --from=builder --chown=node:node /workspace/apps/${APP}/public ./apps/${APP}/public
USER node
EXPOSE 3000
CMD ["sh", "-c", "exec node apps/$APP/server.js"]
