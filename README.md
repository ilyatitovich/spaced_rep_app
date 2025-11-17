# 📚 Spaced Repetition App

A lightweight and mobile-friendly **spaced repetition learning app** designed to help you remember anything efficiently.

This project focuses on **fast UX**, **offline support via IndexedDB**, and a clean UI.

---

## 🚀 Features

- 🧠 **Spaced repetition algorithm** based on week-by-week review logic
- 📱 **Mobile-first UI** with smooth transitions and gestures
- ⚡ **Instant offline storage** using IndexedDB
- 🗂️ Create, edit, and delete topics and flashcards
- 📅 Daily progress tracking
- 🎨 Modern design with animations and icons
- 🔄 URL search params–based navigation (Android-friendly back-button behavior)

---

## 🛠️ Tech Stack

**Frontend**

- **React 18** – UI framework
- **React Router 7** – navigation & URL state
- **Motion (Framer Motion v2 API)** – animations
- **Lucide-React** – icons
- **React Hot Toast** – notifications
- **TailwindCSS** – styling

**Storage**

- IndexedDB (custom wrapper + transactions)

---

## 💡 Inspiration

The core concept is inspired by [Nicky Case’s interactive explanation of spaced repetition](https://ncase.me/remember/)

The goal of this app is to bring that idea into a **practical, everyday tool**.

---

## 🏗️ Local Development

```bash
pnpm install
pnpm dev
```

The app runs on `http://localhost:5173`.

---

## 📝 License

MIT — feel free to use and modify.
