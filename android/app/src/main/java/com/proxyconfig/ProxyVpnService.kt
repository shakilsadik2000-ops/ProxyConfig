package com.proxyconfig

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.net.Socket

/**
 * System-wide proxy tunnel built on Android's VpnService.
 *
 * Flow: establish a TUN interface routing 0.0.0.0/0 → hand its fd to tun2socks
 * → tun2socks forwards every flow to the user's proxy. A watchdog coroutine
 * pings the proxy and drives auto-reconnect / kill-switch behaviour, while a
 * stats coroutine reports throughput + latency to React Native every 2s.
 */
class ProxyVpnService : VpnService() {

    companion object {
        const val ACTION_CONNECT = "com.proxyconfig.CONNECT"
        const val ACTION_DISCONNECT = "com.proxyconfig.DISCONNECT"

        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"
        const val EXTRA_USERNAME = "username"
        const val EXTRA_PASSWORD = "password"
        const val EXTRA_PROTOCOL = "protocol"
        const val EXTRA_KILL_SWITCH = "killSwitch"
        const val EXTRA_AUTO_RECONNECT = "autoReconnect"
        const val EXTRA_RECONNECT_INTERVAL = "reconnectInterval"
        const val EXTRA_DNS = "dnsServer"
        const val EXTRA_SPLIT = "splitTunneling" // String[] of package names

        private const val CHANNEL_ID = "proxy_vpn"
        private const val NOTIFICATION_ID = 1001
        // hev-socks5-tunnel defaults: the lwip stack inside the engine uses
        // these as its own interface address/MTU, so the VpnService Builder
        // must match them exactly.
        private const val VPN_ADDRESS = "198.18.0.1"
        private const val VPN_ADDRESS6 = "fc00::1"
        private const val VPN_MTU = 8500
        private const val CONFIG_FILE = "hev-config.yml"
        private const val MAX_RECONNECT_RETRIES = 5

        /** Live reference to the running service so VpnModule can read stats. */
        @Volatile
        var instance: ProxyVpnService? = null
            private set

        val isRunning: Boolean
            get() = instance != null
    }

    private data class Config(
        val host: String,
        val port: Int,
        val username: String,
        val password: String,
        val protocol: String,
        val killSwitch: Boolean,
        val autoReconnect: Boolean,
        val reconnectIntervalSec: Int,
        val dnsServer: String,
        val splitTunneling: List<String>,
    )

    private var tunInterface: ParcelFileDescriptor? = null
    private var config: Config? = null
    private val scope = CoroutineScope(Dispatchers.IO)
    private var watchdogJob: Job? = null
    private var statsJob: Job? = null
    private var tun2socksThread: Thread? = null

    // Stats snapshot, read by VpnModule.getCurrentStats().
    @Volatile
    var connectedSince: Long = 0
        private set
    @Volatile
    var lastBytesSent: Long = 0
        private set
    @Volatile
    var lastBytesReceived: Long = 0
        private set
    @Volatile
    var lastPingMs: Long = 0
        private set
    @Volatile
    var lastIp: String = ""
        private set
    @Volatile
    var dnsLeakSafe: Boolean = true
        private set

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_DISCONNECT -> {
                stopTunnel(emitDisconnected = true)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_CONNECT -> {
                config = readConfig(intent)
                startForeground(NOTIFICATION_ID, buildNotification("Connecting…"))
                instance = this
                VpnModule.emitStatus("connecting")
                startTunnel()
            }
        }
        return START_STICKY
    }

    private fun readConfig(intent: Intent): Config =
        Config(
            host = intent.getStringExtra(EXTRA_HOST).orEmpty(),
            port = intent.getIntExtra(EXTRA_PORT, 0),
            username = intent.getStringExtra(EXTRA_USERNAME).orEmpty(),
            password = intent.getStringExtra(EXTRA_PASSWORD).orEmpty(),
            protocol = intent.getStringExtra(EXTRA_PROTOCOL) ?: "SOCKS5",
            killSwitch = intent.getBooleanExtra(EXTRA_KILL_SWITCH, true),
            autoReconnect = intent.getBooleanExtra(EXTRA_AUTO_RECONNECT, true),
            reconnectIntervalSec = intent.getIntExtra(EXTRA_RECONNECT_INTERVAL, 10),
            dnsServer = intent.getStringExtra(EXTRA_DNS) ?: "1.1.1.1",
            splitTunneling = intent.getStringArrayExtra(EXTRA_SPLIT)?.toList() ?: emptyList(),
        )

    // ── Tunnel lifecycle ─────────────────────────────────────────────────
    private fun startTunnel() {
        val cfg = config ?: return

        // The hev engine speaks SOCKS5 only. HTTP proxies can be validated via
        // Test Connection but cannot drive the full-device tunnel — fail loudly
        // instead of pretending traffic is protected.
        if (cfg.protocol.uppercase() != "SOCKS5") {
            VpnModule.emitError(
                "HTTP proxy tunneling isn't supported by the engine. " +
                    "Use a SOCKS5 profile for system-wide VPN.",
            )
            stopTunnel(emitDisconnected = true)
            stopSelf()
            return
        }

        try {
            tunInterface = establish(cfg)
            val fd = tunInterface?.fd ?: throw IllegalStateException("Null TUN fd")

            // Write the YAML config hev reads, then run it (blocking) on its
            // own thread.
            val configPath = writeConfig(cfg)
            tun2socksThread =
                Thread { Tun2Socks.start(configPath, fd) }.also { it.start() }

            if (!Tun2Socks.available) {
                VpnModule.emitError(
                    "Native engine (libhev-socks5-tunnel.so) is missing — " +
                        "build it via the GitHub Actions workflow. Traffic is " +
                        "not being forwarded.",
                )
            }

            connectedSince = System.currentTimeMillis()
            updateNotification("Connected — ${cfg.host}")
            VpnModule.emitStatus("connected")
            refreshEgressIp(cfg)
            startWatchdog(cfg)
            startStatsLoop()
        } catch (e: Exception) {
            VpnModule.emitError("Failed to establish VPN: ${e.message}")
            stopTunnel(emitDisconnected = true)
            stopSelf()
        }
    }

    /**
     * Render the hev-socks5-tunnel YAML config and persist it to filesDir.
     * Returns the absolute path passed to the native engine.
     */
    private fun writeConfig(cfg: Config): String {
        val sb = StringBuilder()
        sb.appendLine("tunnel:")
        sb.appendLine("  mtu: $VPN_MTU")
        sb.appendLine("  ipv4: $VPN_ADDRESS")
        sb.appendLine("  ipv6: '$VPN_ADDRESS6'")
        sb.appendLine("socks5:")
        sb.appendLine("  port: ${cfg.port}")
        sb.appendLine("  address: ${cfg.host}")
        sb.appendLine("  udp: 'udp'")
        if (cfg.username.isNotEmpty()) {
            sb.appendLine("  username: '${yamlEscape(cfg.username)}'")
            sb.appendLine("  password: '${yamlEscape(cfg.password)}'")
        }
        sb.appendLine("misc:")
        sb.appendLine("  task-stack-size: 81920")
        sb.appendLine("  log-level: warn")

        val file = File(filesDir, CONFIG_FILE)
        file.writeText(sb.toString())
        return file.absolutePath
    }

    /** Escape single quotes for YAML single-quoted scalars (double them). */
    private fun yamlEscape(s: String): String = s.replace("'", "''")

    /** Build the TUN interface that captures all device traffic. */
    private fun establish(cfg: Config): ParcelFileDescriptor {
        val builder =
            Builder()
                .setSession("Proxy Config")
                .setMtu(VPN_MTU)
                .addAddress(VPN_ADDRESS, 32)
                .addRoute("0.0.0.0", 0) // route ALL IPv4 traffic into the tunnel
                .addDnsServer(resolveDns(cfg.dnsServer))
                .setBlocking(true)

        // Capture IPv6 too so it can't leak around the tunnel.
        try {
            builder.addAddress(VPN_ADDRESS6, 128)
            builder.addRoute("::", 0)
        } catch (_: Exception) {
            // Device without IPv6 support — ignore.
        }

        // Split tunneling: listed apps bypass the VPN entirely.
        for (pkg in cfg.splitTunneling) {
            try {
                builder.addDisallowedApplication(pkg)
            } catch (_: Exception) {
                // Package not installed — ignore.
            }
        }

        // Always let our own app bypass so the watchdog / IP-check sockets
        // (which we additionally protect()) never deadlock against the tunnel.
        try {
            builder.addDisallowedApplication(packageName)
        } catch (_: Exception) {
        }

        return builder.establish() ?: throw IllegalStateException("VpnService.establish() returned null")
    }

    private fun resolveDns(dns: String): String = if (dns == "auto") "1.1.1.1" else dns

    private fun stopTunnel(emitDisconnected: Boolean) {
        watchdogJob?.cancel()
        statsJob?.cancel()
        watchdogJob = null
        statsJob = null

        Tun2Socks.stop()
        tun2socksThread?.interrupt()
        tun2socksThread = null

        try {
            tunInterface?.close()
        } catch (_: Exception) {
        }
        tunInterface = null
        connectedSince = 0
        instance = null

        if (emitDisconnected) VpnModule.emitStatus("disconnected")
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    // ── Watchdog: ping proxy, drive reconnect / kill switch ────────────────
    private fun startWatchdog(cfg: Config) {
        watchdogJob =
            scope.launch {
                while (isActive) {
                    delay(30_000) // probe every 30s
                    val rtt = ProxyClient.ping(cfg.host, cfg.port, protect = ::protectSocket)
                    lastPingMs = if (rtt >= 0) rtt else lastPingMs
                    if (rtt < 0) {
                        // Proxy unreachable.
                        if (cfg.autoReconnect) {
                            VpnModule.emitStatus("reconnecting")
                            updateNotification("Reconnecting…")
                            if (!attemptReconnect(cfg)) {
                                handleConnectionLost(cfg)
                                return@launch
                            } else {
                                VpnModule.emitStatus("connected")
                                updateNotification("Connected — ${cfg.host}")
                            }
                        } else {
                            handleConnectionLost(cfg)
                            return@launch
                        }
                    }
                }
            }
    }

    private suspend fun attemptReconnect(cfg: Config): Boolean {
        repeat(MAX_RECONNECT_RETRIES) { attempt ->
            delay(cfg.reconnectIntervalSec * 1000L)
            val rtt = ProxyClient.ping(cfg.host, cfg.port, protect = ::protectSocket)
            if (rtt >= 0) {
                lastPingMs = rtt
                return true
            }
        }
        return false
    }

    /**
     * Reconnect failed. With kill switch ON we keep the TUN up so traffic stays
     * blocked (no route survives without tun2socks forwarding). With it OFF we
     * tear everything down so the device returns to normal connectivity.
     */
    private fun handleConnectionLost(cfg: Config) {
        if (cfg.killSwitch) {
            updateNotification("Disconnected — traffic blocked (Kill Switch)")
            VpnModule.emitStatus("disconnected")
            VpnModule.emitError("Proxy lost — Kill Switch is blocking all traffic")
            // TUN stays up; tun2socks is dead so nothing routes out.
        } else {
            stopTunnel(emitDisconnected = true)
            stopSelf()
        }
    }

    // ── Stats loop ─────────────────────────────────────────────────────────
    private fun startStatsLoop() {
        statsJob =
            scope.launch {
                while (isActive) {
                    val (rx, tx) = readTrafficStats()
                    lastBytesReceived = rx
                    lastBytesSent = tx
                    VpnModule.emitStats(
                        bytesSent = tx,
                        bytesReceived = rx,
                        pingMs = lastPingMs,
                        currentIp = lastIp,
                        dnsLeakSafe = dnsLeakSafe,
                    )
                    delay(2_000)
                }
            }
    }

    /**
     * Read rx/tx byte counters straight from the hev engine. Falls back to
     * summing tun* interfaces in /proc/net/dev if the engine isn't loaded.
     */
    private fun readTrafficStats(): Pair<Long, Long> {
        val (rxEngine, txEngine) = Tun2Socks.stats()
        if (rxEngine > 0 || txEngine > 0) return rxEngine to txEngine

        var rx = 0L
        var tx = 0L
        try {
            File("/proc/net/dev").forEachLine { raw ->
                val line = raw.trim()
                if (line.startsWith("tun")) {
                    val parts = line.substringAfter(":").trim().split(Regex("\\s+"))
                    if (parts.size >= 9) {
                        rx += parts[0].toLongOrNull() ?: 0
                        tx += parts[8].toLongOrNull() ?: 0
                    }
                }
            }
        } catch (_: Exception) {
        }
        return rx to tx
    }

    /** Resolve the public egress IP through the proxy (off the main loop). */
    private fun refreshEgressIp(cfg: Config) {
        scope.launch {
            val res =
                ProxyClient.fetchEgressIp(
                    cfg.host,
                    cfg.port,
                    cfg.username,
                    cfg.password,
                    cfg.protocol,
                    protect = ::protectSocket,
                )
            if (res.success) {
                lastIp = res.ip
                // Naive DNS-leak heuristic: egress IP differs from proxy host.
                dnsLeakSafe = res.ip != cfg.host
            }
        }
    }

    private fun protectSocket(socket: Socket) {
        protect(socket)
    }

    // ── Foreground notification ────────────────────────────────────────────
    private fun buildNotification(text: String): Notification {
        ensureChannel()

        val openIntent =
            PendingIntent.getActivity(
                this,
                0,
                Intent(this, MainActivity::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        val disconnectIntent =
            PendingIntent.getService(
                this,
                1,
                Intent(this, ProxyVpnService::class.java).setAction(ACTION_DISCONNECT),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Proxy Config")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setOngoing(true)
            .setContentIntent(openIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Disconnect", disconnectIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.getNotificationChannel(CHANNEL_ID) == null) {
                nm.createNotificationChannel(
                    NotificationChannel(
                        CHANNEL_ID,
                        "Proxy connection",
                        NotificationManager.IMPORTANCE_LOW,
                    ).apply { description = "Persistent proxy tunnel status" },
                )
            }
        }
    }

    override fun onRevoke() {
        // User disabled the VPN from system settings / another VPN took over.
        stopTunnel(emitDisconnected = true)
        stopSelf()
        super.onRevoke()
    }

    override fun onDestroy() {
        stopTunnel(emitDisconnected = false)
        scope.cancel()
        super.onDestroy()
    }
}
