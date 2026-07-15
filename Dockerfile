# invoice-saas — production image (monorepo, npm workspaces)
# Builds api + worker + web in one image; each Compose service runs a different
# workspace via `npm run start -w @invoice-saas/<pkg>` (node dist/<pkg>.js / next start).

FROM node:20-alpine

WORKDIR /app

# Install from lockfile for reproducible builds.
# tsconfig.base.json is required: every workspace tsconfig extends ../../tsconfig.base.json,
# and without it tsc loses moduleResolution/module/target/esModuleInterop and the build fails.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages

RUN npm ci

# Generate the Prisma client and build every workspace (api/worker tsc + web next build).
RUN npm run prisma:generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Drop dev dependencies to shrink the runtime image (tsx, vitest, types are not needed at runtime).
RUN npm prune --omit=dev

EXPOSE 3000 3001

# Default command is overridden per-service in docker-compose.prod.yml.
CMD ["npm", "run", "start", "-w", "@invoice-saas/api"]
