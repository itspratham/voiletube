from django.contrib.auth.models import AbstractUser
from django.db import models
from urllib.parse import quote
import uuid


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    banner = models.ImageField(upload_to='banners/', null=True, blank=True)
    bio = models.TextField(max_length=1000, blank=True)
    channel_name = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    verified = models.BooleanField(default=False)
    subscribers_count = models.PositiveIntegerField(default=0)
    total_views = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.email

    @property
    def display_name(self):
        return self.channel_name or self.username

    @property
    def avatar_url(self):
        if self.avatar:
            return self.avatar.url
        initials = self.avatar_initials
        bg_color, text_color = self.avatar_colors
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">'
            f'<rect width="160" height="160" rx="80" fill="{bg_color}"/>'
            f'<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" '
            f'font-family="Inter, Arial, sans-serif" font-size="56" font-weight="700" fill="{text_color}">'
            f'{initials}'
            '</text>'
            '</svg>'
        )
        return f'data:image/svg+xml;charset=UTF-8,{quote(svg)}'

    @property
    def avatar_initials(self):
        name_parts = [self.first_name.strip(), self.last_name.strip()]
        initials = ''.join(part[0] for part in name_parts if part)
        if initials:
            return initials[:2].upper()
        return (self.channel_name or self.username or self.email or 'U')[:2].upper()

    @property
    def avatar_colors(self):
        palette = [
            ('#2563EB', '#EFF6FF'),
            ('#0F766E', '#ECFDF5'),
            ('#BE123C', '#FFF1F2'),
            ('#7C3AED', '#F5F3FF'),
            ('#C2410C', '#FFF7ED'),
            ('#0369A1', '#F0F9FF'),
            ('#4D7C0F', '#F7FEE7'),
            ('#A21CAF', '#FDF4FF'),
        ]
        key = str(self.id or self.email or self.username)
        index = sum(ord(char) for char in key) % len(palette)
        return palette[index]
