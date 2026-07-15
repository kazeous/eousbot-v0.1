FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache su-exec

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .
RUN mkdir -p /app/data \
    && chown -R node:node /app \
    && chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV HEALTH_PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
