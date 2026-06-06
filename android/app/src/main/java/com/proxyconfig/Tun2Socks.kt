package com.proxyconfig

/**
 * Kotlin binding for the hev-socks5-tunnel engine (libhev-socks5-tunnel.so).
 *
 * hev's JNI layer (src/hev-jni.c) registers three native methods onto a class
 * chosen at compile time via -DPKGNAME / -DCLSNAME. Our GitHub Actions build
 * sets PKGNAME=com/proxyconfig and CLSNAME=Tun2Socks, so the symbols bind to
 * the methods declared below:
 *
 *     TProxyStartService(configPath: String, fd: Int)  // blocks until stop
 *     TProxyStopService()
 *     TProxyGetStats(): LongArray  // [txPackets, txBytes, rxPackets, rxBytes]
 *
 * The engine reads/writes raw packets on the VpnService TUN fd and forwards
 * every flow to the configured SOCKS5 proxy (described by a YAML config file).
 *
 * ── IMPORTANT ──────────────────────────────────────────────────────────────
 * The .so is a compiled artifact and is NOT committed. Build it with the
 * provided GitHub Actions workflow (.github/workflows/build-tun2socks.yml) and
 * drop the result at:
 *     android/app/src/main/jniLibs/<abi>/libhev-socks5-tunnel.so
 * See README → "Building the native engine".
 *
 * If the library is missing, [available] is false; ProxyVpnService still brings
 * up the TUN + kill switch and emits a vpn_error instead of crashing.
 */
object Tun2Socks {

    /** True if libhev-socks5-tunnel.so was found and loaded. */
    @JvmField
    var available: Boolean = false

    init {
        available = try {
            System.loadLibrary("hev-socks5-tunnel")
            true
        } catch (t: Throwable) {
            false
        }
    }

    // ── Native methods registered by hev's JNI_OnLoad ────────────────────────
    /** Start the tunnel from a YAML config file. Blocks on its own thread. */
    external fun TProxyStartService(configPath: String, fd: Int)

    /** Stop the running tunnel and join the worker thread. */
    external fun TProxyStopService()

    /** [txPackets, txBytes, rxPackets, rxBytes]; zeros if not running. */
    external fun TProxyGetStats(): LongArray

    // ── Safe wrappers (no-op when the lib is absent) ─────────────────────────
    fun start(configPath: String, tunFd: Int) {
        if (!available) return
        TProxyStartService(configPath, tunFd)
    }

    fun stop() {
        if (!available) return
        try {
            TProxyStopService()
        } catch (_: Throwable) {
        }
    }

    /** Returns Pair(rxBytes, txBytes); (0,0) when unavailable. */
    fun stats(): Pair<Long, Long> {
        if (!available) return 0L to 0L
        return try {
            val s = TProxyGetStats()
            if (s.size >= 4) s[3] to s[1] else 0L to 0L
        } catch (_: Throwable) {
            0L to 0L
        }
    }
}
