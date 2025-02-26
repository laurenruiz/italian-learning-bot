import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Italian AI Tutor",
  description: "Italian AI Tutor to help you learn Italian through conversation!",
  icons: {
    icon: "./app/butterfly_darker_pink_cropped.png"
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* This meta tag ensures proper scaling on mobile devices */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
