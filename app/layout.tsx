import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "./providers";
import { Footer } from "@/components/layout/Footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ARSC Leaderboard - Papan Peringkat Kompetisi",
  description: "Lacak partisipasi, rayakan pencapaian, dan lihat siapa yang memimpin dalam komunitas kompetitif kami.",
  keywords: ["leaderboard", "competition", "ranking", "ARSC"],
  icons: {
    icon: "/favico.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          {children}
        </Providers>
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
