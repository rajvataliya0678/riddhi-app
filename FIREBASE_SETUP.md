# Connecting Vriddhi App to Firebase

This guide will help you connect your Next.js frontend application to a free Firebase database and authentication service. You don't need any coding experience to follow these steps.

---

## Step 1: Create a Firebase Account and Project

1. Go to the [Firebase Console](https://console.firebase.google.com/) and log in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Name your project `Vriddhi` (or anything you prefer).
4. Click **Continue**. You can turn off Google Analytics for now, as it's not needed for local testing, then click **Create Project**.
5. Wait for the project to provision and click **Continue**.

---

## Step 2: Set up Authentication (For User Sign-Up and Login)

1. In the left-hand menu of your Firebase Console, click on **Build** -> **Authentication**.
2. Click the **Get started** button.
3. Under the **Sign-in method** tab, select **Email/Password**.
4. Enable the **Email/Password** toggle (leave "Email link (passwordless sign-in)" disabled).
5. Click **Save**.

---

## Step 3: Set up Firestore Database (For User Data and Weight Logs)

1. In the left-hand menu, click on **Build** -> **Firestore Database**.
2. Click the **Create database** button.
3. Select your Database Location (choose a region close to you) and click **Next**.
4. Select **Start in test mode** (this makes it easy to read/write during local development without complex rules).
    *   *Note: In the future, before publishing live, we will set rules to secure user data.*
5. Click **Create**.

---

## Step 4: Add a Web App and Get Your Configuration Keys

1. Go back to your Firebase Project Overview by clicking **Project Overview** at the top left.
2. In the center of the screen, you will see circular icons. Click the **Web** icon (it looks like a small code tag `</>`).
3. Register your app by entering a nickname, for example: `Vriddhi-Web-App`.
4. Click **Register app** (do not select Firebase Hosting for now).
5. Firebase will display a code block containing a `firebaseConfig` object that looks like this:

   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "vriddhi-app.firebaseapp.com",
     projectId: "vriddhi-app",
     storageBucket: "vriddhi-app.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef..."
   };
   ```

---

## Step 5: Configure the Project Files

1. Open the file called `.env.local` inside the `vriddhi-app` folder on your computer.
2. Copy the corresponding strings from your Firebase Console and paste them after the `=` signs.
3. Save the file.

Your `.env.local` file should now look like this:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=vriddhi-app.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=vriddhi-app
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=vriddhi-app.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=1234567890
NEXT_PUBLIC_FIREBASE_APP_ID=1:1234567890:web:abcdef...
```

4. **Restart your development server** (stop it with `Ctrl + C` in your terminal, and run it again) for Next.js to read the new keys.
