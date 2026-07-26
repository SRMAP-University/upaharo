import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

import '../navigation/app_navigator.dart';

/// Lightweight Shorebird OTA helper.
///
/// With `auto_update: true` in `shorebird.yaml`, patches download in the
/// background on launch. This service checks status and nudges the user to
/// restart when a downloaded patch is ready.
class ShorebirdUpdateService {
  ShorebirdUpdateService._();

  static final ShorebirdUpdater _updater = ShorebirdUpdater();
  static bool _promptShown = false;

  /// Call once after the app UI is up (never block startup on this).
  static void scheduleCheck() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future<void>.delayed(const Duration(seconds: 3), () {
        checkForUpdate(promptRestart: true);
      });
    });
  }

  static Future<void> checkForUpdate({bool promptRestart = true}) async {
    if (!_updater.isAvailable) {
      if (kDebugMode) {
        debugPrint('[shorebird] updater unavailable (debug / non-Shorebird build)');
      }
      return;
    }

    try {
      final status = await _updater.checkForUpdate();
      if (kDebugMode) debugPrint('[shorebird] update status: $status');

      switch (status) {
        case UpdateStatus.outdated:
          // Ensure the patch is downloaded even if auto_update missed it.
          await _updater.update();
          if (promptRestart) _showRestartSnack();
        case UpdateStatus.restartRequired:
          if (promptRestart) _showRestartSnack();
        case UpdateStatus.upToDate:
        case UpdateStatus.unavailable:
          break;
      }
    } catch (e, st) {
      debugPrint('[shorebird] check failed: $e\n$st');
    }
  }

  static void _showRestartSnack() {
    if (_promptShown) return;
    final context = appNavigatorKey.currentContext;
    if (context == null || !context.mounted) return;

    _promptShown = true;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.showSnackBar(
      const SnackBar(
        content: Text('A quick update is ready. Restart the app to apply it.'),
        duration: Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
