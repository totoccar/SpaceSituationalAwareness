FROM node:20-alpine

WORKDIR /app

# Copiar package.json primero para cache de layers
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
