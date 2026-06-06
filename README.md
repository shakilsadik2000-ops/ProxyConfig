# Proxy Config

A bare-workflow **React Native (Android)** proxy client. Save multiple proxy
profiles (HTTP / SOCKS5) and route all device traffic through them using
Android's `VpnService` + a `tun2socks` userspace forwarder. Includes a Kill
Switch, Auto-Reconnect, Split Tunneling, live stats, and a connection tester.

- **Framework:** React Native 0.73 (bare), TypeScript
- **Native:** Kotlin (`VpnService`, JNI binding to `libhev-socks5-tunnel.so`)
- **Min / Target SDK:** 26 / 34
- **Storage:** AsyncStorage (profiles) + MMKV (settings / active profile)

---

## Project layout

```
ProxyConfig/
├── android/app/src/main/
│   ├── java/com/proxyconfig/
│   │   ├── MainApplication.kt / MainActivity.kt
│   │   ├── VpnPackage.kt          ← RN package registration
│   │   ├── VpnModule.kt           ← JS ↔ native bridge + permission flow
│   │   ├── ProxyVpnService.kt     ← VpnService: TUN, watchdog, stats, kill switch
│   │   ├── Tun2Socks.kt           ← JNI binding for hev-socks5-tunnel
│   │   └── ProxyClient.kt         ← SOCKS5/HTTP client (test + IP check)
│   ├── jniLibs/<abi>/             ← libhev-socks5-tunnel.so (built by CI)
│   └── AndroidManifest.xml
└── src/
    ├── screens/      Home, ProfileList, AddEditProfile, Stats, Settings, SplitTunneling
    ├── components/   ConnectionButton, StatusIndicator, ProfileRow, ToggleRow
    ├── native/       VpnBridge.ts
    ├── store/        profileStore (AsyncStorage), settingsStore (MMKV)
    ├── hooks/        useVpnStatus, useConnectionStats
    ├── navigation/   AppNavigator
    ├── theme/        tokens.ts
    ├── utils/        format.ts
    └── types/        index.ts
```

---

## Prerequisites

- Node 18+
- JDK 17
- Android SDK (API 34) + NDK `25.1.8937393`
- A device/emulator running Android 8.0+ (`arm64-v8a`)

---

## Setup

```bash
cd ProxyConfig
npm install
```

### Gradle wrapper

This repo ships `gradle/wrapper/gradle-wrapper.properties` but **not** the
binary `gradle-wrapper.jar`. Generate it once (requires a system Gradle, or copy
from any RN 0.73 template):

```bash
cd android
gradle wrapper --gradle-version 8.3
```

### Run

```bash
npm run android        # debug build + install
# or
npm start              # Metro only
```

---

## Building the native engine (no local NDK required)

The tunnel uses the **[hev-socks5-tunnel](https://github.com/heiher/hev-socks5-tunnel)**
engine, loaded as:

```
android/app/src/main/jniLibs/<abi>/libhev-socks5-tunnel.so
```

It is a compiled binary (not committed). Build it **in the cloud** with the
bundled GitHub Actions workflow — you don't need an NDK on your PC:

1. Push this `ProxyConfig` folder to a GitHub repo (as the repo root).
2. GitHub → **Actions** → **Build tun2socks engine** → **Run workflow**.
3. It compiles the `.so` for `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`,
   **commits them back** into `jniLibs/<abi>/`, and uploads an artifact.
4. `git pull`, then build the app — tunneling now works.

The workflow passes `-DPKGNAME=com/proxyconfig -DCLSNAME=Tun2Socks` so hev's JNI
methods (`TProxyStartService` / `TProxyStopService` / `TProxyGetStats`) bind to
`com.proxyconfig.Tun2Socks` (see `Tun2Socks.kt`).

> Prefer to build locally? On Linux/WSL with the Android NDK:
> ```bash
> git clone --recursive https://github.com/heiher/hev-socks5-tunnel engine
> cd engine
> $ANDROID_NDK_HOME/ndk-build NDK_PROJECT_PATH=. APP_BUILD_SCRIPT=./Android.mk \
>   NDK_APPLICATION_MK=./Application.mk APP_ABI=arm64-v8a APP_PLATFORM=android-26 \
>   APP_CFLAGS="-O3 -DPKGNAME=com/proxyconfig -DCLSNAME=Tun2Socks"
> cp libs/arm64-v8a/libhev-socks5-tunnel.so \
>    ../android/app/src/main/jniLibs/arm64-v8a/
> ```

> If the `.so` is absent the app still launches, establishes the TUN + kill
> switch, and emits a `vpn_error` — it just won't forward traffic.

### Protocol support

The engine speaks **SOCKS5** only. SOCKS5 profiles (with optional
username/password) tunnel the whole device, IPv4 **and** IPv6. **HTTP** proxy
profiles can still be validated with *Test Connection* (handled in
`ProxyClient.kt`), but selecting one for the live tunnel raises a `vpn_error` —
hev cannot drive a full-device tunnel over an HTTP proxy.

---

## How it works

1. **Connect** (`VpnModule.connect`) runs `VpnService.prepare()`; the first time
   it shows the system VPN-consent dialog (handled via `ActivityEventListener`).
2. `ProxyVpnService` builds a TUN interface (`198.18.0.1/32` + `fc00::1/128`,
   routes `0.0.0.0/0` and `::/0`, user DNS), writes a hev YAML config, and hands
   the fd to the engine, which forwards every flow to the SOCKS5 proxy.
3. A **watchdog** coroutine pings the proxy every 30s. On failure it either
   auto-reconnects (`reconnectIntervalSec`, up to 5 tries) or, with **Kill
   Switch** on, keeps the TUN up so traffic stays blocked.
4. A **stats** coroutine reads `/proc/net/dev` every 2s and emits `vpn_stats`.
5. **Split tunneling** uses `addDisallowedApplication()` for each selected
   package.

Events to JS: `vpn_status` (`connected|disconnected|connecting|reconnecting`),
`vpn_stats`, `vpn_error`.

---

## Security note (please read)

Per the spec, proxy passwords should be encrypted at rest with the **Android
Keystore**. The dependency for this (`androidx.security:security-crypto`) is
already wired into `android/app/build.gradle`, **but** profiles — including the
password field — are currently persisted by `profileStore.ts` via plain
`AsyncStorage`. This is the one place the implementation does not yet meet the
"no plaintext passwords" requirement.

Recommended hardening (not yet implemented):

- Add a small native `SecureStore` module backed by
  `EncryptedSharedPreferences` (or encrypt the password field with a
  Keystore-held AES key) and have `profileStore` round-trip the password
  through it, keeping only the ciphertext in AsyncStorage.

This is called out explicitly so it isn't mistaken for done.

---

## Notes & limitations

- HTTP proxies are validated by Test Connection but cannot drive the live
  tunnel (engine is SOCKS5-only). Use SOCKS5 profiles to connect.
- DNS over the tunnel relies on the SOCKS5 server supporting UDP associate. If
  your proxy is TCP-only, DNS may fail; enable hev `mapdns` in `writeConfig()`
  as a follow-up.
- The DNS-leak check is a heuristic (egress IP vs proxy host); it is not a
  substitute for a full multi-resolver audit.
- App icons are vector adaptive icons (API 26+), so no PNG densities are
  bundled.
```
