import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Consulta Preço - Scanner de Códigos de Barras",
  description: "Aplicativo moderno para consulta de preços com scanner de código de barras e pesquisa manual",
  keywords: "preços, código de barras, scanner, consulta, produtos",
  authors: [{ name: "Consulta Preço App" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  themeColor: "#7c3aed",
  manifest: "/manifest.json",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <div className="max-w-md mx-auto bg-white min-h-screen shadow-xl">{children}</div>
      </body>
    </html>
  )
}
