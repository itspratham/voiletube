from django.contrib import admin
from .models import Notification  # noqa — register models as needed

admin.site.register(Notification)