from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# drf-spectacular provides interactive API docs.
# SpectacularSwaggerUIView renders the Swagger UI at /api/docs/
# SpectacularRedocView renders the ReDoc UI at /api/redoc/
from drf_spectacular.views import (
    SpectacularAPIView,
    # SpectacularSwaggerUIView,
    SpectacularRedocView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI schema (JSON) — consumed by both UIs below
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),

    # Swagger UI  → http://localhost:8000/api/docs/
    # path('api/docs/', SpectacularSwaggerUIView.as_view(url_name='schema'), name='swagger-ui'),

    # ReDoc UI    → http://localhost:8000/api/redoc/
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # App endpoints
    path('api/auth/', include('apps.users.urls')),
    path('api/videos/', include('apps.videos.urls')),
    path('api/comments/', include('apps.comments.urls')),
    path('api/subscriptions/', include('apps.subscriptions.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
]

# Serve media files locally in development (USE_S3=False).
# In production Django never serves media — CloudFront + S3 handle it.
if not settings.USE_S3:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
