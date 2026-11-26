---
name: "ChottoCall"
description: "Warm Bengali-inspired voice assistant design system pairing alta crimson, marigold saffron, and soft ivory surfaces with smooth atmospheric gradients."
---

## Overview

chottocall Voice is a bilingual Bengali-English personal voice assistant rooted in the warmth of Bengali cultural aesthetics—deep alta crimson, marigold saffron, and soft champa-petal cream—reimagined through smooth, luminous gradients and calm editorial typography. The interface avoids harsh borders or flat sterile cards, instead using layered tonal surfaces, fluid radial and linear gradients, and a living five-petal floral voice orb as the emotional center of every conversation.

The primary user is someone seeking an attentive, culturally fluent everyday companion for reminders, translations, recipes, music, and quick answers in both English and Bengali. The mood is warm, poised, and welcoming.

## Colors

The palette draws from the chottocall brand board: deep vermilion and alta crimson as the primary anchor, marigold saffron as the luminous secondary accent, and warm champa-petal ivory for breathable light surfaces. Smooth gradients transition between `alta-red`, `crimson-deep`, `marigold-gold`, and `mahogany-deep` for the voice orb, active listening rings, and hero prompt cards.

- **Primary (`#750005` / `#FFB4AA`):** Deep alta crimson for primary actions, active states, and brand anchors.
- **Secondary (`#845400` / `#FFB959`):** Warm marigold and saffron tones for highlights, active voice energy, and Bengali cultural warmth.
- **Brand Gradient Stops:** `crimson-deep`, `alta-red`, `marigold-gold`, `saffron-glow`, `cream-petal`, and `mahogany-deep` provide smooth multi-stop gradients across voice orbs, squircle emblems, and featured cards.

```yaml
colors:
  crimson-deep: "#750005"
  alta-red: "#9E0B0F"
  marigold-gold: "#E59819"
  saffron-glow: "#FFAE32"
  cream-petal: "#FFEEDD"
  mahogany-deep: "#2A1614"
  light:
    primary: "#750005"
    on-primary: "#FFFFFF"
    primary-container: "#9E0B0F"
    on-primary-container: "#FFE5E2"
    secondary: "#845400"
    on-secondary: "#FFFFFF"
    secondary-container: "#FFAE32"
    on-secondary-container: "#3B2200"
    tertiary: "#003475"
    on-tertiary: "#FFFFFF"
    tertiary-container: "#004AA1"
    on-tertiary-container: "#DCE7FF"
    error: "#BA1A1A"
    on-error: "#FFFFFF"
    error-container: "#FFDAD6"
    on-error-container: "#93000A"
    background: "#FFF8F7"
    on-background: "#2A1614"
    surface: "#FFF8F7"
    surface-dim: "#F6D2CE"
    surface-bright: "#FFF8F7"
    surface-container-lowest: "#FFFFFF"
    surface-container-low: "#FFF0EF"
    surface-container: "#FFE9E6"
    surface-container-high: "#FFE2DE"
    surface-container-highest: "#FFDAD6"
    on-surface: "#2A1614"
    surface-variant: "#FFDAD5"
    on-surface-variant: "#5B403D"
    outline: "#8F706C"
    outline-variant: "#E3BEB9"
    inverse-surface: "#412B28"
    inverse-on-surface: "#FFEDEA"
    inverse-primary: "#FFB4AA"
  dark:
    primary: "#FFB4AA"
    on-primary: "#690004"
    primary-container: "#9E0B0F"
    on-primary-container: "#FFE5E2"
    secondary: "#FFB959"
    on-secondary: "#462B00"
    secondary-container: "#D68B02"
    on-secondary-container: "#2B1900"
    tertiary: "#ADC6FF"
    on-tertiary: "#002E69"
    tertiary-container: "#004AA1"
    on-tertiary-container: "#DCE7FF"
    error: "#FFB4AB"
    on-error: "#690005"
    error-container: "#93000A"
    on-error-container: "#FFDAD6"
    background: "#210E0C"
    on-background: "#FFDAD6"
    surface: "#210E0C"
    surface-dim: "#210E0C"
    surface-bright: "#4B3331"
    surface-container-lowest: "#1B0908"
    surface-container-low: "#2A1614"
    surface-container: "#2F1A18"
    surface-container-high: "#3A2422"
    surface-container-highest: "#462F2C"
    on-surface: "#FFDAD6"
    surface-variant: "#5B403D"
    on-surface-variant: "#E3BEB9"
    outline: "#AA8985"
    outline-variant: "#5B403D"
    inverse-surface: "#FFDAD6"
    inverse-on-surface: "#412B28"
    inverse-primary: "#B7221E"
```

## Typography

**Newsreader** brings crisp editorial serif warmth to display headings and greeting titles, while **Libertinus Sans** provides clean, legible humanist proportions for conversational transcripts, prompt chips, and navigation. **Source Code Pro** handles call timers, audio latency indicators, and timestamps with `tabular-nums`. When rendering Bengali script (`বাংলা`), screens load `Noto Serif Bengali` and `Noto Sans Bengali` alongside the primary Google Fonts.

```yaml
typography:
  display-lg:
    fontFamily: "Newsreader"
    fontSize: 44px
    fontWeight: 700
    lineHeight: 50px
    letterSpacing: -0.5px
  display-lg-mobile:
    fontFamily: "Newsreader"
    fontSize: 32px
    fontWeight: 700
    lineHeight: 38px
    letterSpacing: -0.25px
  headline-lg:
    fontFamily: "Newsreader"
    fontSize: 34px
    fontWeight: 600
    lineHeight: 42px
    letterSpacing: -0.25px
  headline-lg-mobile:
    fontFamily: "Newsreader"
    fontSize: 26px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: -0.2px
  headline-md:
    fontFamily: "Newsreader"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 30px
    letterSpacing: 0px
  title-lg:
    fontFamily: "Libertinus Sans"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: 0px
  title-md:
    fontFamily: "Libertinus Sans"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
    letterSpacing: 0.1px
  body-lg:
    fontFamily: "Libertinus Sans"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0.15px
  body-md:
    fontFamily: "Libertinus Sans"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 21px
    letterSpacing: 0.15px
  label-lg:
    fontFamily: "Libertinus Sans"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0.1px
  label-sm:
    fontFamily: "Libertinus Sans"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.2px
  mono-sm:
    fontFamily: "Source Code Pro"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.3px
```

## Layout & Spacing

Mobile screens use a fluid single-column layout with `20px`–`24px` page margins and generous breathing room around the central voice orb or greeting header. Desktop web screens use a two-zone layout: a persistent left navigation rail (`240px`) paired with a centered `max-w-5xl` main stage so the voice canvas never stretches uncomfortably wide. All spacing follows an `8px` base rhythm with `4px` micro-steps.

```yaml
spacing:
  gutter-xs: 4px
  gutter-sm: 8px
  gutter-md: 16px
  gutter-lg: 24px
  gutter-xl: 32px
  section: 48px
  page-margin: 24px
```

## Elevation & Depth

Hierarchy relies on **tonal surface stepping** (`surface` → `surface-container-low` → `surface-container`) combined with **smooth radial and linear gradients** for primary focal points. Cards avoid heavy drop shadows; instead, interactive gradient containers and the voice orb use soft crimson-tinted ambient glow shadows (`shadow-lg`) to lift off the warm ivory ground. Ghost borders (`outline-variant` at low opacity) are reserved for secondary input fields and inactive prompt chips.

## Shapes

Inspired by the rounded squircle app icons and soft flower petals in the brand exploration, containers use generous organic radii: `xl` (`24px`) for feature cards and squircle brand badges, `lg` (`16px`) for transcript bubbles and prompt tiles, `md` (`12px`) for inputs, and `full` (`9999px`) for voice control pills, mic buttons, and language toggles.

```yaml
rounded:
  sm: 6px
  DEFAULT: 12px
  md: 16px
  lg: 20px
  xl: 28px
  full: 9999px
```

## Motion & Micro-interaction

Voice interfaces feel alive through calm, organic breathing rather than jittery mechanics. Interactive button presses land in `120ms`, panel and drawer transitions glide in over `280ms` with an ease-out deceleration curve, and the floral voice orb pulses gently on a smooth symmetric curve only while actively listening or speaking. Respect `prefers-reduced-motion` and animate only `transform` and `opacity`.

```yaml
motion:
  state-change:
    duration: 120ms
    delay: 0ms
    timingFunction: ease-out
  surface-enter:
    duration: 280ms
    delay: 0ms
    timingFunction: cubic-bezier(0.2, 0, 0, 1)
  surface-exit:
    duration: 180ms
    delay: 0ms
    timingFunction: cubic-bezier(0.3, 0, 1, 1)
  orb-breathe:
    duration: 2400ms
    delay: 0ms
    timingFunction: cubic-bezier(0.4, 0, 0.2, 1)
```

## Voice & Content Strategy

- **Tone of voice:** Warm, attentive, and natural—never robotic or overly formal. Mix natural English with gentle Bengali greetings where appropriate (e.g., *Shubho Shokal* or *Ki bhabe shahajjo korte pari?*).
- **Capitalisation:** Sentence case for all headings, prompt suggestions, and labels.
- **Button and action labels:** Clear verb-first labels (`Start voice session`, `Switch to Bengali`, `Mute microphone`, `End conversation`).
- **Empty and listening states:** Concise, reassuring cues (`Listening in Bengali & English...`, `Tap the flower orb to speak`).
- **Numbers and timestamps:** Use `tabular-nums` for call durations (`02:14`) and timestamps (`9:42 AM`).

## Components

Component implementations live as individual HTML sticker sheet files in
`components/`. Each file contains the canonical, styled HTML components with
`<!-- COMPONENT: name -->` comment markers. Read each file before use.

- **Button** → `@components/button.html` — `button-primary`, `button-icon`, `button-with-icon`
- **Card** → `@components/card.html` — `card-elevated`, `card-action`, `card-interactive`, `card-interactive-2`
- **Chip** → `@components/chip.html` — `chip-action`, `chip-input`, `chip-with-icon`
- **Typography** → `@components/typography.html` — `typography-display`, `typography-body`, `typography-label`
