FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_CHARGEGUARD_DATA_SOURCE=api
ARG VITE_BACKEND_API_URL=http://localhost:8000
ARG VITE_MOCK_BANK_API_URL=http://localhost:8001
ARG VITE_MOCK_MERCHANT_API_URL=http://localhost:8002
ARG VITE_DEMO_USER_ID=usr_demo

ENV VITE_CHARGEGUARD_DATA_SOURCE=$VITE_CHARGEGUARD_DATA_SOURCE \
    VITE_BACKEND_API_URL=$VITE_BACKEND_API_URL \
    VITE_MOCK_BANK_API_URL=$VITE_MOCK_BANK_API_URL \
    VITE_MOCK_MERCHANT_API_URL=$VITE_MOCK_MERCHANT_API_URL \
    VITE_DEMO_USER_ID=$VITE_DEMO_USER_ID

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
