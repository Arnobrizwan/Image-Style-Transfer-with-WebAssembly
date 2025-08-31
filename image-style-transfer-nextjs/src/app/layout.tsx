import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neural Style Transfer",
  description: "AI-powered image style transfer using Rust + WebAssembly + ONNX",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}