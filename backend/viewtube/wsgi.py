"""
WSGI config for viewtube project.

Exposes the WSGI callable as a module-level variable named ``application``.
Used by Gunicorn for synchronous HTTP (fallback / health-check containers).
Primary production server is Daphne via asgi.py.
"""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viewtube.settings')

application = get_wsgi_application()
