package studio.zojer.kairos.engine

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.security.MessageDigest
import org.json.JSONObject

// Access is serialized across module instances, including fast refresh.
internal object KairosNative {
  private var initialized = false
  private var loaded = false
  external fun initialize(path: String, atlasPath: String): String
  external fun search(query: String): String
  external fun calculate(request: String): String

  private fun initializeIfNeeded(context: Context) {
    if (!loaded) {
      System.loadLibrary("kairos_jni")
      loaded = true
    }
    if (!initialized) {
      val manifest = JSONObject(context.assets.open("Ephemeris/manifest.json").bufferedReader().use { it.readText() })
      val directory = File(context.filesDir, "kairos-ephemeris")
      check(directory.isDirectory || directory.mkdirs()) { "Cannot create ephemeris directory" }
      for (name in manifest.keys()) {
        val bytes = context.assets.open("Ephemeris/$name").use { it.readBytes() }
        val hash = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
        check(hash == manifest.getString(name)) { "Ephemeris checksum failed: $name" }
        // Re-extract on process startup; no stale file survives an app update.
        File(directory, name).writeBytes(bytes)
      }
      val atlas = File(context.filesDir, "kairos-atlas.db")
      context.assets.open("Atlas/atlas.db").use { input -> atlas.outputStream().use { input.copyTo(it) } }
      initialize(directory.absolutePath, "sqlite://${atlas.absolutePath}?mode=ro")
      initialized = true
    }
  }

  @Synchronized
  fun chart(context: Context, request: String): String {
    initializeIfNeeded(context)
    return calculate(request)
  }

  @Synchronized
  fun locations(context: Context, query: String): String {
    initializeIfNeeded(context)
    return search(query)
  }
}

class KairosModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Kairos")
    AsyncFunction("searchLocations") { query: String ->
      val context = appContext.reactContext ?: error("React context unavailable")
      KairosNative.locations(context, query)
    }
    AsyncFunction("calculateChart") { request: String ->
      val context = appContext.reactContext ?: error("React context unavailable")
      KairosNative.chart(context, request)
    }
  }
}
