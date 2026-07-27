import "./globals.css";
import FirebaseConfigGuard from "@/components/FirebaseConfigGuard";
import { AuthContextProvider } from "@/context/AuthContext";

export const metadata = {
  title: "Vriddhi | Fitness & Wellness Coaching",
  description: "Track your health goals, log weight history, and calculate your BMR on Vriddhi's holistic wellness coaching platform.",
  keywords: ["fitness", "wellness", "BMR calculator", "weight tracker", "coaching"],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <FirebaseConfigGuard>
          <AuthContextProvider>
            {children}
          </AuthContextProvider>
        </FirebaseConfigGuard>
      </body>
    </html>
  );
}
