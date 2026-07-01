# Sprite Feature Web

React + Vite webpage for browsing vanilla Minecraft sprite atlas entries and copying:

- MiniMessage sprite format
- JSON sprite text component
- Vanilla `/tellraw` chat command
- Vanilla `/title ... actionbar` command
- Vanilla `/title ... title` and subtitle commands

Sprite text components are for Minecraft Java `1.21.9+`. Some atlas source types are still marked unsupported by the local exporter, especially generated variants such as paletted permutations.

## Current Data

The checked-in generated data is from Minecraft Java `26.1.2`.

It contains `2944` exported sprites in `public/minecraft-sprites`.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

Regenerate the latest release sprites:

```bash
npm run sprites:generate
```

Regenerate a specific Minecraft version:

```powershell
$env:MINECRAFT_VERSION='1.21.9'; npm run sprites:generate; Remove-Item Env:MINECRAFT_VERSION
```
