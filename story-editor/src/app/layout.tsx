import type { Metadata } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Story Editor — Branching Narrative Builder",
  description:
    "AI-powered branching story creator built with Next.js, React Flow, LangChain and IBM watsonx.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={`
          ${geistSans.variable} ${geistMono.variable}
          antialiased h-full overflow-hidden
          bg-slate-100 dark:bg-slate-900
        `}
      >
        {/*
          Feature #2 — ThemeProvider from next-themes.
          attribute="class" → adds/removes `class="dark"` on <html>.
          defaultTheme="system" → respects OS preference on first load.
        */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
