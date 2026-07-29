FROM node:22-alpine

WORKDIR /app
RUN chown node:node /app
COPY package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
USER node

EXPOSE 5173
CMD ["npm", "run", "dev"]
