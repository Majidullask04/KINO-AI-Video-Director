import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

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
  title: "KINO STUDIO — Non-Linear Editing System Powered by FalkorDB",
  description: "Autonomous video editing platform powered by FalkorDB property graph, multi-agent reasoning, and multimodal lineage tracking.",
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
      <body className="min-h-full flex flex-col bg-[#09090b] text-[#f4f4f6] font-sans antialiased selection:bg-[#f59e0b]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
