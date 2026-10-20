FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/edge-agent/package.json apps/edge-agent/package.json
COPY apps/edge-simulator/package.json apps/edge-simulator/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/gaia-core/package.json packages/gaia-core/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
# The software that runs on a box at a site is built into one file here and served by the API, so a box
# is installed and updated from the platform it reports to (docs/14-edge-hardware-deployment.md).
RUN npm run build:packages && npm run build:edge-bundle && npm run build:api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/edge-bundle /app/apps/api/edge-bundle
COPY --from=build /app/packages /app/packages
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
