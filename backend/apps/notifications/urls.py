from django.urls import path
from . import views

urlpatterns = [
    path('', views.NotificationListView.as_view(), name='notifications'),
    path('unread/', views.unread_count, name='unread-count'),
    path('mark-read/', views.mark_all_read, name='mark-all-read'),
]
