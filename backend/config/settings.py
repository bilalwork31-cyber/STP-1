import os

from django.core.exceptions import ImproperlyConfigured


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ImproperlyConfigured(f"Set the {name} environment variable. See .env.example.")
    return value


ORS_API_KEY = required_env("ORS_API_KEY")
SECRET_KEY = required_env("DJANGO_SECRET_KEY")
DEBUG = os.environ.get("DJANGO_DEBUG", "false").lower() == "true"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,.vercel.app").split(",")
    if host.strip()
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
INSTALLED_APPS = ["trips"]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]
DATABASES = {}
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
TIME_ZONE = "UTC"
USE_TZ = True
SECURE_CONTENT_TYPE_NOSNIFF = True
