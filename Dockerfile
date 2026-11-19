# JM Services website (web build of this Expo app), served by nginx. Used by Dokploy.
#
# The API address is compiled into the site, so it is a build argument (Dokploy: "Build Args"):
#   JM_API_URL                required, e.g. https://api.example.com (never https://matistore.tech)
#   JM_GOOGLE_WEB_CLIENT_ID   optional, defaults to the JM Services Google web client; empty = no Google button
#   JM_APPLE_SERVICES_ID      optional, JM Services Apple Services ID; empty = no Apple button
# Local test: docker build --build-arg JM_API_URL=http://localhost:3000 -t jmservices-web . && docker run -p 8080:80 jmservices-web

# ---- build: same code as the mobile app, exported as a static single-page site ----
FROM node:22-alpine AS build
WORKDIR /app
ENV CI=1 EXPO_NO_TELEMETRY=1
ARG JM_API_URL
ARG JM_GOOGLE_WEB_CLIENT_ID="353560751754-g2s0t3je705b04nk2iq9rfht85l6leb2.apps.googleusercontent.com"
ARG JM_APPLE_SERVICES_ID=""
RUN test -n "$JM_API_URL" || (echo "JM_API_URL build argument is required (address of the JM Services API)" && exit 1)
ENV JM_API_URL=$JM_API_URL JM_GOOGLE_WEB_CLIENT_ID=$JM_GOOGLE_WEB_CLIENT_ID JM_APPLE_SERVICES_ID=$JM_APPLE_SERVICES_ID
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web --output-dir dist --clear \
  && grep -rq "$JM_API_URL" dist/_expo/static/js/web/ \
  || (echo "The API address was not compiled into the site" && exit 1)

# ---- runtime: static files only ----
FROM nginx:1.27-alpine
COPY nginx.web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
