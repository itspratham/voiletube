from django.urls import path
from . import views

urlpatterns = [
    path('', views.my_subscriptions, name='my-subscriptions'),
    path('<str:username>/', views.toggle_subscription, name='toggle-subscription'),
    path('<str:username>/notifications/', views.update_notification, name='update-notification'),
]
