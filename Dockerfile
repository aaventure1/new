# Use a Node runtime compatible with mongoose@9 (requires >=20.19)
FROM node:22-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

RUN npm install --production

# Bundle app source
COPY . .

# Your app binds to port 3000 so you'll use the EXPOSE instruction to have it mapped by the docker daemon
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD [ "node", "server/index.js" ]
