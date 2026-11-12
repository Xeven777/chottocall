import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google"
import type { Metadata } from "next"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "ChottoCall — Bengali voice assistant",
  description: "Talk to a Bengali AI assistant in your browser. Real-time voice, live transcript, natural interruptions.",
}

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })
const bengali = Noto_Sans_Bengali({ subsets: ["bengali", "latin"], variable: "--font-bengali" })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, bengali.variable, geist.variable)}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
