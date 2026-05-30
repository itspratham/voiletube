import random
import subprocess
import tempfile
import urllib.request
from datetime import timedelta
from io import BytesIO

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone

from apps.comments.models import Comment, CommentLike
from apps.notifications.models import Notification
from apps.subscriptions.models import Subscription
from apps.users.models import User
from apps.videos.models import (
    Category,
    Playlist,
    PlaylistVideo,
    Tag,
    Video,
    VideoLike,
    VideoView,
    WatchLater,
)
from apps.videos.media_utils import probe_video_metadata
from apps.videos.thumbnail_utils import generate_video_thumbnail


SEED_USERNAMES = [
    'mayaframes',
    'byteatlas',
    'neonchef',
    'stadiumdaily',
    'quietscience',
    'travelwithira',
    'devdock',
    'nora.viewer',
]

CATEGORIES = [
    ('Music', 'music', 'Music'),
    ('Gaming', 'gaming', 'Gamepad2'),
    ('News', 'news', 'Newspaper'),
    ('Sports', 'sports', 'Trophy'),
    ('Technology', 'technology', 'Cpu'),
    ('Education', 'education', 'GraduationCap'),
    ('Comedy', 'comedy', 'Smile'),
    ('Science', 'science', 'Atom'),
    ('Travel', 'travel', 'Plane'),
    ('Food', 'food', 'Utensils'),
]

USERS = [
    {
        'username': 'mayaframes',
        'email': 'maya.frames@example.com',
        'channel_name': 'Maya Frames',
        'bio': 'Cinematic essays, creator diaries, and behind-the-shot breakdowns.',
        'website': 'https://example.com/maya',
        'subscribers_count': 24800,
    },
    {
        'username': 'byteatlas',
        'email': 'byte.atlas@example.com',
        'channel_name': 'Byte Atlas',
        'bio': 'Readable technology explainers for builders, founders, and curious people.',
        'website': 'https://example.com/byteatlas',
        'subscribers_count': 18400,
    },
    {
        'username': 'neonchef',
        'email': 'neon.chef@example.com',
        'channel_name': 'Neon Chef',
        'bio': 'Fast food science, street food stories, and late-night kitchen experiments.',
        'website': 'https://example.com/neonchef',
        'subscribers_count': 8200,
    },
    {
        'username': 'stadiumdaily',
        'email': 'stadium.daily@example.com',
        'channel_name': 'Stadium Daily',
        'bio': 'Match analysis, training notes, and the culture around modern sport.',
        'website': 'https://example.com/stadium',
        'subscribers_count': 32100,
    },
    {
        'username': 'quietscience',
        'email': 'quiet.science@example.com',
        'channel_name': 'Quiet Science',
        'bio': 'Small experiments and big ideas, explained calmly.',
        'website': 'https://example.com/quietscience',
        'subscribers_count': 6400,
    },
    {
        'username': 'travelwithira',
        'email': 'ira.travels@example.com',
        'channel_name': 'Travel with Ira',
        'bio': 'Slow travel guides, local rituals, and honest city notes.',
        'website': 'https://example.com/ira',
        'subscribers_count': 4700,
    },
    {
        'username': 'devdock',
        'email': 'dev.dock@example.com',
        'channel_name': 'Dev Dock',
        'bio': 'Practical software builds, product teardowns, and engineering workflows.',
        'website': 'https://example.com/devdock',
        'subscribers_count': 12600,
    },
    {
        'username': 'nora.viewer',
        'email': 'nora.viewer@example.com',
        'channel_name': 'Nora Viewer',
        'bio': 'Sample viewer account for testing feeds, likes, history, and playlists.',
        'website': '',
        'subscribers_count': 0,
    },
]

VIDEO_BLUEPRINTS = [
    ('mayaframes', 'Music', 'How lo-fi videos create instant atmosphere', 742, ['lofi', 'cinema', 'editing']),
    ('mayaframes', 'Travel', 'A rainy evening walk through old Mumbai', 934, ['travel', 'city', 'cinematic']),
    ('mayaframes', 'Education', 'Color grading basics for new creators', 1180, ['editing', 'tutorial', 'cinema']),
    ('byteatlas', 'Technology', 'I rebuilt my desk around one cable', 814, ['setup', 'hardware', 'workflow']),
    ('byteatlas', 'Science', 'Why batteries feel like magic and behave like chemistry', 1262, ['battery', 'science', 'explainer']),
    ('byteatlas', 'Education', 'APIs explained with a restaurant kitchen', 646, ['api', 'backend', 'learning']),
    ('neonchef', 'Food', 'Five-minute ramen that still tastes expensive', 512, ['ramen', 'home cooking', 'quick meals']),
    ('neonchef', 'Comedy', 'Trying viral kitchen hacks so you do not have to', 688, ['food', 'comedy', 'viral']),
    ('neonchef', 'Travel', 'Street snacks under the flyover', 973, ['street food', 'travel', 'snacks']),
    ('stadiumdaily', 'Sports', 'The defensive shape everyone missed', 701, ['football', 'analysis', 'tactics']),
    ('stadiumdaily', 'News', 'Transfer window recap in twelve minutes', 742, ['sports news', 'transfers', 'recap']),
    ('stadiumdaily', 'Education', 'How athletes recover after back-to-back games', 905, ['fitness', 'recovery', 'sports science']),
    ('quietscience', 'Science', 'A homemade cloud chamber, safely explained', 1098, ['physics', 'experiment', 'science']),
    ('quietscience', 'Education', 'What plants are doing while you sleep', 833, ['biology', 'plants', 'learning']),
    ('quietscience', 'Technology', 'The sensors hiding inside your phone', 786, ['sensors', 'mobile', 'engineering']),
    ('travelwithira', 'Travel', 'The best first day in Kyoto without rushing', 1196, ['kyoto', 'guide', 'slow travel']),
    ('travelwithira', 'Food', 'Breakfast markets before sunrise', 655, ['markets', 'food', 'travel']),
    ('travelwithira', 'Music', 'Buskers who changed the mood of a whole street', 574, ['music', 'street', 'travel']),
    ('devdock', 'Technology', 'Shipping a React feature without losing the plot', 1047, ['react', 'frontend', 'product']),
    ('devdock', 'Gaming', 'Building a tiny game loop from scratch', 882, ['game dev', 'javascript', 'loop']),
    ('devdock', 'Education', 'Database indexes explained with library shelves', 731, ['database', 'backend', 'learning']),
    ('byteatlas', 'News', 'The week in AI tools for creators', 623, ['ai', 'creator tools', 'news']),
    ('mayaframes', 'Comedy', 'Every creator before uploading at 2 AM', 397, ['creator life', 'comedy', 'sketch']),
    ('stadiumdaily', 'Gaming', 'Can sports games teach real tactics?', 817, ['gaming', 'sports', 'analysis']),
]

COMMENT_SNIPPETS = [
    'This made the topic click for me.',
    'The pacing here is excellent.',
    'I sent this to my group chat immediately.',
    'That example at the end was surprisingly useful.',
    'More videos like this, please.',
    'The production quality keeps getting better.',
    'I did not expect to learn this much today.',
    'Saved this one for later.',
]

REPLY_SNIPPETS = [
    'Same here, that part was the best.',
    'Agreed. The explanation was very clear.',
    'I tried it after watching and it worked.',
    'There is a follow-up idea in there.',
]

PALETTES = [
    ('#1F2937', '#F59E0B'),
    ('#0F766E', '#F8FAFC'),
    ('#7C2D12', '#FDBA74'),
    ('#1D4ED8', '#DBEAFE'),
    ('#581C87', '#F5D0FE'),
    ('#166534', '#DCFCE7'),
    ('#BE123C', '#FFE4E6'),
    ('#111827', '#A7F3D0'),
]

SAMPLE_VIDEO_URLS = [
    ('seawater-360p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-sd_640_360_30fps.mp4'),
    ('seawater-540p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-sd_960_540_30fps.mp4'),
    ('seawater-720p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-hd_1280_720_30fps.mp4'),
    ('seawater-1080p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-hd_1920_1080_30fps.mp4'),
    ('seawater-1440p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-uhd_2560_1440_30fps.mp4'),
    ('seawater-2160p.mp4', 'https://disk.sample.cat/samples/mp4/1416529-uhd_3840_2160_30fps.mp4'),
]

CATEGORY_VIDEO_STYLES = {
    'Music': ('music.mp4', 'MUSIC', 'studio lights / rhythm / waveform', '#1E1B4B', '#F472B6'),
    'Gaming': ('gaming.mp4', 'GAMING', 'controller cam / neon arena / live match', '#111827', '#22D3EE'),
    'News': ('news.mp4', 'NEWS', 'breaking desk / city feed / live ticker', '#172554', '#FBBF24'),
    'Sports': ('sports.mp4', 'SPORTS', 'match day / training / scoreboard', '#064E3B', '#A3E635'),
    'Technology': ('technology.mp4', 'TECH', 'code flow / devices / product lab', '#0F172A', '#38BDF8'),
    'Education': ('education.mp4', 'EDUCATION', 'lesson notes / diagrams / study room', '#312E81', '#FDE68A'),
    'Comedy': ('comedy.mp4', 'COMEDY', 'sketch cuts / punchline / creator room', '#7C2D12', '#FDBA74'),
    'Science': ('science.mp4', 'SCIENCE', 'experiment / data / discovery', '#164E63', '#67E8F9'),
    'Travel': ('travel.mp4', 'TRAVEL', 'city walk / transit / local guide', '#14532D', '#FACC15'),
    'Food': ('food.mp4', 'FOOD', 'kitchen prep / market / plated shot', '#7F1D1D', '#FCA5A5'),
}


class Command(BaseCommand):
    help = 'Seed the database with realistic sample ViewTube content.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete existing sample users and their related content before seeding.',
        )
        parser.add_argument(
            '--password',
            default='Password123!',
            help='Password assigned to all sample users.',
        )
        parser.add_argument(
            '--local-videos',
            action='store_true',
            help='Use local files from media/videos/original instead of downloaded sample videos.',
        )
        parser.add_argument(
            '--remote-videos',
            action='store_true',
            help='Store public sample video URLs directly instead of downloading files into media/videos/sample.',
        )
        parser.add_argument(
            '--generic-sample-videos',
            action='store_true',
            help='Download generic sample MP4s instead of generating category-specific local clips.',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        random.seed(42)

        if options['reset']:
            self._delete_seed_data()
        else:
            self._delete_seed_data()

        categories = self._seed_categories()
        users = self._seed_users(options['password'])
        videos = self._seed_videos(
            users,
            categories,
            use_local_videos=options['local_videos'],
            use_remote_videos=options['remote_videos'],
            use_generic_samples=options['generic_sample_videos'],
        )
        self._seed_subscriptions(users)
        self._seed_likes(users, videos)
        self._seed_comments(users, videos)
        self._seed_watch_history(users, videos)
        self._seed_watch_later(users, videos)
        self._seed_playlists(users, videos)
        self._seed_notifications(users, videos)
        self._refresh_counters(users, videos)

        self.stdout.write(self.style.SUCCESS('Sample data seeded successfully.'))
        self.stdout.write(
            'Login with any sample email using password '
            f'{options["password"]!r}; try nora.viewer@example.com for a viewer account.'
        )
        self.stdout.write(f'Created {len(users)} users, {len(videos)} videos, and realistic related data.')

    def _delete_seed_data(self):
        User.objects.filter(username__in=SEED_USERNAMES).delete()
        Category.objects.filter(slug__in=[slug for _, slug, _ in CATEGORIES]).delete()
        Category.objects.filter(slug__iexact='all').delete()
        Tag.objects.filter(name__in=self._all_seed_tags()).delete()

    def _seed_categories(self):
        categories = {}
        for name, slug, icon in CATEGORIES:
            category, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={'name': name, 'icon': icon},
            )
            categories[name] = category
        return categories

    def _seed_users(self, password):
        users = {}
        for index, data in enumerate(USERS):
            user = User.objects.create_user(
                username=data['username'],
                email=data['email'],
                password=password,
                first_name=data['channel_name'].split()[0],
                last_name=' '.join(data['channel_name'].split()[1:]),
                channel_name=data['channel_name'],
                bio=data['bio'],
                website=data['website'],
                verified=data['subscribers_count'] >= 10000,
                subscribers_count=data['subscribers_count'],
            )
            users[user.username] = user
        return users

    def _seed_videos(
        self,
        users,
        categories,
        use_local_videos=False,
        use_remote_videos=False,
        use_generic_samples=False,
    ):
        now = timezone.now()
        videos = []
        local_video_files = []
        category_video_files = {}
        if use_local_videos:
            local_video_files = self._original_video_file_names()
        elif not use_remote_videos:
            if use_generic_samples:
                local_video_files = self._download_sample_video_file_names()
            else:
                category_video_files = self._generate_category_video_file_names()

        for index, (username, category_name, title, duration, tag_names) in enumerate(VIDEO_BLUEPRINTS):
            uploader = users[username]
            days_ago = index * 2 + random.randint(0, 2)
            published_at = now - timedelta(days=days_ago, hours=random.randint(1, 20))
            local_video_file = category_video_files.get(category_name, '')
            if not local_video_file and local_video_files:
                local_video_file = local_video_files[index % len(local_video_files)]
            internet_video_url = SAMPLE_VIDEO_URLS[index % len(SAMPLE_VIDEO_URLS)][1]
            actual_duration = self._duration_for_video_file(local_video_file) or duration
            video = Video.objects.create(
                uploader=uploader,
                title=title,
                description=self._description_for(title, category_name),
                category=categories[category_name],
                video_file=local_video_file,
                duration=actual_duration,
                views_count=random.randint(850, 185000),
                likes_count=0,
                dislikes_count=0,
                comments_count=0,
                status='published',
                published_at=published_at,
                created_at=published_at,
                url_360p='' if local_video_file else internet_video_url,
                url_480p='' if local_video_file else internet_video_url,
                url_720p='' if local_video_file else internet_video_url,
                hls_url='',
            )
            for tag_name in tag_names:
                tag, _ = Tag.objects.get_or_create(name=tag_name.lower())
                video.tags.add(tag)
            self._attach_thumbnail(video, title, category_name, index)
            Video.objects.filter(pk=video.pk).update(created_at=published_at, updated_at=published_at)
            videos.append(video)
        return videos

    def _seed_subscriptions(self, users):
        viewer_names = list(users.keys())
        for subscriber_name in viewer_names:
            subscriber = users[subscriber_name]
            for channel_name in viewer_names:
                if subscriber_name == channel_name:
                    continue
                should_subscribe = (
                    subscriber_name == 'nora.viewer'
                    or random.random() < 0.42
                )
                if should_subscribe:
                    Subscription.objects.get_or_create(
                        subscriber=subscriber,
                        channel=users[channel_name],
                        defaults={'notify': random.random() > 0.2},
                    )

    def _seed_likes(self, users, videos):
        user_list = list(users.values())
        for video in videos:
            likers = random.sample(user_list, k=random.randint(3, min(7, len(user_list))))
            for user in likers:
                if user == video.uploader:
                    continue
                VideoLike.objects.get_or_create(user=user, video=video, defaults={'action': VideoLike.LIKE})
            if random.random() < 0.25:
                possible_dislikers = [user for user in user_list if user not in likers and user != video.uploader]
                if possible_dislikers:
                    VideoLike.objects.get_or_create(
                        user=random.choice(possible_dislikers),
                        video=video,
                        defaults={'action': VideoLike.DISLIKE},
                    )

    def _seed_comments(self, users, videos):
        user_list = list(users.values())
        now = timezone.now()
        for index, video in enumerate(videos):
            commenters = random.sample([user for user in user_list if user != video.uploader], k=3)
            for comment_index, author in enumerate(commenters):
                comment = Comment.objects.create(
                    video=video,
                    author=author,
                    content=random.choice(COMMENT_SNIPPETS),
                    is_pinned=comment_index == 0 and index % 5 == 0,
                )
                created_at = now - timedelta(days=max(index - comment_index, 0), hours=random.randint(1, 12))
                Comment.objects.filter(pk=comment.pk).update(created_at=created_at, updated_at=created_at)
                for liker in random.sample(user_list, k=random.randint(1, 4)):
                    if liker != author:
                        CommentLike.objects.get_or_create(user=liker, comment=comment)
                if comment_index < 2:
                    reply_author = random.choice([user for user in user_list if user != author])
                    reply = Comment.objects.create(
                        video=video,
                        author=reply_author,
                        parent=comment,
                        content=random.choice(REPLY_SNIPPETS),
                    )
                    Comment.objects.filter(pk=reply.pk).update(
                        created_at=created_at + timedelta(minutes=random.randint(8, 80)),
                        updated_at=created_at + timedelta(minutes=random.randint(8, 80)),
                    )

    def _seed_watch_history(self, users, videos):
        viewer = users['nora.viewer']
        for video in videos[:18]:
            VideoView.objects.create(
                video=video,
                user=viewer,
                ip_address='127.0.0.1',
                watch_duration=self._watch_duration(video, 650),
            )

        for user in users.values():
            if user == viewer:
                continue
            for video in random.sample(videos, k=5):
                VideoView.objects.create(
                    video=video,
                    user=user,
                    ip_address='127.0.0.1',
                    watch_duration=self._watch_duration(video, 500),
                )

    def _seed_watch_later(self, users, videos):
        viewer = users['nora.viewer']
        for video in videos[5:14]:
            WatchLater.objects.get_or_create(user=viewer, video=video)
        for user in users.values():
            if user == viewer:
                continue
            for video in random.sample(videos, k=3):
                WatchLater.objects.get_or_create(user=user, video=video)

    def _watch_duration(self, video, max_seconds):
        duration = max(1, int(video.duration or 1))
        upper_bound = max(1, min(duration, max_seconds))
        lower_bound = 1 if upper_bound < 15 else 15
        return random.randint(lower_bound, upper_bound)

    def _seed_playlists(self, users, videos):
        definitions = [
            ('nora.viewer', 'Weekend watchlist', 'Videos to watch with coffee.', videos[:8]),
            ('nora.viewer', 'Learn something useful', 'Clear explainers and practical tutorials.', videos[4:15:2]),
            ('devdock', 'Build better products', 'Engineering and design references.', videos[18:21] + videos[3:6]),
            ('travelwithira', 'Food and city walks', 'Travel videos with strong local texture.', videos[1:3] + videos[15:18]),
        ]
        for username, title, description, selected_videos in definitions:
            playlist = Playlist.objects.create(
                owner=users[username],
                title=title,
                description=description,
                is_public=username != 'nora.viewer' or title != 'Weekend watchlist',
            )
            for position, video in enumerate(selected_videos):
                PlaylistVideo.objects.create(playlist=playlist, video=video, position=position)

    def _seed_notifications(self, users, videos):
        viewer = users['nora.viewer']
        for video in videos[:10]:
            Notification.objects.create(
                recipient=viewer,
                sender=video.uploader,
                notification_type='new_video',
                message=f'{video.uploader.display_name} uploaded: {video.title}',
                link=f'/watch/{video.id}',
                is_read=random.random() < 0.35,
            )

        for username, user in users.items():
            if username == 'nora.viewer':
                continue
            Notification.objects.create(
                recipient=user,
                sender=viewer,
                notification_type='subscription',
                message=f'{viewer.display_name} subscribed to your channel.',
                link=f'/channel/{viewer.username}',
                is_read=random.random() < 0.5,
            )

    def _refresh_counters(self, users, videos):
        for video in videos:
            counts = VideoLike.objects.filter(video=video).values('action').annotate(total=Count('id'))
            like_counts = {row['action']: row['total'] for row in counts}
            comment_count = Comment.objects.filter(video=video, parent__isnull=True).count()
            Video.objects.filter(pk=video.pk).update(
                likes_count=like_counts.get(VideoLike.LIKE, 0),
                dislikes_count=like_counts.get(VideoLike.DISLIKE, 0),
                comments_count=comment_count,
            )

        for comment in Comment.objects.filter(video__in=videos):
            Comment.objects.filter(pk=comment.pk).update(likes_count=comment.likes.count())

        for user in users.values():
            total_views = Video.objects.filter(uploader=user).aggregate(total=Sum('views_count'))['total'] or 0
            User.objects.filter(pk=user.pk).update(
                verified=user.subscribers_count >= 10000,
                total_views=total_views,
            )

    def _description_for(self, title, category_name):
        return (
            f'{title}\n\n'
            f'A polished sample {category_name.lower()} upload for testing ViewTube layouts, '
            'recommendations, comments, playlists, watch history, and creator channel pages. '
            'This seeded record includes realistic counters and relationships so the frontend '
            'has enough texture to feel alive during development.'
        )

    def _attach_thumbnail(self, video, title, category_name, index):
        if video.video_file:
            try:
                if generate_video_thumbnail(video):
                    video.save(update_fields=['thumbnail'])
                    return
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f'Could not auto-thumbnail {title}: {exc}'))

        video.thumbnail.save(
            f'{self._slugify(title)}.jpg',
            ContentFile(self._make_thumbnail(title, category_name, index)),
            save=True,
        )

    def _duration_for_video_file(self, video_file_name):
        if not video_file_name:
            return 0

        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            return 0

        try:
            metadata = probe_video_metadata(media_root / video_file_name)
        except Exception as exc:
            self.stdout.write(self.style.WARNING(f'Could not read duration for {video_file_name}: {exc}'))
            return 0
        return metadata.get('duration') or 0

    def _make_thumbnail(self, title, category_name, index):
        try:
            from PIL import Image, ImageDraw, ImageFont
        except ImportError:
            return b''

        bg, accent = PALETTES[index % len(PALETTES)]
        image = Image.new('RGB', (1280, 720), bg)
        draw = ImageDraw.Draw(image)
        font_large = self._font(72)
        font_medium = self._font(34)
        font_small = self._font(28)

        draw.rectangle((0, 0, 1280, 720), fill=bg)
        draw.rectangle((0, 590, 1280, 720), fill='#0B1120')
        draw.rectangle((74, 70, 168, 164), fill=accent)
        draw.text((92, 92), str(index + 1).zfill(2), fill=bg, font=font_medium)
        draw.text((190, 88), category_name.upper(), fill=accent, font=font_small)

        y = 222
        for line in self._wrap(title, 28)[:3]:
            draw.text((78, y), line, fill='#FFFFFF', font=font_large)
            y += 86

        draw.text((78, 628), 'ViewTube sample video', fill='#CBD5E1', font=font_medium)
        draw.rectangle((1050, 610, 1208, 674), outline=accent, width=4)
        draw.text((1082, 626), 'HD', fill=accent, font=font_medium)

        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=88)
        return buffer.getvalue()

    def _make_avatar(self, display_name, index):
        try:
            from PIL import Image, ImageDraw
        except ImportError:
            return b''

        bg, accent = PALETTES[index % len(PALETTES)]
        image = Image.new('RGB', (320, 320), bg)
        draw = ImageDraw.Draw(image)
        initials = ''.join(part[0] for part in display_name.split()[:2]).upper()
        font = self._font(112)
        text_box = draw.textbbox((0, 0), initials, font=font)
        draw.ellipse((22, 22, 298, 298), fill=accent)
        draw.text(
            ((320 - (text_box[2] - text_box[0])) / 2, (320 - (text_box[3] - text_box[1])) / 2 - 10),
            initials,
            fill=bg,
            font=font,
        )
        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=90)
        return buffer.getvalue()

    def _font(self, size):
        try:
            from PIL import ImageFont

            return ImageFont.truetype('Arial.ttf', size)
        except Exception:
            from PIL import ImageFont

            return ImageFont.load_default()

    def _wrap(self, text, width):
        words = text.split()
        lines = []
        line = ''
        for word in words:
            candidate = f'{line} {word}'.strip()
            if len(candidate) > width and line:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        return lines

    def _slugify(self, value):
        return ''.join(char.lower() if char.isalnum() else '-' for char in value).strip('-')

    def _all_seed_tags(self):
        tags = set()
        for _, _, _, _, tag_names in VIDEO_BLUEPRINTS:
            tags.update(tag.lower() for tag in tag_names)
        return tags

    def _original_video_file_names(self):
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            return []

        original_dir = media_root / 'videos' / 'original'
        if not original_dir.exists():
            return []

        return [
            f'videos/original/{path.name}'
            for path in sorted(original_dir.glob('*.mp4'))
        ]

    def _download_sample_video_file_names(self):
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            return []

        sample_dir = media_root / 'videos' / 'sample'
        sample_dir.mkdir(parents=True, exist_ok=True)

        file_names = []
        for file_name, url in SAMPLE_VIDEO_URLS:
            destination = sample_dir / file_name
            if not destination.exists() or destination.stat().st_size == 0:
                self.stdout.write(f'Downloading sample video {file_name}...')
                try:
                    self._download_file(url, destination)
                except Exception as exc:
                    self.stdout.write(self.style.WARNING(f'Could not download {url}: {exc}'))
                    continue
            file_names.append(f'videos/sample/{file_name}')
        return file_names

    def _download_file(self, url, destination):
        request = urllib.request.Request(url, headers={'User-Agent': 'ViewTube seed data'})
        with urllib.request.urlopen(request, timeout=60) as response:
            with destination.open('wb') as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)

    def _generate_category_video_file_names(self):
        media_root = getattr(settings, 'MEDIA_ROOT', None)
        if not media_root:
            return {}

        output_dir = media_root / 'videos' / 'category'
        output_dir.mkdir(parents=True, exist_ok=True)

        generated = {}
        for category_name, (file_name, title, subtitle, bg_color, accent_color) in CATEGORY_VIDEO_STYLES.items():
            destination = output_dir / file_name
            if not destination.exists() or destination.stat().st_size == 0:
                self.stdout.write(f'Generating category video {file_name}...')
                try:
                    self._render_category_video(destination, title, subtitle, bg_color, accent_color)
                except Exception as exc:
                    self.stdout.write(self.style.WARNING(f'Could not generate {file_name}: {exc}'))
                    continue
            generated[category_name] = f'videos/category/{file_name}'
        return generated

    def _render_category_video(self, destination, title, subtitle, bg_color, accent_color):
        try:
            import imageio_ffmpeg
            from PIL import Image, ImageDraw
        except ImportError as exc:
            raise RuntimeError('Pillow and imageio-ffmpeg are required for category video generation') from exc

        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        width = 1280
        height = 720
        fps = 15
        frame_count = 90

        with tempfile.TemporaryDirectory() as temp_dir:
            for frame in range(frame_count):
                image = Image.new('RGB', (width, height), bg_color)
                draw = ImageDraw.Draw(image)
                progress = frame / max(frame_count - 1, 1)
                pulse = int(28 * abs(0.5 - progress))
                font_title = self._font(92)
                font_subtitle = self._font(34)
                font_meta = self._font(26)

                draw.rectangle((0, 0, width, height), fill=bg_color)
                draw.rectangle((0, height - 118, width, height), fill='#020617')
                draw.rectangle((70, 80, 240 + pulse, 250 + pulse), fill=accent_color)
                draw.rectangle((970 - pulse, 80, 1210, 250), outline=accent_color, width=6)
                draw.line((70, 508, 1210, 508), fill=accent_color, width=5)

                for i in range(8):
                    x = 120 + i * 145
                    bar_height = 36 + ((frame * (i + 2)) % 130)
                    draw.rectangle((x, 505 - bar_height, x + 42, 505), fill=accent_color)

                title_box = draw.textbbox((0, 0), title, font=font_title)
                draw.text(((width - (title_box[2] - title_box[0])) / 2, 270), title, fill='#FFFFFF', font=font_title)
                subtitle_box = draw.textbbox((0, 0), subtitle, font=font_subtitle)
                draw.text(
                    ((width - (subtitle_box[2] - subtitle_box[0])) / 2, 380),
                    subtitle,
                    fill='#CBD5E1',
                    font=font_subtitle,
                )
                draw.text((86, 635), 'ViewTube category sample', fill='#E2E8F0', font=font_meta)
                draw.text((1050, 635), f'{int(progress * 100):02d}%', fill=accent_color, font=font_meta)

                image.save(f'{temp_dir}/frame_{frame:04d}.jpg', quality=88)

            subprocess.run(
                [
                    ffmpeg_bin,
                    '-y',
                    '-framerate',
                    str(fps),
                    '-i',
                    f'{temp_dir}/frame_%04d.jpg',
                    '-c:v',
                    'libx264',
                    '-pix_fmt',
                    'yuv420p',
                    '-movflags',
                    '+faststart',
                    str(destination),
                ],
                check=True,
                capture_output=True,
                text=True,
            )
