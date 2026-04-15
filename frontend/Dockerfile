# FASE 1: Build
# Usiamo Node per compilare il codice React/Vite
FROM node:22-slim AS build-stage
WORKDIR /app
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund
COPY . .
RUN npm run build

# FASE 2: Production
# Usiamo Nginx per servire i file statici. È infinitamente più veloce di Node per questo scopo.
FROM nginx:stable-alpine
# Copiamo il risultato della fase di build nella cartella di Nginx
COPY --from=build-stage /app/dist /usr/share/nginx/html
# Copiamo la nostra configurazione personalizzata per gestire il routing di React (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Esponiamo la porta 80 (standard HTTP)
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
