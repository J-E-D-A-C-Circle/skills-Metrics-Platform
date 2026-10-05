import './globals.css';

export const metadata = {
  title: 'Skill Matrix & Assessment Platform · DVLA',
  description: 'Digital Skill Matrix & Assessment Platform for the Driver and Vehicle Licensing Authority',
  icons: { icon: '/assets/dvla-logo.png' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Comic+Neue:wght@400;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/lucide-static@0.460.0/font/lucide.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
