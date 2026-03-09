# Utilizziamo una versione lightweight di Node.js (Alpine) per ridurre le dimensioni dell'immagine
FROM node:22-alpine

# Definiamo la cartella di lavoro all'interno del container
WORKDIR /app

# Copiamo prima solo i file delle dipendenze per sfruttare il caching dei layer di Docker.
# Se non aggiungi nuovi pacchetti, questa fase verrà saltata nei build successivi.
COPY package*.json ./

# Installiamo le dipendenze
RUN npm install

# Copiamo tutto il codice sorgente
COPY . .

# Esponiamo le porte utilizzate dal backend (Honeypot e Dashboard Admin)
EXPOSE 4002
EXPOSE 4003

# Comando di default per avviare entrambi i server
# Nota: In produzione sarebbe meglio avere container separati, ma per ora usiamo lo script esistente
CMD ["npm", "run", "start:both"]
