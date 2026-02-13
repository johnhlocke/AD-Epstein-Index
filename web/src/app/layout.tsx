import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GridOverlay } from "@/components/dev/GridOverlay";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Where They Live — The AD-Epstein Index",
  description:
    "A data-driven investigation cross-referencing every Architectural Digest featured home (1988-2025) with the DOJ Epstein Library.",
  openGraph: {
    title: "Where They Live — The AD-Epstein Index",
    description:
      "Cross-referencing Architectural Digest with the DOJ Epstein Library.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://use.typekit.net/lui3uua.css" />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${jetbrainsMono.variable} font-sans antialiased`}
      >
        <TooltipProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          {process.env.NODE_ENV === "development" && <GridOverlay />}
        </TooltipProvider>
      </body>
    </html>
  );
}
