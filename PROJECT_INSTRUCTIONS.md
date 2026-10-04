# PROJECT_INSTRUCTIONS.md — Guidelines for AI Agents & Developers

> **IMPORTANT**: Read these guidelines BEFORE modifying, building, or pushing code in this repository.

---

### 1. 📦 APK Build & Storage Rules (CRITICAL)
- **Local APK Builds Only**: **DO NOT** push large `.apk` binary files to remote GitHub repositories or generate remote download links unless explicitly requested by the user.
- **Local Destination**: Always output and update the compiled APK locally on the machine at:
  - `Restaurant_Orders_App.apk` (at root directory)
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- **Avoid Recursive Asset Bloat**: Never place `.apk` files inside the `app/` folder. Capacitor's `npx cap sync android` copies everything from `app/` into web assets, which will cause the APK to package itself recursively and exceed GitHub's 100 MB file limit.

---

### 2. 🆔 Application Identity & Credentials
- **App Name**: `Dream Desserts`
- **Application ID / Package Name**: `com.dreamdesserts.app`
- **GitHub Repository**: `https://github.com/Abhinay1289-codeing/Dream_desserts.git`
- **Active Supabase Project**: `puwkpflzgnrontluvicn` (`https://puwkpflzgnrontluvicn.supabase.co`)
- **DO NOT** revert to the legacy package ID (`com.restaurant.orders`) or legacy Supabase project (`luhwhzsyjsiwdmwrohwc`).

---

### 3. 🔑 Staff Login Credentials
- **Admin Orders Dashboard (`admin-orders.html` / Android App)**:
  - **User ID**: `adminorderpage`
  - **Password**: `OrderPage@1234`

---

### 4. 🍽️ Master QR & Token System Rules
- **Single Master QR Code**: The dining system relies on a single master QR code (`table.html`) instead of fixed table numbers.
- **Sequential Token Session**: Customers provide their **Name** on checkout. Orders are assigned sequential tokens (`Token #1`, `Token #2`, etc.) bound to their device session until billed and cleared by staff.
- **UI Dashboard**: The Admin Orders dashboard displays active customer tokens dynamically as Token Cards with Customer Names instead of 12 static vacant table boxes.

---

### 5. 🛠️ Web Assets & Capacitor Sync Workflow
- Always run `npm run inject-env` and `npx cap sync android` before running `gradlew assembleDebug` to ensure `*.template.html` environment variables are properly injected into root and native Android web assets (`android/app/src/main/assets/public`).
