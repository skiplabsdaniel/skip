FROM node:lts-alpine3.19

WORKDIR /app

COPY package.json package.json
RUN npm install
COPY . .
RUN npm run build

HEALTHCHECK --interval=10s --timeout=1s --retries=10 CMD wget --spider http://localhost:3031/healthcheck

EXPOSE 3031
CMD ["npm", "start"]
