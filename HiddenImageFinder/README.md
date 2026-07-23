# Hidden Image Finder

A small Android app for your own phone that scans device storage for images
hidden from the Gallery app, and collects them into a `Pictures/drab` folder
so you can browse them normally.

## What counts as "hidden"

- Any image sitting in a folder (or subfolder) that contains a `.nomedia`
  marker file — Android's Gallery/Photos apps skip these on purpose.
- Any image whose filename starts with a dot (e.g. `.vacation.jpg`).

## What it does

1. Walks external storage (skipping `Android/` and its own output folder).
2. Copies every match into `Pictures/drab/`, renaming on collision.
3. Writes `Pictures/drab/drab_manifest.txt` listing each original path, where
   it was copied to, and why it was flagged.
4. Shows the full list of matches in-app.

Nothing is deleted or moved — originals are left in place; matches are
*copied* into `drab`.

## Permissions

Seeing `.nomedia` folders and dotfiles requires raw filesystem access, not
just the MediaStore, so the app requests **All files access**
(`MANAGE_EXTERNAL_STORAGE`) on Android 11+. On first launch, tap
"Grant All Files Access", enable it for this app in the system settings
screen that opens, then come back and tap "Scan for Hidden Images".

## Getting the APK — no Android Studio required

Every push to `main` that touches `HiddenImageFinder/` runs
[`.github/workflows/build-hidden-image-finder.yml`](../.github/workflows/build-hidden-image-finder.yml),
which builds a debug APK on GitHub's servers:

1. On GitHub, go to the repo's **Actions** tab → **Build Hidden Image
   Finder APK** → pick the latest successful run (or use "Run workflow" to
   trigger one manually).
2. Download the `hidden-image-finder-debug-apk` artifact — it's a zip
   containing `app-debug.apk`.
3. Transfer the APK to your phone (e.g. email it to yourself, or download
   it directly in your phone's browser from the Actions run page).
4. On your phone, open the APK to install it. Android will prompt you to
   allow installs from that source ("Install unknown apps") the first
   time — allow it just for that app/browser.
5. Launch the app, tap "Grant All Files Access", then "Scan for Hidden
   Images".

## Building locally instead

This project was scaffolded without an Android SDK / network access to
Google's Maven repo available in the sandbox that generated it, so:

- `gradle/wrapper/gradle-wrapper.jar` is **not** included.

To build it yourself:

1. Open the `HiddenImageFinder/` folder in Android Studio (Giraffe or newer).
   Android Studio will generate the Gradle wrapper and sync dependencies
   automatically.
2. Or, from a machine with network access and the Android SDK installed:
   ```
   cd HiddenImageFinder
   gradle wrapper --gradle-version 8.7
   ./gradlew assembleDebug
   ```

Project structure:
- `app/src/main/java/.../MainActivity.kt` — UI + permission flow
- `app/src/main/java/.../HiddenImageScanner.kt` — the actual scan/copy logic
- `app/src/main/AndroidManifest.xml` — permissions
