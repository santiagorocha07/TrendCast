FROM node:24-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.14-slim
WORKDIR /app
COPY requirements.txt requirements-lstm.txt ./
RUN pip install --no-cache-dir -r requirements-lstm.txt
COPY . .
COPY --from=frontend /frontend/dist ./frontend/dist
RUN python -m ml.train_model && python -m ml.train_lstm
ENV PORT=5001
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 4 --timeout 90 backend.app:app"]
