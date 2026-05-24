FROM python:3.11-slim

WORKDIR /app

# System deps for bcrypt / odfpy / pypdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Data dir for SQLite + uploaded KB
RUN mkdir -p /app/data

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
