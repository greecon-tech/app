FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/edge-simulator/package.json apps/edge-simulator/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/gaia-core/package.json packages/gaia-core/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:packages && npm run build:edge

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/edge-simulator/package.json /app/apps/edge-simulator/package.json
COPY --from=build /app/apps/edge-simulator/dist /app/apps/edge-simulator/dist
COPY --from=build /app/packages /app/packages
CMD ["node", "apps/edge-simulator/dist/index.js"]
