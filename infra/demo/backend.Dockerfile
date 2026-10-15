FROM python:3.13.8-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings_demo
WORKDIR /app
COPY backend/requirements.txt backend/requirements-demo.txt ./
RUN pip install --no-cache-dir -r requirements-demo.txt \
    && groupadd --gid 10001 furgoplus \
    && useradd --uid 10001 --gid 10001 --no-create-home furgoplus \
    && mkdir -p /var/lib/furgoplus/private \
    && chown 10001:10001 /var/lib/furgoplus/private \
    && chmod 700 /var/lib/furgoplus/private
COPY backend/ ./
COPY infra/demo/gunicorn.conf.py infra/demo/healthcheck.py infra/demo/test_without_db.py ./
COPY infra/demo/check_gunicorn.py ./
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn", "--config", "gunicorn.conf.py", "config.wsgi:application"]
