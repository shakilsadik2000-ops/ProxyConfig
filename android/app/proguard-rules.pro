# Keep our native VPN classes and the JNI tun2socks bridge intact.
-keep class com.proxyconfig.** { *; }
-keepclassmembers class com.proxyconfig.Tun2Socks { *; }
