# Native engine goes here

This folder (and the other ABI folders) must contain the compiled tunnel
engine:

    libhev-socks5-tunnel.so

It is **not** committed (compiled binary). Produce it with zero local tooling
via the included GitHub Actions workflow:

1. Push this project to a GitHub repo (this `ProxyConfig` folder as the root).
2. Open the repo → **Actions** tab → **Build tun2socks engine** → **Run workflow**.
3. The workflow builds the `.so` for `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`
   and commits them back into `android/app/src/main/jniLibs/<abi>/`
   (also uploaded as a downloadable artifact).
4. `git pull` and build the app — tunneling now works.

The workflow compiles [hev-socks5-tunnel](https://github.com/heiher/hev-socks5-tunnel)
with `-DPKGNAME=com/proxyconfig -DCLSNAME=Tun2Socks`, so its JNI symbols bind to
`com.proxyconfig.Tun2Socks` (see `Tun2Socks.kt`).

If the `.so` is missing the app still launches, brings up the TUN + kill switch,
and emits a `vpn_error` — it just won't forward traffic until the library
exists.
