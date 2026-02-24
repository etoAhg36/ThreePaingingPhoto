# Use an official Node.js runtime as a parent image
FROM node:18-bullseye

# Install system dependencies for canvas, gl, and xvfb
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libgl1-mesa-dev \
    libxi-dev \
    libx11-dev \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the application port
EXPOSE 1445

# Set environment variables
ENV DISPLAY=:99
ENV NODE_ENV=production

# Use xvfb-run to start the application
# Using shell form to ensure environment variables and signals are handled correctly
CMD xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" node main.js
