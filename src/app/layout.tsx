import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "منصة نجوم",
    template: "%s | منصة نجوم",
  },
  description:
    "منصة تعليمية عربية لمادة العلوم لطالبات الصفين الخامس والسادس في مدرسة أروى بنت عبد المطلب الأساسية.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}