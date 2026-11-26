import type { Metadata } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" });
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "Context Layer: understand the story, not just the headline",
  description: "Tech news, explained in plain words. Every claim is checked against the article.",
};

const themeScript = `try{var t=localStorage.getItem('cl_theme');if(t!=='dark'&&t!=='light'){t='light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
