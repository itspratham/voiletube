from django.urls import path
from . import views

urlpatterns = [
    path('', views.VideoListView.as_view(), name='video-list'),
    path('upload/', views.VideoUploadView.as_view(), name='video-upload'),
    path('trending/', views.trending, name='trending'),
    path('search/', views.search, name='video-search'),
    path('feed/', views.feed, name='feed'),
    path('history/', views.watch_history, name='watch-history'),
    path('liked/', views.liked_videos, name='liked-videos'),
    path('watch-later/', views.WatchLaterView.as_view(), name='watch-later-list'),
    path('watch-later/<uuid:video_id>/', views.watch_later, name='watch-later'),
    path('<uuid:video_id>/stream/', views.stream_video, name='video-stream'),
    path('playlists/', views.PlaylistListView.as_view(), name='my-playlists'),
    path('playlists/<uuid:pk>/', views.PlaylistDetailView.as_view(), name='playlist-detail'),
    path('playlists/<uuid:playlist_id>/videos/<uuid:video_id>/', views.playlist_video, name='playlist-video'),
    path('playlists/<uuid:playlist_id>/videos/<uuid:video_id>/reorder/', views.playlist_video_reorder, name='playlist-video-reorder'),
    path('categories/', views.CategoryListView.as_view(), name='categories'),
    path('<uuid:id>/', views.VideoDetailView.as_view(), name='video-detail'),
    path('<uuid:video_id>/like/', views.like_video, name='video-like'),
    path('channel/<str:username>/', views.UserVideosView.as_view(), name='user-videos'),
    path('channel/<str:username>/playlists/', views.PlaylistListView.as_view(), name='user-playlists'),
]
