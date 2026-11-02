FROM node:22.19.0-alpine3.22 AS build
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
ARG FURGOPLUS_DEMO_REGISTRATION_ENABLED=false
RUN VITE_FURGOPLUS_DEMO_MODE=true \
    VITE_FURGOPLUS_DEMO_REGISTRATION_ENABLED="$FURGOPLUS_DEMO_REGISTRATION_ENABLED" \
    npm run build

FROM caddy:2.11.7-alpine
# The official binary carries cap_net_bind_service; remove it before dropping
# all runtime capabilities. Only the unprivileged port 8080 is needed.
RUN setcap -r /usr/bin/caddy
COPY --from=build --chown=10001:10001 /app/dist/ /srv/
COPY --chown=10001:10001 infra/demo/Caddyfile /etc/caddy/Caddyfile
USER 10001:10001
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
