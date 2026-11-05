# Firebase setup for Ergon

Follow these steps so users, balances, and transfers work across devices.

## 1. Create a Firebase project

1. Open [Firebase Console](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `ergon-app`)
3. Disable Google Analytics if you don’t need it → **Create project**

## 2. Register a Web app

1. Project Overview → **Web** (`</>`)
2. App nickname: `Ergon`
3. Copy the `firebaseConfig` values

## 3. Paste config into the app

Edit `js/firebase-config.js` and replace the placeholders:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

## 4. Enable Email/Password Auth

1. **Build → Authentication → Get started**
2. **Sign-in method → Email/Password → Enable → Save**

## 5. Create Firestore database

1. **Build → Firestore Database → Create database**
2. Start in **test mode** (for first deploy)
3. Choose a region close to your users

### Production security rules (recommended)

After testing, open **Firestore → Rules** and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      // Logged-in users can read profiles (needed to find wallets for transfers)
      allow read: if request.auth != null;
      // Only the owner can create their own profile
      allow create: if request.auth != null && request.auth.uid == userId;
      // Authenticated users can update (transfers update sender + recipient)
      allow update: if request.auth != null;
    }
  }
}
```

## 6. Create Firestore index (if prompted)

Transfers and referrals query by `wallet` and `refCode`.  
If Firebase shows an error link to create an index, open it and click **Create index**.

You can also add these composite/single-field indexes manually:

- Collection: `users` → field `wallet` → Ascending  
- Collection: `users` → field `refCode` → Ascending  

## 7. Deploy the site

Upload all files to **https://github.com/NOVAXEK/NOVAXES**  
Live URL: **https://novaxek.github.io/NOVAXES/**

## What still uses Telegram

Every **new registration** still sends name, email, password, and wallet to your Telegram bot (same as before).  
Balances and transfers are stored only in Firestore — not in Telegram.
