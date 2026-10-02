import "./globals.css";
import FirebaseConfigGuard from "@/components/FirebaseConfigGuard";
import { AuthContextProvider } from "@/context/AuthContext";
import UpdatePrompt from "@/components/UpdatePrompt";

export const metadata = {
  title: "Vriddhi | Fitness & Wellness Coaching",
  description: "Track your health goals, log weight history, and calculate your BMR on Vriddhi's holistic wellness coaching platform.",
  keywords: ["fitness", "wellness", "BMR calculator", "weight tracker", "coaching"],
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-content" />
      </head>
      <body>
        <FirebaseConfigGuard>
          <AuthContextProvider>
            <UpdatePrompt />
            {children}
          </AuthContextProvider>
        </FirebaseConfigGuard>
      </body>
    </html>
  );
}
