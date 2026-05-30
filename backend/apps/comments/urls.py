from django.urls import path
from .views import CommentListView, ReplyListView, CommentDetailView, like_comment

urlpatterns = [
    path('video/<uuid:video_id>/', CommentListView.as_view(), name='video-comments'),
    path('<uuid:comment_id>/replies/', ReplyListView.as_view(), name='comment-replies'),
    path('<uuid:id>/', CommentDetailView.as_view(), name='comment-detail'),
    path('<uuid:comment_id>/like/', like_comment, name='comment-like'),
]
