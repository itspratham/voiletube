# views.py
from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.db.models import F
from .models import Subscription
from ..users.serializers import UserSerializer

User = get_user_model()


@api_view(['POST', 'DELETE'])
@permission_classes([permissions.IsAuthenticated])
def toggle_subscription(request, username):
    channel = get_object_or_404(User, username=username)

    if channel == request.user:
        return Response({'error': 'Cannot subscribe to yourself'}, status=400)

    if request.method == 'POST':
        sub, created = Subscription.objects.get_or_create(
            subscriber=request.user, channel=channel
        )
        if created:
            User.objects.filter(pk=channel.pk).update(subscribers_count=F('subscribers_count') + 1)
        return Response({'subscribed': True, 'subscribers_count': channel.subscribers_count + 1})
    else:
        deleted, _ = Subscription.objects.filter(subscriber=request.user, channel=channel).delete()
        if deleted:
            User.objects.filter(pk=channel.pk).update(
                subscribers_count=F('subscribers_count') - 1
            )
        return Response({'subscribed': False})


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def my_subscriptions(request):
    subs = Subscription.objects.filter(subscriber=request.user).select_related('channel')
    channels = [s.channel for s in subs]
    serializer = UserSerializer(channels, many=True, context={'request': request})
    return Response(serializer.data)


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def update_notification(request, username):
    channel = get_object_or_404(User, username=username)
    notify = request.data.get('notify', True)
    Subscription.objects.filter(subscriber=request.user, channel=channel).update(notify=notify)
    return Response({'notify': notify})
