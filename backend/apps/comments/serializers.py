# serializers.py
from rest_framework import serializers
from .models import Comment
from ..users.serializers import UserSerializer


class CommentSerializer(serializers.ModelSerializer):
    author = UserSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    user_liked = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ['id', 'content', 'author', 'likes_count', 'is_pinned',
                  'replies_count', 'user_liked', 'created_at', 'updated_at']

    def get_replies_count(self, obj):
        return obj.replies.count()

    def get_user_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False