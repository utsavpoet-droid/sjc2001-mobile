# Mobile Testing And Release Guide

This guide explains how to:

- run the `sjc2001-mobile` app locally
- share it with friends for testing on iPhone and Android
- prepare production builds
- publish to the Apple App Store and Google Play Store

Project-specific values already configured in this repo:

- App name: `SJC 2001`
- Expo slug: `sjc2001-mobile`
- iOS bundle identifier: `com.utsav.sjc2001`
- Android package: `com.utsav.sjc2001`
- EAS owner: `usrivastava0920s-organization`
- EAS build profiles: `development`, `preview`, `production`

## 1. Prerequisites

Before you do anything else, make sure you have:

- Node.js 20+ installed
- npm installed
- Xcode installed for iOS Simulator and iOS builds
- Android Studio installed for Android Emulator and Android builds
- an Expo account
- EAS CLI installed globally or available through `npx`
- an Apple Developer Program membership
- a Google Play Console developer account

Recommended commands:

```bash
node -v
npm -v
npx expo --version
npx eas --version
```

If EAS CLI is missing:

```bash
npm install -g eas-cli
```

## 2. Environment Setup

In the mobile repo, create or update `.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_BACKEND_HOST:3000/api/v1
EXPO_PUBLIC_API_CONTENT_BASE_URL=http://YOUR_BACKEND_HOST:3000/api
```

Local simulator example:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
EXPO_PUBLIC_API_CONTENT_BASE_URL=http://localhost:3000/api
```

Notes:

- iOS Simulator can usually use `localhost`
- physical devices cannot use `localhost`
- for physical devices, replace `localhost` with your Mac's LAN IP or a public HTTPS backend URL

## 3. Run The App Locally

From the backend repo, start the website/API:

```bash
cd /Users/utsavsrivastava/Desktop/sjc2001-website
npm run dev
```

From the mobile repo:

```bash
cd /Users/utsavsrivastava/sjc2001-mobile
npm run typecheck
npm test -- --runInBand
npm start
```

Useful launch shortcuts:

- press `i` for iOS Simulator
- press `a` for Android Emulator
- press `r` to reload

If native modules such as `expo-secure-store` fail in Expo Go, use a development build instead:

```bash
npm run ios
npm run android
```

## 4. Smoke Test Checklist Before Sharing

Test these flows yourself first:

1. Sign in with a real member account
2. Open `My Profile`
3. Open `Members`, search, filter, and open a profile
4. Like and comment on a member/contact card
5. Open `Stories`, like a story, comment on a story, confirm GIFs render
6. Open `Gallery`, open an album, verify album photos load
7. Verify images load in profile/contact/gallery screens
8. Verify logout works and returns to sign-in

## 5. Best Way To Share With Friends For Testing

### Recommended iPhone path: TestFlight

This is the cleanest way to let friends test on iPhones.

#### Step 1. Log in to Expo and Apple

```bash
npx eas login
```

Make sure you also have access to the Apple Developer account that owns the app.

#### Step 2. Confirm the app is linked to EAS

```bash
npx eas project:info
```

If needed:

```bash
npx eas init
```

#### Step 3. Build an iOS preview or production binary

For testing with friends, use the `preview` or `production` profile.

```bash
npx eas build -p ios --profile preview
```

If you want a release candidate for TestFlight, use:

```bash
npx eas build -p ios --profile production
```

#### Step 4. Submit to TestFlight

If you want Expo to submit the latest build:

```bash
npx eas submit -p ios --latest
```

Alternative Expo-assisted flow:

```bash
npx testflight
```

#### Step 5. Add testers in App Store Connect

In App Store Connect:

1. Open your app
2. Open `TestFlight`
3. Add Internal Testers if they are on your App Store Connect team
4. Add External Testers if they are outside your team
5. For external testers, Apple may require a Beta App Review before they can install

#### Step 6. Share with friends

Your friends install the `TestFlight` app from the App Store and accept the invite link.

### Recommended Android path: Internal testing or Closed testing in Google Play

#### Step 1. Build Android app bundle

```bash
npx eas build -p android --profile preview
```

For store-ready build:

```bash
npx eas build -p android --profile production
```

#### Step 2. Submit to Google Play

```bash
npx eas submit -p android --latest
```

Or manually upload the generated `.aab` file in Google Play Console.

#### Step 3. Create a testing track

In Google Play Console:

1. Open your app
2. Go to `Testing`
3. Choose `Internal testing` or `Closed testing`
4. Create a release
5. Upload or select the `.aab`
6. Add tester emails or tester groups
7. Save and roll out the release

#### Step 4. Share the testing link

Google Play will generate an opt-in link that your testers can use on Android devices.

## 6. Sharing Builds Without App Stores

If you want very fast private testing:

### iPhone

Use TestFlight. Direct ad hoc distribution is possible, but TestFlight is much easier to manage for a wider testing group.

### Android

You can use EAS internal distribution:

```bash
npx eas build -p android --profile preview
```

Then share the generated install link from the EAS build page.

## 7. Apple App Store Release Steps

### Accounts and setup

You need:

- active Apple Developer Program membership
- App Store Connect access
- the bundle identifier `com.utsav.sjc2001` reserved and correct

### App Store Connect setup

1. Log in to App Store Connect
2. Create the app if it does not exist yet
3. Set platform to iOS
4. Use bundle ID `com.utsav.sjc2001`
5. Fill in app name, subtitle, privacy details, support URL, marketing URL if available

### Prepare the production build

```bash
npx eas build -p ios --profile production
```

### Submit the build

```bash
npx eas submit -p ios --latest
```

### Complete store listing

In App Store Connect, complete:

- app description
- keywords
- support URL
- privacy policy URL
- age rating
- screenshots for required device sizes
- app preview videos if desired
- App Privacy nutrition labels
- export compliance answers

### Submit for review

Once metadata is complete and the build is attached:

1. create the new version
2. attach the submitted build
3. complete compliance and review notes
4. submit for App Review

## 8. Google Play Release Steps

### Accounts and setup

You need:

- active Google Play Console account
- package name `com.utsav.sjc2001`
- Play App Signing enabled

### Create the app in Play Console

1. Log in to Google Play Console
2. Create app
3. Set app name and language
4. Choose app or game
5. Choose free or paid
6. complete policy declarations

### Build the production Android artifact

```bash
npx eas build -p android --profile production
```

### Submit the build

```bash
npx eas submit -p android --latest
```

Or upload the `.aab` manually in Play Console.

### Complete the Play Store listing

You must add:

- short description
- full description
- app icon
- feature graphic
- phone screenshots
- tablet screenshots if you support tablets
- privacy policy URL
- data safety form
- content rating questionnaire
- ads declaration
- contact email and website if available

### Roll out to production

1. Open `Production`
2. Create new release
3. attach the build
4. review warnings
5. start rollout

## 9. Recommended Release Flow For This App

Use this order:

1. Local simulator testing
2. Internal testing build with a very small group
3. Wider iPhone testing with TestFlight
4. Wider Android testing with Internal or Closed testing
5. Fix issues
6. Build `production`
7. Submit to Apple and Google

## 10. Assets You Should Prepare Before Publishing

Prepare these before release:

- final app icon
- splash screen artwork
- App Store screenshots for iPhone
- Play Store screenshots for Android phone and tablet if needed
- privacy policy URL
- support URL
- marketing website or landing page if available
- release notes for testers

## 11. Notifications And Production Backend Notes

Before large-scale testing or store launch:

- point the app to the production backend URLs in environment config
- confirm push notification setup for iOS and Android
- confirm app icon badges and activity flows work in production builds
- verify image proxy URLs resolve correctly from outside your local network
- confirm request-access, login, MFA, comments, reactions, and uploads work against production

## 12. Useful Commands

Run locally:

```bash
npm start
npm run ios
npm run android
npm run typecheck
npm test -- --runInBand
```

EAS build:

```bash
npx eas build -p ios --profile preview
npx eas build -p ios --profile production
npx eas build -p android --profile preview
npx eas build -p android --profile production
```

EAS submit:

```bash
npx eas submit -p ios --latest
npx eas submit -p android --latest
```

## 13. Troubleshooting

### Expo Go or simulator shows native module errors

Use a development build instead of Expo Go:

```bash
npm run ios
npm run android
```

### Physical devices cannot reach local backend

Replace `localhost` with a LAN IP or public backend URL in `.env`.

### iOS testers cannot install

Make sure:

- the build is in TestFlight
- testers were added correctly
- Beta App Review was completed for external testers

### Android testers cannot install

Make sure:

- they accepted the testing opt-in link
- the release was rolled out to the selected testing track
- their email is included in the tester list or group

## 14. Official References

- Expo TestFlight command: https://docs.expo.dev/build-reference/npx-testflight/
- Expo app store metadata: https://docs.expo.dev/deploy/app-stores-metadata/
- Apple TestFlight overview: https://developer.apple.com/testflight/
- Google Play testing overview: https://support.google.com/googleplay/android-developer/

## 15. Recommended Next Step

For your immediate goal of sharing with friends:

1. point `.env` to a reachable backend
2. build iOS with `preview` or `production`
3. send it through TestFlight
4. build Android with `preview`
5. send Android testers the Play internal-testing link or EAS internal distribution link
