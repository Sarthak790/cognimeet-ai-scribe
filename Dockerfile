# Use the official Python + Playwright image
FROM mcr.microsoft.com/playwright/python:v1.42.0-jammy

WORKDIR /app

# Explicitly install xvfb (Virtual Monitor)
RUN apt-get update && apt-get install -y xvfb

# Install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all your code into the container
COPY . .

# Let Render inject its own port automatically!
CMD xvfb-run -a uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}