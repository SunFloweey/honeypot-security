# Utilizziamo una versione slim di Node.js (Debian-based) invece di Alpine
# Alpine su Linux ha spesso problemi di performance nei download e DNS
FROM node:22-slim

# Definiamo la cartella di lavoro all'interno del container
WORKDIR /app

# Copiamo prima solo i file delle dipendenze per sfruttare il caching dei layer di Docker.
COPY package*.json ./

# Installiamo le dipendenze in modo ottimizzato usando la cache di BuildKit
# Questo trucco rende i build successivi velocissimi
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund

# Copiamo tutto il codice sorgente
COPY --chown=node:node . .

# Passiamo all'utente node prima di avviare il processo
USER node

# Esponiamo le porte utilizzate dal backend
EXPOSE 4002
EXPOSE 4003

# Comando di default per avviare entrambi i server
CMD ["npm", "run", "start:both"]
