import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shorebird_code_push/shorebird_code_push.dart';

/// Shorebird OTA helper for the partner app.
///
/// With `auto_update: true` in `shorebird.yaml`, patches download in the
/// background. This service checks status and nudges a restart when ready.
class ShorebirdUpdateService {
  ShorebirdUpdateService._();

  static final ShorebirdUpdater _updater = ShorebirdUpdater();
  static bool _promptShown = false;
  static GlobalKey<ScaffoldMessengerState>? messengerKey;

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
        debugPrint(
          '[shorebird] updater unavailable (debug / non-Shorebird build)',
        );
      }
      return;
    }

    try {
      final status = await _updater.checkForUpdate();
      if (kDebugMode) debugPrint('[shorebird] update status: $status');

      switch (status) {
        case UpdateStatus.outdated:
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
    final messenger = messengerKey?.currentState;
    if (messenger == null) return;
    _promptShown = true;
    messenger.showSnackBar(
      const SnackBar(
        content: Text('A quick update is ready. Restart the app to apply it.'),
        duration: Duration(seconds: 6),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
