import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import Nav from "@/components/Nav"
import FloatingNotes from "@/components/notes/FloatingNotes"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Tim Indo Serba Bisa",
  description: "Internal tools for the team",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark highlight-lime`}
      suppressHydrationWarning
    >
      <head>
        {/* Run before React hydrates so server class matches client class */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var t = localStorage.getItem('theme') || 'dark';
              var h = localStorage.getItem('highlight') || 'lime';
              var el = document.documentElement;
              el.classList.remove('dark','light');
              if (t === 'dark') el.classList.add('dark');
              el.classList.remove('highlight-lime','highlight-pink','highlight-purple');
              el.classList.add('highlight-' + h);
            } catch(e) {}
          })();
        ` }} />
      </head>
      <body>
        <ThemeProvider>
          <Nav />
          <FloatingNotes />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
