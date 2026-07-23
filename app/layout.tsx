import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/ThemeProvider"
import Nav from "@/components/Nav"
import PostHogProvider from "@/components/PostHogProvider"
import NoRightClick from "@/components/NoRightClick"
import ServiceWorker from "@/components/ServiceWorker"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Tim Indo Serba Bisa",
  description: "Internal tools for the team",
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark highlight-lime`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0d0d0d" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Outlined" rel="stylesheet" />
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
        <NoRightClick />
        <ServiceWorker />
        <PostHogProvider>
          <ThemeProvider>
            <Nav />
            {children}
          </ThemeProvider>
        </PostHogProvider>
      </body>
    </html>
  )
}
