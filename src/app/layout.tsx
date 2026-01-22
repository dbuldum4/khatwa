import type { Metadata } from "next";
import { Alegreya } from "next/font/google";
import "./globals.css";

const alegreya = Alegreya({
  variable: "--font-alegreya",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Khatwa",
  description: "Focus on what matters",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${alegreya.variable} antialiased`}
        style={{ backgroundColor: "#232323" }}
      >
        {children}
      </body>
    </html>
  );
}
