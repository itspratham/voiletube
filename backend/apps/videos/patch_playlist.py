import os, sys, django
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'viewtube.settings')
django.setup()

with open('backend/apps/videos/views.py', 'a') as f:
    f.write('''
class PlaylistDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PlaylistSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        from django.db.models import Q
        if self.request.method in permissions.SAFE_METHODS:
            user = self.request.user if self.request.user.is_authenticated else None
            if user:
                return Playlist.objects.filter(Q(is_public=True) | Q(owner=user))
            return Playlist.objects.filter(is_public=True)
        return Playlist.objects.filter(owner=self.request.user if self.request.user.is_authenticated else None)

@api_view(['PATCH'])
@permission_classes([permissions.IsAuthenticated])
def playlist_video_reorder(request, playlist_id, video_id):
    playlist = get_object_or_404(Playlist, id=playlist_id, owner=request.user)
    video = get_object_or_404(Video, id=video_id)
    new_position = request.data.get('position')
    
    if new_position is None:
        return Response({'error': 'position is required'}, status=400)
    
    try:
        pv = PlaylistVideo.objects.get(playlist=playlist, video=video)
        old_position = pv.position
        new_position = int(new_position)
        
        other_pv = PlaylistVideo.objects.filter(playlist=playlist, position=new_position).first()
        if other_pv:
            other_pv.position = old_position
            other_pv.save()
            
        pv.position = new_position
        pv.save()
    except PlaylistVideo.DoesNotExist:
        return Response({'error': 'Video not in playlist'}, status=404)
        
    return Response({'reordered': True})
''')
