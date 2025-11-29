# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application (client-only, no SSR)
RUN npm run build -- --configuration production

# Production stage
FROM nginx:alpine

# Copy built files to nginx
COPY --from=build /app/dist/trading-dashboard/browser /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 3002

CMD ["nginx", "-g", "daemon off;"]
