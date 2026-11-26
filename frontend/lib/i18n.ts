"use client"

import { useEffect, useSyncExternalStore } from "react"

export type Locale = "bn" | "en"

export const DEFAULT_LOCALE: Locale = "bn"
const STORAGE_KEY = "chottocall:locale"

export type Copy = {
  docTitle: string
  brand: string
  tagline: string
  headline: string
  intro: string
  stageLabel: string
  orbHint: string
  switchLanguage: string
  start: string
  startAria: string
  connecting: string
  end: string
  mute: string
  unmute: string
  meta: { transport: string; anytime: string; theme: string }
  statusLabel: Record<"idle" | "connecting" | "live" | "error", string>
  mutedLabel: string
  status: {
    idle: { headline: string; subline: string }
    connecting: { headline: string; subline: string }
    live: { headline: string; subline: string }
    muted: { headline: string; subline: string }
    error: { headline: string; subline: string }
  }
  errorTitle: string
  errorPlayback: string
  errorHint: string
  transcript: string
  transcriptSub: string
  transcriptBadge: { live: string; muted: string; idle: string; recap: string }
  transcriptJump: string
  review: { title: string; tip: string; newCall: string }
  suggestion: { prompt: string; dismiss: string }
  lineCount: (n: number) => string
  empty: {
    title: string
    description: string
    trySaying: string
    phrases: readonly string[]
  }
  speaker: { user: string; bot: string }
  footer: { tip: string; line: string; permission: string }
  admin: {
    title: string
    back: string
    overview: string
    knowledge: string
    tools: string
    sessions: string
    layer: string
    name: string
    status: string
    documents: string
    chunks: string
    upload: string
    uploadHint: string
    delete: string
    enabled: string
    started: string
    messages: string
    duration: string
    live: string
    ended: string
    noMessages: string
    deleteConfirm: string
    deleteCall: string
    empty: string
  }
}

export const COPY: Record<Locale, Copy> = {
  bn: {
    docTitle: "চট্টোকল — বাংলায় কথা বলুন",
    brand: "চট্টোকল",
    tagline: "ChottoCall — বাংলা ভয়েস",
    headline: "বাংলায় কথা বলুন",
    intro:
      "মাইক খুলে স্বাভাবিকভাবে বলুন। সে বাংলাতেই উত্তর দেবে — আর নিচে কথাগুলো লেখা থাকবে।",
    stageLabel: "লাইভ ভয়েস",
    orbHint: "অর্বে চাপ দিয়ে শুরু করুন",
    switchLanguage: "ভাষা বদলান",
    start: "কথা শুরু করুন",
    startAria: "কল শুরু করুন",
    connecting: "সংযোগ হচ্ছে…",
    end: "শেষ করুন",
    mute: "মাইক বন্ধ করুন",
    unmute: "মাইক চালু করুন",
    meta: {
      transport: "ওয়েবআরটিসি অডিও",
      anytime: "যেকোনো সময় থামানো যাবে",
      theme: "থিম",
    },
    statusLabel: {
      idle: "প্রস্তুত",
      connecting: "সংযোগ",
      live: "চলছে",
      error: "ত্রুটি",
    },
    mutedLabel: "নীরব",
    status: {
      idle: {
        headline: "প্রস্তুত আছি",
        subline: "কল দিন, মাইকের অনুমতি দিন — তারপর বাংলায় বলুন।",
      },
      connecting: {
        headline: "সংযোগ হচ্ছে",
        subline: "মাইকের অনুমতি দিন, তারপর কথা বলুন।",
      },
      live: {
        headline: "শুনছি",
        subline: "স্বাভাবিকভাবে বলুন। মাঝপথে থামাতেও পারেন।",
      },
      muted: {
        headline: "মাইক বন্ধ",
        subline: "কথা চালিয়ে যেতে মাইক আবার চালু করুন।",
      },
      error: {
        headline: "সংযোগ থেমে গেছে",
        subline: "মাইকের অনুমতি দিয়ে আবার চেষ্টা করুন।",
      },
    },
    errorTitle: "সংযোগ করা গেল না",
    errorPlayback: "ব্রাউজার অডিও চালাতে বাধা দিয়েছে — আবার কল করুন।",
    errorHint: "ব্যাকএন্ড চালু থাকলে আবার চেষ্টা করুন।",
    transcript: "কথোপকথন",
    transcriptSub: "আপনি যা বলবেন, সে যা বলবে",
    transcriptBadge: {
      live: "শ্রবণ চলছে",
      muted: "নীরব",
      idle: "অপেক্ষায়",
      recap: "কল শেষ",
    },
    transcriptJump: "সর্বশেষে যান",
    review: {
      title: "কথোপকথনের সারাংশ",
      tip: "কল শেষ — কথাগুলো এখানে রইলো। নতুন কল শুরু করলে পরিষ্কার হবে।",
      newCall: "নতুন কল",
    },
    suggestion: { prompt: "এই কথাটি বলুন:", dismiss: "প্রস্তাব বন্ধ করুন" },
    lineCount: (n) => `${n} টি লাইন · আপনি ও চট্টোকল`,
    empty: {
      title: "এখনও নীরব",
      description:
        "কল শুরু করে বাংলায় কথা বলুন। আপনি যা বলবেন আর সে যা উত্তর দেবে, সব এখানে জমা হবে।",
      trySaying: "এভাবে বলতে পারেন",
      phrases: [
        "আসসালামু আলাইকুম, কেমন আছো?",
        "আজকের আবহাওয়া কেমন?",
        "আমাকে একটা গল্প বলো",
      ],
    },
    speaker: { user: "আপনি", bot: "চট্টোকল" },
    footer: {
      tip: "হেডফোন ব্যবহার করুন — যন্ত্রটি নিজের গলা শুনে ফেলতে পারে।",
      line: "চট্টোকল — বাংলা ভাষায়, বাংলার জন্য।",
      permission: "মাইকের অনুমতি দরকার",
    },
    admin: {
      title: "অ্যাডমিন",
      back: "কলে ফিরুন",
      overview: "সংক্ষেপ",
      knowledge: "জ্ঞান",
      tools: "টুল",
      sessions: "কল",
      layer: "স্তর",
      name: "নাম",
      status: "অবস্থা",
      documents: "নথি",
      chunks: "অংশ",
      upload: "ফাইল আপলোড করুন",
      uploadHint: "পিডিএফ, মার্কডাউন বা টেক্সট — সর্বোচ্চ ১০ এমবি",
      delete: "মুছুন",
      enabled: "চালু",
      started: "শুরু",
      messages: "বার্তা",
      duration: "সময়",
      live: "চলছে",
      ended: "শেষ",
      noMessages: "এই কলে কোনো বার্তা নেই",
      deleteConfirm: "এই কল ও এর সব বার্তা মুছে ফেলবেন?",
      deleteCall: "কল মুছুন",
      empty: "কিছু নেই",
    },
  },
  en: {
    docTitle: "ChottoCall — Speak in Bengali",
    brand: "ChottoCall",
    tagline: "ChottoCall — Bengali voice",
    headline: "Speak in Bengali",
    intro:
      "Open the mic and talk naturally. It answers in Bengali, and every line lands below.",
    stageLabel: "Live voice",
    orbHint: "Tap the flower orb to start",
    switchLanguage: "Switch language",
    start: "Start the call",
    startAria: "Start the call",
    connecting: "Connecting…",
    end: "End call",
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    meta: {
      transport: "WebRTC audio",
      anytime: "Stop any time",
      theme: "Theme",
    },
    statusLabel: {
      idle: "Ready",
      connecting: "Connecting",
      live: "Live",
      error: "Error",
    },
    mutedLabel: "Muted",
    status: {
      idle: {
        headline: "Ready when you are",
        subline: "Start the call, allow the mic, then speak in Bengali.",
      },
      connecting: {
        headline: "Connecting",
        subline: "Allow microphone access, then start talking.",
      },
      live: {
        headline: "Listening",
        subline: "Speak naturally — you can pause midway.",
      },
      muted: {
        headline: "Mic is off",
        subline: "Turn the microphone back on to keep talking.",
      },
      error: {
        headline: "Connection lost",
        subline: "Allow the mic and try again.",
      },
    },
    errorTitle: "Couldn't connect",
    errorPlayback: "The browser blocked audio playback — start the call again.",
    errorHint: "Check that the backend is running, then try again.",
    transcript: "Transcript",
    transcriptSub: "What you say, and what it answers",
    transcriptBadge: {
      live: "Listening",
      muted: "Muted",
      idle: "Standing by",
      recap: "Call ended",
    },
    transcriptJump: "Jump to latest",
    review: {
      title: "Conversation recap",
      tip: "Call ended — the conversation stays here until you start a new one.",
      newCall: "New call",
    },
    suggestion: { prompt: "Say this:", dismiss: "Dismiss suggestion" },
    lineCount: (n) => `${n} ${n === 1 ? "line" : "lines"} · you and ChottoCall`,
    empty: {
      title: "Nothing yet",
      description:
        "Start the call and speak in Bengali. Everything you say and everything it answers lands here.",
      trySaying: "Try saying, in Bengali",
      phrases: [
        "Assalamu alaikum, how are you?",
        "What's the weather like today?",
        "Tell me a story",
      ],
    },
    speaker: { user: "You", bot: "ChottoCall" },
    footer: {
      tip: "Headphones will give you a better experience.",
      line: "ChottoCall — Bengali, built for Bengali.",
      permission: "Microphone access required",
    },
    admin: {
      title: "Admin",
      back: "Back to call",
      overview: "Overview",
      knowledge: "Knowledge",
      tools: "Tools",
      sessions: "Calls",
      layer: "Layer",
      name: "Name",
      status: "Status",
      documents: "Documents",
      chunks: "Chunks",
      upload: "Upload a file",
      uploadHint: "PDF, Markdown or text — up to 10 MB",
      delete: "Delete",
      enabled: "Enabled",
      started: "Started",
      messages: "Messages",
      duration: "Duration",
      live: "Live",
      ended: "Ended",
      noMessages: "No messages in this call",
      deleteConfirm: "Delete this call and all its messages?",
      deleteCall: "Delete call",
      empty: "Nothing here yet",
    },
  },
}

/* Locale lives in a tiny external store so hydration stays clean and the
   saved choice is read once, on the client, without a setState-in-effect. */
const listeners = new Set<() => void>()
let snapshot: Locale | null = null

function readLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (saved === "bn" || saved === "en") return saved
  } catch {
    /* storage blocked — fall through to the default */
  }
  return DEFAULT_LOCALE
}

function getLocale() {
  if (snapshot === null) snapshot = readLocale()
  return snapshot
}

function getServerLocale(): Locale {
  return DEFAULT_LOCALE
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function setLocale(next: Locale) {
  snapshot = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* private mode — the language simply won't persist */
  }
  for (const listener of listeners) listener()
}

/** Locale state persisted per browser, applied to <html lang> and the document title. */
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, getLocale, getServerLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = COPY[locale].docTitle
  }, [locale])

  return { locale, setLocale, t: COPY[locale] }
}
