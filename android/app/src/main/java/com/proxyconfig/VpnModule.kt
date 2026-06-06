package com.proxyconfig

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.concurrent.thread

/**
 * React Native bridge for the proxy VPN.
 *
 * Exposes connect / disconnect / testConnection / getCurrentStats to JS, and
 * pushes "vpn_status", "vpn_stats" and "vpn_error" events back up. Status/stats
 * events originate in ProxyVpnService and are funnelled through the static
 * emit* helpers here so they share this module's ReactContext.
 */
class VpnModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val NAME = "VpnModule"
        private const val VPN_REQUEST_CODE = 0x0F01

        // Set when the module is constructed; used by the service to emit events.
        @Volatile
        private var emitterContext: ReactApplicationContext? = null

        private fun emit(event: String, payload: WritableMap?) {
            emitterContext
                ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(event, payload)
        }

        fun emitStatus(status: String) {
            val map = Arguments.createMap().apply { putString("status", status) }
            emit("vpn_status", map)
        }

        fun emitStats(
            bytesSent: Long,
            bytesReceived: Long,
            pingMs: Long,
            currentIp: String,
            dnsLeakSafe: Boolean,
        ) {
            val map =
                Arguments.createMap().apply {
                    putDouble("bytesSent", bytesSent.toDouble())
                    putDouble("bytesReceived", bytesReceived.toDouble())
                    putDouble("pingMs", pingMs.toDouble())
                    putString("currentIp", currentIp)
                    putBoolean("dnsLeakSafe", dnsLeakSafe)
                }
            emit("vpn_stats", map)
        }

        fun emitError(message: String) {
            val map = Arguments.createMap().apply { putString("message", message) }
            emit("vpn_error", map)
        }
    }

    // Pending connect() promise + intent, resolved after the consent dialog.
    private var pendingPromise: Promise? = null
    private var pendingConnectIntent: Intent? = null

    private val activityEventListener: ActivityEventListener =
        object : BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity?,
                requestCode: Int,
                resultCode: Int,
                data: Intent?,
            ) {
                if (requestCode != VPN_REQUEST_CODE) return
                if (resultCode == Activity.RESULT_OK) {
                    pendingConnectIntent?.let { startVpnService(it) }
                    pendingPromise?.resolve(resultMap(true))
                } else {
                    pendingPromise?.reject("PERMISSION_DENIED", "VPN permission was denied by the user")
                }
                pendingPromise = null
                pendingConnectIntent = null
            }
        }

    init {
        emitterContext = reactContext
        reactContext.addActivityEventListener(activityEventListener)
    }

    override fun getName(): String = NAME

    // ── Public API ──────────────────────────────────────────────────────────

    @ReactMethod
    fun connect(
        host: String,
        port: Int,
        username: String,
        password: String,
        protocol: String,
        killSwitch: Boolean,
        autoReconnect: Boolean,
        reconnectInterval: Int,
        dnsServer: String,
        splitTunneling: ReadableArray,
        promise: Promise,
    ) {
        val splitPackages = ArrayList<String>()
        for (i in 0 until splitTunneling.size()) {
            splitTunneling.getString(i)?.let { splitPackages.add(it) }
        }

        val intent =
            Intent(reactContext, ProxyVpnService::class.java).apply {
                action = ProxyVpnService.ACTION_CONNECT
                putExtra(ProxyVpnService.EXTRA_HOST, host)
                putExtra(ProxyVpnService.EXTRA_PORT, port)
                putExtra(ProxyVpnService.EXTRA_USERNAME, username)
                putExtra(ProxyVpnService.EXTRA_PASSWORD, password)
                putExtra(ProxyVpnService.EXTRA_PROTOCOL, protocol)
                putExtra(ProxyVpnService.EXTRA_KILL_SWITCH, killSwitch)
                putExtra(ProxyVpnService.EXTRA_AUTO_RECONNECT, autoReconnect)
                putExtra(ProxyVpnService.EXTRA_RECONNECT_INTERVAL, reconnectInterval)
                putExtra(ProxyVpnService.EXTRA_DNS, dnsServer)
                putExtra(ProxyVpnService.EXTRA_SPLIT, splitPackages.toTypedArray())
            }

        // VpnService.prepare() returns a consent Intent the first time (or after
        // the user revoked permission); null means we already have consent.
        val consent = VpnService.prepare(reactContext)
        if (consent != null) {
            val activity = currentActivity
            if (activity == null) {
                promise.reject("NO_ACTIVITY", "No foreground activity to request VPN permission")
                return
            }
            pendingPromise = promise
            pendingConnectIntent = intent
            activity.startActivityForResult(consent, VPN_REQUEST_CODE)
        } else {
            startVpnService(intent)
            promise.resolve(resultMap(true))
        }
    }

    private fun startVpnService(intent: Intent) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        val intent =
            Intent(reactContext, ProxyVpnService::class.java).apply {
                action = ProxyVpnService.ACTION_DISCONNECT
            }
        reactContext.startService(intent)
        promise.resolve(null)
    }

    /**
     * Probe a proxy without bringing up the tunnel and report the egress IP.
     * Runs on a worker thread because it does blocking socket I/O.
     */
    @ReactMethod
    fun testConnection(
        host: String,
        port: Int,
        username: String,
        password: String,
        protocol: String,
        promise: Promise,
    ) {
        thread {
            val res = ProxyClient.fetchEgressIp(host, port, username, password, protocol)
            if (res.success) {
                val map =
                    Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("ip", res.ip)
                    }
                promise.resolve(map)
            } else {
                promise.reject("TEST_FAILED", "Could not reach the proxy or fetch IP")
            }
        }
    }

    @ReactMethod
    fun getCurrentStats(promise: Promise) {
        val svc = ProxyVpnService.instance
        if (svc == null) {
            promise.reject("NOT_CONNECTED", "VPN is not running")
            return
        }
        val map =
            Arguments.createMap().apply {
                putDouble("connectedSince", svc.connectedSince.toDouble())
                putDouble("bytesSent", svc.lastBytesSent.toDouble())
                putDouble("bytesReceived", svc.lastBytesReceived.toDouble())
                putDouble("pingMs", svc.lastPingMs.toDouble())
                putString("currentIp", svc.lastIp)
                putBoolean("dnsLeakSafe", svc.dnsLeakSafe)
            }
        promise.resolve(map)
    }

    @ReactMethod
    fun isConnected(promise: Promise) {
        promise.resolve(ProxyVpnService.isRunning)
    }

    /**
     * Enumerate launchable, non-system apps for the Split Tunneling picker.
     * Returns [{ packageName, appName }]. Runs off the JS thread.
     */
    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        thread {
            try {
                val pm = reactContext.packageManager
                val result = Arguments.createArray()
                val packages = pm.getInstalledApplications(0)
                packages
                    .filter { app ->
                        // Skip our own app and apps with no launcher entry.
                        app.packageName != reactContext.packageName &&
                            pm.getLaunchIntentForPackage(app.packageName) != null
                    }
                    .map { app -> app.packageName to pm.getApplicationLabel(app).toString() }
                    .sortedBy { it.second.lowercase() }
                    .forEach { (pkg, label) ->
                        val map = Arguments.createMap().apply {
                            putString("packageName", pkg)
                            putString("appName", label)
                        }
                        result.pushMap(map)
                    }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("APP_LIST_FAILED", e.message)
            }
        }
    }

    // Required so NativeEventEmitter doesn't warn on iOS-style listener calls.
    @ReactMethod
    fun addListener(eventName: String) {
    }

    @ReactMethod
    fun removeListeners(count: Int) {
    }

    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        reactContext.removeActivityEventListener(activityEventListener)
    }

    private fun resultMap(started: Boolean): WritableMap =
        Arguments.createMap().apply { putBoolean("started", started) }
}
