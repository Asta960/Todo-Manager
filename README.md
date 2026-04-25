# Todo Manager

Desktop task manager (Electron) with projects, tags, daily tasks and XP gamification.

## Features

- **Inbox / Tasks / Projects / Daily**
- **Tags + XP**: completing tasks increases XP for the selected tag
- **XP combo toast** and **Level Up** animation
- **Dev tools** (hidden): can be unlocked from Settings
- **Window state restore**: size/position are restored on next start

## Requirements

- **Windows 10/11**
- **Node.js** (LTS recommended)
- **Git** (optional)

## Install

```bash
npm install
```

## Run (development)

```bash
npm start
```

## Build `.exe` (Windows)

This project uses **electron-builder** (NSIS).

```bash
npm run build
```

### Output

After build, artifacts appear in the `dist/` folder (for example, an NSIS installer like `Todo Manager Setup <version>.exe`).

### Common build issue: `app.asar is being used by another process`

If you see an error like:

> `remove ...\\dist\\win-unpacked\\resources\\app.asar: The process cannot access the file because it is being used by another process`

Do this:

1. **Close the running app** (and stop `npm start` if it’s running).
2. Delete `dist/`:

```bash
Remove-Item -Recurse -Force dist
```

3. Build again:

```bash
npm run build
```

## Dev tools (hidden menu)

The **Dev** screen is hidden by default.

To toggle Dev:

1. Open **Settings**
2. Click the **Setting** header **3 times**

The state is saved in `localStorage`.

## Data file & config

- App data is stored in a JSON file (default name: `eternal-todo-data.json` in Documents, unless you change it in Settings).
- App config is stored in `app-config.json` under Electron `userData` (used for window size/position and chosen data file path).

