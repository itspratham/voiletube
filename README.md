# 📺 ViewTube — YouTube-like Video Platform

A full-stack video sharing platform built with **Django**, **React**, and **AWS**.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          AWS Cloud (us-east-1)                      │
│                                                                     │
│  ┌──────────┐   HTTPS    ┌─────────┐    ┌──────────────────────┐  │
│  │ CloudFront│──────────▶│   ALB   │───▶│  ECS Fargate (API)   │  │
│  │   (CDN)  │            └─────────┘    │  Django + Daphne     │  │
│  └──────────┘                           │  (WebSocket + HTTP)  │  │
│       │                                 └──────────┬───────────┘  │
│       │ media                                      │              │
│  ┌────▼─────┐                          ┌───────────▼───────────┐  │
│  │ S3 Bucket│◀── upload/transcode ─────│ Celery Workers        │  │
│  │ (media)  │                          │ (video transcoding)   │  │
│  └──────────┘                          └───────────────────────┘  │
│                                                   │               │
│  ┌────────────┐     ┌─────────────┐  ┌────────────▼──────────┐   │
│  │ RDS        │     │ ElastiCache │  │ AWS MediaConvert       │   │
│  │ PostgreSQL │     │ Redis       │  │ (HLS transcoding)      │   │
│  └────────────┘     └─────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

React SPA (Vite + Tailwind)
  ↕ REST API  ↕ WebSocket (notifications)
Django REST Framework
  ↕
PostgreSQL  Redis  S3/CloudFront
```

---

## ✨ Features

### Video
- Upload videos (MP4, WebM, MOV up to 500 MB)
- Async transcoding to 360p / 480p / 720p / 1080p via AWS MediaConvert or local FFmpeg
- HLS adaptive bitrate streaming
- Custom HLS video player with quality switcher, fullscreen, seek, volume
- Thumbnails, tags, categories, visibility settings

### User & Channel
- JWT authentication (access + refresh tokens with auto-refresh)
- User registration & login modal
- Channel pages with banner, bio, subscriber count
- Creator Studio dashboard with analytics

### Social
- Like / Dislike videos and comments
- Nested comments with replies
- Subscribe / Unsubscribe channels
- Real-time notifications via WebSocket (Django Channels)
- Watch Later, Watch History

### Search & Discovery
- Full-text search across title, description, and tags
- Trending page (sorted by views)
- Category filter chips
- Sort by relevance, date, views, rating

### Infrastructure
- Containerized with Docker & Docker Compose (dev)
- Production-ready Terraform for AWS (VPC, ECS Fargate, RDS, ElastiCache, S3, CloudFront, ALB)
- GitHub Actions CI/CD with automatic deploy on merge to `main`
- Nginx reverse proxy with WebSocket support

---

## 📁 Project Structure

```
viewtube/
├── backend/                  # Django project
│   ├── apps/
│   │   ├── users/            # Auth, profiles
│   │   ├── videos/           # Upload, stream, search
│   │   ├── comments/         # Comments & replies
│   │   ├── subscriptions/    # Subscribe/unsubscribe
│   │   └── notifications/    # WebSocket notifications
│   ├── viewtube/             # Django settings, URLs, Celery, ASGI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                 # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/       # Header, Sidebar, NotificationPanel
│   │   │   ├── player/       # HLS VideoPlayer
│   │   │   ├── video/        # VideoCard, VideoGrid, UploadModal
│   │   │   ├── comments/     # CommentsSection with nested replies
│   │   │   └── auth/         # AuthModal (login/register)
│   │   ├── pages/            # HomePage, WatchPage, SearchPage,
│   │   │                     # ChannelPage, StudioPage, …
│   │   ├── store/            # Redux Toolkit (auth, ui slices)
│   │   ├── services/         # Axios API service helpers
│   │   └── utils/            # formatCount, formatTimeAgo, …
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── nginx.conf
├── infrastructure/           # Terraform (AWS)
│   └── main.tf               # VPC, ECS, RDS, Redis, S3, CloudFront
├── .github/workflows/
│   └── deploy.yml            # CI/CD pipeline
└── docker-compose.yml        # Full local dev stack
```

---

## 🚀 Local Development

### Prerequisites
- Docker & Docker Compose
- Node 20+ (for frontend without Docker)
- Python 3.11+ (for backend without Docker)

### With Docker (recommended)

```bash
# 1. Clone the repo
git clone https://github.com/yourname/viewtube.git
cd viewtube

# 2. Copy env file
cp backend/.env.example backend/.env
# Edit backend/.env — set SECRET_KEY, etc.

# 3. Start all services
docker compose up --build

# The app is now running:
#   Frontend: http://localhost:3000
#   API:      http://localhost:8000/api/
#   Docs:     http://localhost:8000/api/docs/
```

### Without Docker

```bash
# ── Backend ──────────────────────────────────────────────────────────
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit values

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# In another terminal — Celery worker
celery -A viewtube worker -l info

# ── Frontend ─────────────────────────────────────────────────────────
cd frontend
npm install
npm run dev
```

---

## ☁️ AWS Deployment

### 1. Install Terraform & AWS CLI

```bash
brew install terraform awscli   # macOS
aws configure
```

### 2. Create Terraform state bucket

```bash
aws s3 mb s3://viewtube-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket viewtube-terraform-state \
  --versioning-configuration Status=Enabled
```

### 3. Provision infrastructure

```bash
cd infrastructure
terraform init
terraform plan -var="db_password=YourSecurePass" -var="django_secret=YourSecretKey"
terraform apply -var="db_password=YourSecurePass" -var="django_secret=YourSecretKey"
```

### 4. Build & push Docker images

```bash
# Get ECR URL from terraform output
ECR_URL=$(terraform output -raw ecr_api_url)

aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URL

cd ../backend
docker build -t $ECR_URL:latest .
docker push $ECR_URL:latest
```

### 5. Configure GitHub Actions secrets

Add these in your GitHub repo → Settings → Secrets:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `S3_FRONTEND_BUCKET` | Frontend bucket name |
| `CLOUDFRONT_DISTRIBUTION_ID` | CloudFront dist ID |
| `VITE_API_URL` | `https://your-alb-dns.elb.amazonaws.com/api` |
| `ECS_SUBNET` | Private subnet ID |
| `ECS_SG` | ECS security group ID |

Push to `main` to trigger automated deploy.

---

## 🔌 API Reference

Full OpenAPI docs available at `/api/docs/` when running.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register/` | Register |
| POST | `/api/auth/login/` | Login (JWT) |
| GET  | `/api/videos/` | List videos |
| POST | `/api/videos/upload/` | Upload video |
| GET  | `/api/videos/{id}/` | Video detail |
| POST | `/api/videos/{id}/like/` | Like/dislike |
| GET  | `/api/videos/trending/` | Trending |
| GET  | `/api/videos/search/?q=…` | Search |
| GET  | `/api/comments/video/{id}/` | Comments |
| POST | `/api/subscriptions/{username}/` | Subscribe |
| WS   | `ws://host/ws/notifications/` | Live notifications |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Redux Toolkit, React Query |
| Video Player | Custom HLS.js player with adaptive streaming |
| Backend | Django 4.2, Django REST Framework, SimpleJWT |
| Real-time | Django Channels (WebSocket), Redis channel layer |
| Task Queue | Celery + Redis |
| Database | PostgreSQL 15 |
| Storage | AWS S3 + CloudFront CDN |
| Transcoding | AWS MediaConvert (prod) / FFmpeg (dev) |
| Container | Docker, Docker Compose |
| IaC | Terraform |
| CI/CD | GitHub Actions |
| Hosting | AWS ECS Fargate, RDS, ElastiCache |

---

## 📄 License

MIT
