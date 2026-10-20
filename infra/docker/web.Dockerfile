FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/edge-simulator/package.json apps/edge-simulator/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/gaia-core/package.json packages/gaia-core/package.json
COPY packages/config/package.json packages/config/package.json
RUN npm install

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build:packages && npm run build:web

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/web/package.json /app/apps/web/package.json
COPY --from=build /app/apps/web/.next /app/apps/web/.next
COPY --from=build /app/apps/web/public /app/apps/web/public
COPY --from=build /app/packages /app/packages
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@greecon/web"]
