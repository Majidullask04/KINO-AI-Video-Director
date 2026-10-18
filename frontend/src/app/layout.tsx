import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Director.AI — Pro Video Editing Studio Powered by FalkorDB",
  description: "Next-generation video editing platform powered by FalkorDB property graph, multi-agent reasoning, and multimodal lineage tracking.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#07070a] text-zinc-100 font-sans antialiased selection:bg-violet-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}
