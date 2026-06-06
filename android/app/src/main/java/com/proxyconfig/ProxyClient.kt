package com.proxyconfig

import android.util.Base64
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.net.Socket

/**
 * Minimal SOCKS5 / HTTP proxy client used for two things:
 *   1. testConnection() — verify a proxy works and report the egress IP.
 *   2. The in-tunnel IP / DNS-leak check run by ProxyVpnService.
 *
 * It speaks just enough of each protocol to open one outbound TCP connection
 * and fetch http://api.ipify.org. This is intentionally dependency-free.
 *
 * @param protect optional hook; when called from inside the VpnService we pass
 *        VpnService::protect so these sockets bypass our own TUN (otherwise the
 *        request would loop back into the tunnel that depends on it).
 */
object ProxyClient {

    private const val IP_HOST = "api.ipify.org"
    private const val IP_PATH = "/?format=json"
    private const val IP_PORT = 80

    data class Result(val success: Boolean, val ip: String, val pingMs: Long)

    /**
     * Open a TCP connection to the proxy and tunnel a request to api.ipify.org.
     * Returns the discovered public IP and the proxy handshake latency.
     */
    fun fetchEgressIp(
        host: String,
        port: Int,
        username: String,
        password: String,
        protocol: String,
        timeoutMs: Int = 5000,
        protect: ((Socket) -> Unit)? = null,
    ): Result {
        var socket: Socket? = null
        return try {
            val start = System.currentTimeMillis()
            socket = Socket()
            protect?.invoke(socket) // bypass our own VPN when running in-service
            socket.connect(InetSocketAddress(host, port), timeoutMs)
            socket.soTimeout = timeoutMs
            val pingMs = System.currentTimeMillis() - start

            val body =
                when (protocol.uppercase()) {
                    "SOCKS5" -> socks5Fetch(socket, username, password)
                    else -> httpProxyFetch(socket, username, password)
                }
            val ip = parseIp(body)
            Result(ip.isNotEmpty(), ip, pingMs)
        } catch (e: Exception) {
            Result(false, "", -1)
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
        }
    }

    /** Simple TCP reachability probe; returns latency in ms or -1 on failure. */
    fun ping(host: String, port: Int, timeoutMs: Int = 4000, protect: ((Socket) -> Unit)? = null): Long {
        var socket: Socket? = null
        return try {
            val start = System.currentTimeMillis()
            socket = Socket()
            protect?.invoke(socket)
            socket.connect(InetSocketAddress(host, port), timeoutMs)
            System.currentTimeMillis() - start
        } catch (e: Exception) {
            -1
        } finally {
            try {
                socket?.close()
            } catch (_: Exception) {
            }
        }
    }

    // ── HTTP proxy ──────────────────────────────────────────────────────────
    // For a plain-HTTP origin we send an absolute-form request line straight to
    // the proxy; auth (if any) goes in Proxy-Authorization.
    private fun httpProxyFetch(socket: Socket, username: String, password: String): String {
        val req = StringBuilder()
        req.append("GET http://$IP_HOST$IP_PATH HTTP/1.1\r\n")
        req.append("Host: $IP_HOST\r\n")
        req.append("User-Agent: ProxyConfig/1.0\r\n")
        req.append("Accept: */*\r\n")
        req.append("Connection: close\r\n")
        if (username.isNotEmpty()) {
            val token = Base64.encodeToString("$username:$password".toByteArray(), Base64.NO_WRAP)
            req.append("Proxy-Authorization: Basic $token\r\n")
        }
        req.append("\r\n")
        socket.getOutputStream().apply {
            write(req.toString().toByteArray())
            flush()
        }
        return readHttpBody(socket)
    }

    // ── SOCKS5 ──────────────────────────────────────────────────────────────
    private fun socks5Fetch(socket: Socket, username: String, password: String): String {
        val out = socket.getOutputStream()
        val inp = socket.getInputStream()

        // Greeting: offer "no auth" (0x00) and "user/pass" (0x02).
        out.write(byteArrayOf(0x05, 0x02, 0x00, 0x02))
        out.flush()
        val method = ByteArray(2)
        readFully(inp, method)
        if (method[0].toInt() != 0x05) throw IllegalStateException("Not SOCKS5")

        when (method[1].toInt() and 0xFF) {
            0x00 -> {} // no auth required
            0x02 -> {
                // Username/password auth (RFC 1929).
                val u = username.toByteArray()
                val p = password.toByteArray()
                val auth = ByteArray(3 + u.size + p.size)
                auth[0] = 0x01
                auth[1] = u.size.toByte()
                System.arraycopy(u, 0, auth, 2, u.size)
                auth[2 + u.size] = p.size.toByte()
                System.arraycopy(p, 0, auth, 3 + u.size, p.size)
                out.write(auth)
                out.flush()
                val authResp = ByteArray(2)
                readFully(inp, authResp)
                if (authResp[1].toInt() != 0x00) throw IllegalStateException("SOCKS5 auth failed")
            }
            else -> throw IllegalStateException("No acceptable SOCKS5 auth method")
        }

        // CONNECT request to api.ipify.org:80 using a domain-name address (0x03).
        val hostBytes = IP_HOST.toByteArray()
        val connect = ByteArray(7 + hostBytes.size)
        connect[0] = 0x05 // version
        connect[1] = 0x01 // CONNECT
        connect[2] = 0x00 // reserved
        connect[3] = 0x03 // domain name
        connect[4] = hostBytes.size.toByte()
        System.arraycopy(hostBytes, 0, connect, 5, hostBytes.size)
        connect[5 + hostBytes.size] = ((IP_PORT shr 8) and 0xFF).toByte()
        connect[6 + hostBytes.size] = (IP_PORT and 0xFF).toByte()
        out.write(connect)
        out.flush()

        // Reply: VER REP RSV ATYP BND.ADDR BND.PORT — read & validate REP==0.
        val head = ByteArray(4)
        readFully(inp, head)
        if (head[1].toInt() != 0x00) throw IllegalStateException("SOCKS5 connect failed: ${head[1]}")
        // Consume the bound address so the stream is positioned at the payload.
        when (head[3].toInt() and 0xFF) {
            0x01 -> skip(inp, 4)
            0x03 -> {
                val len = inp.read()
                skip(inp, len)
            }
            0x04 -> skip(inp, 16)
        }
        skip(inp, 2) // bound port

        // Now the socket is a raw tunnel to ipify — send a plain HTTP request.
        val req =
            "GET $IP_PATH HTTP/1.1\r\nHost: $IP_HOST\r\nUser-Agent: ProxyConfig/1.0\r\n" +
                "Accept: */*\r\nConnection: close\r\n\r\n"
        out.write(req.toByteArray())
        out.flush()
        return readHttpBody(socket)
    }

    // ── helpers ───────────────────────────────────────────────────────────
    private fun readHttpBody(socket: Socket): String {
        val reader = BufferedReader(InputStreamReader(socket.getInputStream()))
        val sb = StringBuilder()
        var line: String?
        var inBody = false
        while (reader.readLine().also { line = it } != null) {
            if (inBody) {
                sb.append(line)
            } else if (line.isNullOrEmpty()) {
                inBody = true // blank line separates headers from body
            }
        }
        return sb.toString()
    }

    private fun parseIp(body: String): String {
        // Body looks like {"ip":"x.x.x.x"} (JSON) or just "x.x.x.x".
        val m = Regex("\\d{1,3}(?:\\.\\d{1,3}){3}").find(body)
        return m?.value ?: ""
    }

    private fun readFully(inp: java.io.InputStream, buf: ByteArray) {
        var off = 0
        while (off < buf.size) {
            val r = inp.read(buf, off, buf.size - off)
            if (r < 0) throw IllegalStateException("Unexpected EOF")
            off += r
        }
    }

    private fun skip(inp: java.io.InputStream, n: Int) {
        var remaining = n.toLong()
        while (remaining > 0) {
            val s = inp.skip(remaining)
            if (s <= 0) {
                if (inp.read() < 0) break
                remaining--
            } else {
                remaining -= s
            }
        }
    }
}
