package com.pacfinal.hiddenimagefinder

import android.os.Environment
import java.io.File
import java.io.IOException

/**
 * Walks the device's external storage looking for image files that Android's
 * Gallery app hides from the user: files sitting in a directory tree marked
 * with a `.nomedia` file, and dotfiles (filenames starting with `.`).
 */
class HiddenImageScanner {

    data class Found(val original: File, val reason: String)

    data class ScanResult(
        val found: List<Found>,
        val copied: List<File>,
        val destinationDir: File,
    )

    private val imageExtensions = setOf(
        "jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif"
    )

    // Skip huge/irrelevant/restricted trees and our own output folder.
    private val skipDirNames = setOf("Android", DEST_FOLDER_NAME)

    fun scan(onProgress: (String) -> Unit = {}): ScanResult {
        val root = Environment.getExternalStorageDirectory()
        val found = mutableListOf<Found>()

        walk(root, nomediaAncestor = false, onProgress) { file, reason ->
            found += Found(file, reason)
        }

        val destinationDir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
            DEST_FOLDER_NAME
        )
        destinationDir.mkdirs()

        val copied = copyAll(found, destinationDir, onProgress)

        return ScanResult(found, copied, destinationDir)
    }

    private fun walk(
        dir: File,
        nomediaAncestor: Boolean,
        onProgress: (String) -> Unit,
        onFound: (File, String) -> Unit,
    ) {
        if (!dir.isDirectory) return
        if (dir.name in skipDirNames) return

        val entries = dir.listFiles() ?: return
        val hiddenHere = nomediaAncestor || entries.any { it.isFile && it.name == ".nomedia" }

        onProgress(dir.path)

        for (entry in entries) {
            if (entry.isDirectory) {
                walk(entry, hiddenHere, onProgress, onFound)
            } else if (entry.isFile) {
                val ext = entry.extension.lowercase()
                if (ext !in imageExtensions) continue

                val isDotfile = entry.name.startsWith(".")
                when {
                    hiddenHere -> onFound(entry, "in .nomedia-marked folder")
                    isDotfile -> onFound(entry, "dotfile")
                }
            }
        }
    }

    private fun copyAll(
        found: List<Found>,
        destinationDir: File,
        onProgress: (String) -> Unit,
    ): List<File> {
        val manifest = File(destinationDir, "drab_manifest.txt")
        val copied = mutableListOf<File>()

        manifest.bufferedWriter().use { writer ->
            for ((index, item) in found.withIndex()) {
                onProgress("Copying ${index + 1}/${found.size}: ${item.original.name}")
                val dest = uniqueDestination(destinationDir, item.original.name)
                try {
                    item.original.copyTo(dest, overwrite = false)
                    copied += dest
                    writer.appendLine("${item.original.absolutePath} -> ${dest.name} (${item.reason})")
                } catch (e: IOException) {
                    writer.appendLine("${item.original.absolutePath} -> FAILED: ${e.message}")
                }
            }
        }
        return copied
    }

    private fun uniqueDestination(dir: File, name: String): File {
        var candidate = File(dir, name.removePrefix("."))
        if (!candidate.exists()) return candidate

        val dot = candidate.name.lastIndexOf('.')
        val base = if (dot > 0) candidate.name.substring(0, dot) else candidate.name
        val ext = if (dot > 0) candidate.name.substring(dot) else ""
        var counter = 1
        while (candidate.exists()) {
            candidate = File(dir, "$base-$counter$ext")
            counter++
        }
        return candidate
    }

    companion object {
        const val DEST_FOLDER_NAME = "drab"
    }
}
