import "./globals.css";

export const metadata = {
  title: "Le Comptoir d'Échange",
  description: "Échange des points contre des abonnés et des vues YouTube.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="font-body">{children}</body>
    </html>
  );
    }
