FROM node:18-alpine

WORKDIR /app

COPY ./data_retrieval/package*.json ./package.json

RUN npm install

COPY . .
