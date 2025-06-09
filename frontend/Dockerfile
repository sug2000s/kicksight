FROM node:20 AS build
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* ./
RUN yarn install --frozen-lockfile || npm install
COPY . .
RUN yarn build || npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# 아래 줄은 주석 또는 삭제!
# COPY nginx.conf /etc/nginx/conf.d/default.conf