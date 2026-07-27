'use client';

import React from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';

export default function FirebaseConfigGuard({ children }) {
  if (isFirebaseConfigured) {
    return <>{children}</>;
  }

  return (
    <div className="config-wizard-container">
      <div className="decor-gradient"></div>
      <div className="config-wizard-card">
        <div className="brand-header">
          <span className="brand-logo">Vriddhi</span>
          <h2>Connect Your Database</h2>
          <p className="brand-subtitle">
            To start using Vriddhi, we need to link it to your Firebase account. It only takes 2 minutes and is completely free.
          </p>
        </div>

        <div className="alert alert-info">
          💡 A detailed guide has been created for you at <strong>vriddhi-app/FIREBASE_SETUP.md</strong>.
        </div>

        <ul className="config-instruction-list">
          <li>
            <span className="config-step-number">1</span>
            Go to the <strong><a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer">Firebase Console</a></strong> and create a free project named <strong>Vriddhi</strong>.
          </li>
          <li>
            <span className="config-step-number">2</span>
            Enable <strong>Email/Password</strong> sign-in under <em>Authentication</em> and create a <strong>Cloud Firestore</strong> database under <em>Firestore Database</em>.
          </li>
          <li>
            <span className="config-step-number">3</span>
            Add a <strong>Web App</strong> in Firebase to get your config keys.
          </li>
          <li>
            <span className="config-step-number">4</span>
            Open the file <strong><code>vriddhi-app/.env.local</code></strong> in your code editor and paste your credentials:
            <pre className="code-snippet">
{`NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id`}
            </pre>
          </li>
          <li>
            <span className="config-step-number">5</span>
            <strong>Restart the server</strong>: Stop the current process in your terminal (press <code>Ctrl + C</code>) and run <code>npm run dev</code> again to apply changes. Then reload this page.
          </li>
        </ul>
      </div>
    </div>
  );
}
