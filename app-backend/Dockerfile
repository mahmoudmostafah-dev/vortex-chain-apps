# Use official Node.js runtime as base image
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy application files
COPY . .

# Expose port (if needed for API)
EXPOSE 3000

# Set environment to use .env from docker-compose
ENV NODE_ENV=production

# Start the application
CMD ["node", "index.js"]
