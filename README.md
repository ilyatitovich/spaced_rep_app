# 📚 Spaced Repetition App

A lightweight and mobile-friendly **spaced repetition learning app** designed to help you remember anything efficiently.

This project focuses on **fast UX**, **offline support via IndexedDB**, and a clean UI.

## 🚀 Features

- **Spaced repetition algorithm** based on week-by-week review logic
- **Mobile-first UI** with smooth transitions and gestures
- **Instant offline storage** using IndexedDB
- Create, edit, and delete topics and flashcards
- Flashcards supports text, images, and code snippets
- Portable JSON-based backup and restore system for data migration between devices

## 🛠️ Tech Stack

**Frontend**

- **React 18** – UI framework
- **React Router 7** – navigation & URL state
- **Motion (Framer Motion v2 API)** – animations
- **Lucide-React** – icons
- **React Hot Toast** – notifications
- **TailwindCSS** – styling

**Backend**

- **Express 5** – HTTP API (`apps/server`)
- **Prisma 7** – PostgreSQL ORM
- **PostgreSQL 17** + **Redis 7** via Docker Compose

**Storage**

- IndexedDB (custom wrapper + transactions) on the client

## 💡 Inspiration

The core concept is inspired by [Nicky Case’s interactive explanation of spaced repetition](https://ncase.me/remember/)

The goal of this app is to bring that idea into a **practical, everyday tool**.

## 🏗️ Local Development

```bash
pnpm install
pnpm dev
```

The app runs on `http://localhost:5173`.

### Docker (Postgres + Redis + server)

```bash
cp .env.example .env
cp apps/server/src/.env.example apps/server/src/.env
pnpm docker:up
```

- Compose `DATABASE_URL` uses hostname `postgres` (Docker network).
- Local Prisma CLI / host-side server use `localhost:5433` (see `apps/server/src/.env.example`).

### Prisma

Required env var: **`DATABASE_URL`** (see `.env.example` and `apps/server/src/.env.example`).

```bash
# Generate the Prisma Client (also runs on server package postinstall)
pnpm prisma:generate

# Create / apply migrations in development (interactive)
pnpm prisma:migrate

# Apply existing migrations (CI / production — does not auto-run on app start)
pnpm prisma:migrate:deploy

# Browse data
pnpm prisma:studio
```

Or from `apps/server`:

```bash
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:migrate:deploy
pnpm prisma:studio
```

Import the shared client in server code:

```ts
import { prisma } from './shared/lib/prisma.js'
```

## 📝 License

MIT — feel free to use and modify.
