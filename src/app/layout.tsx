import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import Script from 'next/script';
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cafe24 Web Catalog",
  description: "Premium product catalog integrated with Cafe24",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
      >
        <div className="min-h-screen bg-[#f3f3f3]">
          <div className="max-w-[900px] mx-auto bg-white shadow-sm relative min-h-screen">
            {children}
          </div>
        </div>
        <Toaster position="bottom-center" />
        <Script 
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" 
          integrity="sha384-oX0D04z7P98+yK8e6Jp+4hL9F0D04z7P98+yK8e6Jp+4hL9F0" 
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
