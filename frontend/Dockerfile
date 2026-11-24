FROM oven/bun:1-slim AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# Next.js inlines NEXT_PUBLIC_* at build time, so it must be a build arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN bun run build

FROM oven/bun:1-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["bun", "run", "start"]
