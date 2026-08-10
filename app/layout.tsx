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
  title: "ARSC Leaderboard | Rekam Prestasi Kompetisi",
  description: "Peringkat partisipasi kompetisi anggota ARSC yang sudah diverifikasi, dengan identitas resmi dari Rapor ARSC.",
  keywords: ["ARSC", "kompetisi", "partisipasi", "prestasi", "leaderboard"],
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
    <html lang="id" suppressHydrationWarning data-scroll-behavior="smooth">
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
