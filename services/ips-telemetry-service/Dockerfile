# ============================================
# Stage 1: Builder - установка зависимостей
# ============================================
FROM python:3.14-slim AS builder

# Устанавливаем системные зависимости для компиляции
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Создаём виртуальное окружение
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Копируем файлы зависимостей
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ============================================
# Stage 2: Production - минимальный образ
# ============================================
FROM python:3.14-slim AS production

# Создаём непривилегированного пользователя
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Копируем виртуальное окружение из builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SVC_HOST=0.0.0.0 \
    SVC_PORT=8000 \
    SVC_RELOAD=false

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем исходный код
COPY src/ ./src/

# Копируем конфигурационные файлы
COPY config/ ./config/

# Код и конфигурация остаются root-owned; запись разрешена только в логи
RUN mkdir -p /app/logs && \
    chown appuser:appuser /app/logs

# Переключаемся на непривилегированного пользователя
USER appuser

# Контейнерный порт по умолчанию задаётся через SVC_PORT
EXPOSE 8000

# Healthcheck для проверки работоспособности
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ["python", "-c", "import urllib.request; from src.ips_telemetry_service.config.loader.settings import app_settings; urllib.request.urlopen(f'http://127.0.0.1:{app_settings().service.port}/docs', timeout=3).close()"]

# Запускаем приложение
CMD ["python", "-m", "src.ips_telemetry_service.main"]
