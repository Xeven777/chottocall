import {
  Geist_Mono,
  Libertinus_Sans,
  // Newsreader,
  Noto_Sans_Bengali,
  Noto_Serif_Bengali,
} from "next/font/google"
import { GeistSerif } from "geist/font/serif"

const ui = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bn",
})

// const display = Newsreader({
//   subsets: ["latin"],
//   weight: ["400", "500"],
//   style: ["normal", "italic"],
//   variable: "--font-display",
// })

const serifBn = Noto_Serif_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bn-serif",
})

const sans = Libertinus_Sans({
  weight: ["400", "700"],
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-body",
  adjustFontFallback: false,
})

const code = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-code",
})

export { ui, serifBn, sans, code, GeistSerif }
