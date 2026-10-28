import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "MedCode AI | Document confidently", template: "%s | MedCode AI" },
  description: "An educational portfolio demo for hospitalist documentation and medical decision-making. Fictional or fully de-identified notes only.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a href="#main-content" className="skip-link">Skip to content</a>{children}</body></html>;
}
