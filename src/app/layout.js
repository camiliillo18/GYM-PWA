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
  title: 'GymPWA',
  description: 'Entrar, anotar, salir.',
  manifest: '/manifest.json', // Conecta con el manifiesto
  appleWebApp: {
    capable: true, // Esto quita la barra de Safari en iOS
    statusBarStyle: 'black-translucent',
    title: 'GymPWA',
  },
};

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // CLAVE: Evita que el móvil haga zoom al tocar un botón
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
