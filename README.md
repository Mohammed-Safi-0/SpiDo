# 📱 SpiDo – Smart Task Manager & Reminder App

**SpiDo** is an Android task management and reminder application built using React Native and Expo. It helps users organize their daily activities, manage tasks, and stay on track with timely reminders.

## ✨ Features

- 📝 **Task Management** – Create, organize, update, and delete tasks.
- ⏰ **Smart Reminders** – Schedule reminders for important tasks.
- 🔔 **Notifications** – Receive notifications for scheduled reminders.
- 📋 **Task Tracking** – Keep track of your tasks and their completion status.
- 📱 **Native Android Support** – Android-specific functionality and configurations.
- ⚡ **Lightweight Application** – Designed for a smooth mobile experience.

## 🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| React Native | Mobile application development |
| Expo | Development framework |
| JavaScript | Application logic |
| Android | Target platform |
| Gradle | Android build system |
| Node.js & npm | Dependency management |

## 📸 Screenshots

Screenshots of the application will be added here.

<!-- Add screenshots from the screenshots/ directory here -->

## 📂 Project Structure

```text
SpiDo/
│
├── android/             # Native Android project
├── assets/              # Images, icons and other assets
├── App.js               # Main application component
├── app.json             # Expo configuration
├── index.js             # Application entry point
├── package.json         # Project dependencies
├── package-lock.json    # Dependency lockfile
├── .gitignore           # Git ignored files
└── README.md            # Project documentation
```

## 🚀 Installation & Setup

### Prerequisites

- Node.js
- npm
- Android Studio (for local Android builds)
- Android SDK

### 1. Clone the repository

```bash
git clone https://github.com/Mohammed-Safi-0/SpiDo.git
```

### 2. Navigate to the project directory

```bash
cd SpiDo
```

### 3. Install dependencies

```bash
npm install
```

### 4. Start the development server

```bash
npx expo start
```

### 5. Run on Android

For a local Android development build:

```bash
npx expo run:android
```

Alternatively, open the native Android project in Android Studio.

## 🔨 Building the Android Application

You can build a debug APK using Gradle:

```bash
cd android
```

On Windows:

```powershell
.\gradlew.bat assembleDebug
```

The generated APK can be found at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## 🎯 Project Goal

The goal of SpiDo is to provide a simple and practical task management solution that helps users organize their daily routines and remember important activities through scheduled reminders.

## 👨‍💻 Developer

**Mohammed Safi**

GitHub: [@Mohammed-Safi-0](https://github.com/Mohammed-Safi-0)

---

⭐ If you find this project interesting, consider giving the repository a star!
