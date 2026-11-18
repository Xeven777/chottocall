import { Anek_Bangla, Fraunces, Geist_Mono } from "next/font/google"
import type { Metadata, Viewport } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "চট্টোকল — Bengali voice assistant",
  description:
    "Talk to a Bengali AI assistant in your browser. Real-time voice, live transcript, natural interruptions.",
  openGraph: {
    title: "চট্টোকল — Bengali voice assistant",
    description: "Talk to a Bengali AI assistant in your browser. Real-time voice, live transcript.",
    type: "website",
    locale: "bn_IN",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f2e6" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1815" },
  ],
}

const ui = Anek_Bangla({
  subsets: ["bengali", "latin"],
  variable: "--font-bn",
})
const display = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-display",
})
const code = Geist_Mono({ subsets: ["latin"], variable: "--font-code" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={cn("antialiased", code.variable, display.variable, ui.variable)}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
