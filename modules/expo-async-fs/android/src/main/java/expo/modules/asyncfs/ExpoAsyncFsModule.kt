package expo.modules.asyncfs

import android.net.Uri
import android.os.Bundle
import androidx.core.os.bundleOf
import com.facebook.react.modules.network.OkHttpClientProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import okhttp3.MediaType
import okhttp3.Request
import okhttp3.ResponseBody
import okio.Buffer
import okio.BufferedSource
import okio.ForwardingSource
import okio.Source
import okio.buffer
import java.io.File
import java.io.FileOutputStream

class ExpoAsyncFsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAsyncFs")

    Events("onDownloadProgress")

    AsyncFunction("listDirectoryAsync") { uri: String ->
      val path = Uri.parse(uri).path ?: return@AsyncFunction emptyList<String>()
      File(path).list()?.toList() ?: emptyList()
    }

    AsyncFunction("getDirectorySizeAsync") { uri: String ->
      val path = Uri.parse(uri).path ?: return@AsyncFunction 0L
      directorySize(File(path))
    }

    // Mirrors expo-file-system's downloadFileAsync but adds a network
    // interceptor for progress events. Uses OkHttpClientProvider (rather
    // than a bare OkHttpClient) so the RN network stack configuration
    // (including custom SSL trust) is inherited.
    AsyncFunction("downloadFileAsyncWithProgress") { url: String, destinationUri: String, downloadId: String ->
      val destPath = Uri.parse(destinationUri).path
        ?: throw Exception("Invalid destination URI")
      val destFile = File(destPath)
      destFile.parentFile?.mkdirs()

      var lastEventTime = 0L

      val client = OkHttpClientProvider.createClient().newBuilder()
        .addNetworkInterceptor { chain ->
          val response = chain.proceed(chain.request())
          val body = response.body ?: return@addNetworkInterceptor response
          val contentLength = body.contentLength()
          val source = object : ForwardingSource(body.source()) {
            var totalBytesRead = 0L

            override fun read(sink: Buffer, byteCount: Long): Long {
              val bytesRead = super.read(sink, byteCount)
              if (bytesRead != -1L) totalBytesRead += bytesRead
              val now = System.currentTimeMillis()
              val isComplete = contentLength > 0 && totalBytesRead >= contentLength
              if (now - lastEventTime >= 100 || isComplete) {
                lastEventTime = now
                sendEvent("onDownloadProgress", bundleOf(
                  "downloadId" to downloadId,
                  "bytesWritten" to totalBytesRead.toDouble(),
                  "totalBytes" to contentLength.toDouble(),
                ))
              }
              return bytesRead
            }
          }
          response.newBuilder()
            .body(ProgressResponseBody(body.contentType(), contentLength, source.buffer()))
            .build()
        }
        .build()

      val request = Request.Builder().url(url).build()
      val response = client.newCall(request).execute()

      if (!response.isSuccessful) {
        response.close()
        throw Exception("Download failed with HTTP status ${response.code}")
      }

      val body = response.body ?: throw Exception("Empty response body")
      body.byteStream().use { input ->
        FileOutputStream(destFile).use { output ->
          input.copyTo(output)
        }
      }

      val fileSize = destFile.length()
      bundleOf(
        "uri" to Uri.fromFile(destFile).toString(),
        "bytes" to fileSize.toDouble(),
      )
    }
  }

  private fun directorySize(dir: File): Long {
    if (!dir.exists()) return 0
    return dir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
  }
}

private class ProgressResponseBody(
  private val contentType: MediaType?,
  private val contentLength: Long,
  private val bufferedSource: BufferedSource,
) : ResponseBody() {
  override fun contentType(): MediaType? = contentType
  override fun contentLength(): Long = contentLength
  override fun source(): BufferedSource = bufferedSource
}
