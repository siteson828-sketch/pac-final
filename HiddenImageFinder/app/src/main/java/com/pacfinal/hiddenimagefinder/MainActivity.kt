package com.pacfinal.hiddenimagefinder

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.pacfinal.hiddenimagefinder.databinding.ActivityMainBinding
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private val scanner = HiddenImageScanner()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.grantAccessButton.setOnClickListener { requestAllFilesAccess() }
        binding.scanButton.setOnClickListener { runScan() }
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionState()
    }

    private fun hasAllFilesAccess(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true // covered by the install-time READ/WRITE_EXTERNAL_STORAGE permissions
        }

    private fun refreshPermissionState() {
        val granted = hasAllFilesAccess()
        binding.scanButton.isEnabled = granted
        binding.grantAccessButton.isEnabled = !granted
        binding.statusText.text = if (granted) {
            "Storage access granted. Ready to scan."
        } else {
            "Grant \"All files access\" first so the scan can see hidden folders."
        }
    }

    private fun requestAllFilesAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(
                Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION,
                Uri.parse("package:$packageName")
            )
            startActivity(intent)
        } else {
            refreshPermissionState()
        }
    }

    private fun runScan() {
        binding.scanButton.isEnabled = false
        binding.grantAccessButton.isEnabled = false
        binding.progressBar.visibility = android.view.View.VISIBLE
        binding.progressBar.isIndeterminate = true
        binding.resultsText.text = ""
        binding.statusText.text = "Scanning…"

        lifecycleScope.launch {
            val result = withContext(Dispatchers.IO) {
                scanner.scan { progress ->
                    runOnUiThread { binding.statusText.text = progress }
                }
            }

            binding.progressBar.visibility = android.view.View.GONE
            binding.scanButton.isEnabled = true
            binding.grantAccessButton.isEnabled = !hasAllFilesAccess()

            binding.statusText.text =
                "Found ${result.found.size} hidden image(s). Copied ${result.copied.size} to " +
                "${result.destinationDir.path}"

            binding.resultsText.text = if (result.found.isEmpty()) {
                "No hidden images found."
            } else {
                result.found.joinToString("\n") { "${it.original.path}  [${it.reason}]" }
            }
        }
    }
}
