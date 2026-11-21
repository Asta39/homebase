# Homebase

A study planner and home dashboard for students preparing for IGCSE exams. It's a Windows desktop app built with Tauri. All data stays on the device, and the AI features use Groq's free API.

## Features

- **Home dashboard**: clock, activity rings (Study / Move / Mind), XP and levels, daily quests, badges, the day's agenda, exam countdown, weather, workout, wellbeing and meals.
- **Home mode**: a full-screen, always-on version of the dashboard for a screen by the fridge. It keeps the screen awake and dims at night.
- **Calendar**: Apple-style week, day and month views with drag-and-drop events.
- **Study, per subject**:
  - Notes from PDFs, Word files and photos (with OCR).
  - Search notes by meaning (embeddings run on the device).
  - Chat with your notes, with citations.
  - Flashcards with spaced repetition (FSRS).
  - Syllabus tracker with red / amber / green ratings.
  - Past-paper marking.
  - Weekend recap of everything you didn't get.
- **Studio**: quizzes, revision sheets, mind maps and a two-voice audio overview, all made from your notes.
- **Planner**: fills free time with revision before exams, weighted toward weak topics.
- **Focus timer**, **workout tracking**, **habits and wellbeing**, **meal planner and shopping list**, **weekly report card**.
- **Voice quick-add** (Ctrl+K): "Chemistry homework Thursday 4pm" goes straight onto the calendar.
- **Themes**: Classic, Cherry Glam, Kitty and Midnight Blue, each in light or dark.

## Tech

React, TypeScript, Vite, Tailwind, Dexie (IndexedDB), Tauri 2, Groq (gpt-oss and Whisper), Transformers.js, pdf.js, Tesseract.js, ts-fsrs and FullCalendar.

## Develop

```bash
npm install
npm run dev          # in the browser at http://localhost:1420
npm run tauri dev    # as a desktop app
```

## Windows installer

Push a tag such as `v0.1.0`. GitHub Actions then builds the `.exe` and `.msi` installers and attaches them to a draft release (see `.github/workflows/windows-release.yml`).

The installer doesn't need admin rights. The first time it runs, Windows SmartScreen may show a warning: click **More info → Run anyway**.

## Setup

When the app first launches it asks for a name, a theme, a free Groq API key (from console.groq.com), a town for the weather, and the subjects with their exam dates. Everything can be changed later in Settings.
