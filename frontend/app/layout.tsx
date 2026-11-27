import type { Metadata, Viewport } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import { code, GeistSerif, sans, serifBn, ui } from "@/lib/fonts"

export const metadata: Metadata = {
  title: "চট্টোকল — Bengali voice assistant",
  description:
    "Talk to a Bengali AI assistant in your browser. Real-time voice, live transcript, natural interruptions.",
  openGraph: {
    title: "চট্টোকল — Bengali voice assistant",
    description:
      "Talk to a Bengali AI assistant in your browser. Real-time voice, live transcript.",
    type: "website",
    locale: "bn_IN",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF8F7" },
    { media: "(prefers-color-scheme: dark)", color: "#210E0C" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="bn"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        code.variable,
        serifBn.variable,
        sans.variable,
        ui.variable,
        GeistSerif.variable
      )}
    >
      <body className="min-h-dvh font-sans">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
