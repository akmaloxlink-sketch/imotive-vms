# Fleet Management Mobile App

A React Native mobile application for managing vehicle fleets, built with Expo and TypeScript.

## Features

- User authentication with session management
- Real-time vehicle listing
- Online/offline status monitoring for each vehicle
- Pull-to-refresh functionality
- Clean, modern UI with tab navigation

## Getting Started

### Installation

```bash
npm install
```

### Development

To start the development server:

```bash
npm run dev
```

This will start the Expo development server. You can then:
- Press `w` to open in web browser
- Scan QR code with Expo Go app for mobile testing

### Important Notes for Web Development

The app uses a Supabase Edge Function to proxy requests to the fleet management system. This proxy:
- Routes requests server-side to avoid CORS issues
- Works automatically in both development and production
- Deployed at `https://mehjhvzvqbsmsrmdpjvm.supabase.co/functions/v1/fleet-proxy`

For mobile platforms (iOS/Android), the app makes direct API calls to the fleet management system without needing the proxy.

## Building

### Web Build

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

### Type Checking

```bash
npm run typecheck
```

## API Integration

The app integrates with the fleet management API at `http://chinamdvr.com:8088` with the following endpoints:

- `StandardApiAction_login.action` - User authentication
- `StandardApiAction_queryUserVehicle.action` - Fetch vehicle list
- `StandardApiAction_getDeviceOlStatus.action` - Get device online status
- `StandardApiAction_logout.action` - User logout

## Project Structure

```
├── app/                           # Application routes
│   ├── (tabs)/                   # Tab navigation screens
│   │   ├── index.tsx             # Vehicles list screen
│   │   └── profile.tsx           # Profile/logout screen
│   ├── login.tsx                 # Login screen
│   └── _layout.tsx               # Root layout with auth navigation
├── contexts/                     # React contexts
│   └── AuthContext.tsx           # Authentication state management
├── services/                     # API services
│   └── fleetApi.ts               # Fleet API client
├── supabase/                     # Supabase resources
│   └── functions/                # Edge Functions
│       └── fleet-proxy/          # Fleet API proxy function
│           └── index.ts          # Proxy implementation
└── assets/                       # Images and static assets
```

## Technology Stack

- **Expo SDK 54** - React Native framework
- **TypeScript** - Type safety
- **Expo Router** - File-based routing
- **Supabase** - Backend infrastructure and Edge Functions
- **AsyncStorage** - Local data persistence
- **Lucide Icons** - Icon library

## Authentication Flow

1. User enters credentials on login screen
2. App sends request to fleet management API
3. On success, session token (jsession) is stored locally
4. User is redirected to vehicles dashboard
5. Session persists across app restarts
6. Logout clears session and redirects to login

## Status Indicators

Vehicles display real-time status:
- **Green** with WiFi icon - Vehicle is online
- **Red** with WiFi off icon - Vehicle is offline
- **Blue** - Status unknown or loading
