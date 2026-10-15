FROM node:22.19.0-alpine3.22 AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN VITE_FURGOPLUS_DEMO_MODE=true npm run build

FROM caddy:2.11.7-alpine
# The official binary carries cap_net_bind_service; remove it before dropping
# all runtime capabilities. Only the unprivileged port 8080 is needed.
RUN setcap -r /usr/bin/caddy
COPY --from=build /app/dist/ /srv/
COPY infra/demo/Caddyfile /etc/caddy/Caddyfile
USER 10001:10001
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
