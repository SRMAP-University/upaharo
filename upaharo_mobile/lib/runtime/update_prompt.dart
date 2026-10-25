import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/theme.dart';
import '../core/navigation/app_navigator.dart';
import 'feature.dart';

/// Compare dotted versions numerically: 1.10.0 > 1.9.2.
int compareVersions(String a, String b) {
  List<int> parts(String v) => v.split('+').first.split('.').map((n) => int.tryParse(n) ?? 0).toList();
  final pa = parts(a);
  final pb = parts(b);
  for (var i = 0; i < (pa.length > pb.length ? pa.length : pb.length); i++) {
    final diff = (i < pa.length ? pa[i] : 0) - (i < pb.length ? pb[i] : 0);
    if (diff != 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

/// What an `update_prompt` feature asks of this install.
enum UpdateNeed { none, optional, required }

UpdateNeed updateNeedFor(Map<String, dynamic> config, String appVersion) {
  if (appVersion.isEmpty) return UpdateNeed.none;
  final minimum = config['minSupportedVersion']?.toString() ?? '';
  final latest = config['latestVersion']?.toString() ?? '';
  if (minimum.isNotEmpty && compareVersions(appVersion, minimum) < 0) return UpdateNeed.required;
  if (latest.isNotEmpty && compareVersions(appVersion, latest) < 0) return UpdateNeed.optional;
  return UpdateNeed.none;
}

bool _shownThisRun = false;

/// Shows the update dialog: a blocking one below `minSupportedVersion`, a
/// dismissible reminder (at most every `remindAfterHours`) below `latestVersion`.
Future<void> maybeShowUpdatePrompt(AppFeature feature, String appVersion) async {
  if (_shownThisRun) return;
  final config = feature.config;
  final need = updateNeedFor(config, appVersion);
  if (need == UpdateNeed.none) return;

  final prefs = await SharedPreferences.getInstance();
  const remindKey = 'runtime.update.remindedAt';
  if (need == UpdateNeed.optional) {
    final hours = config['remindAfterHours'] is num ? (config['remindAfterHours'] as num).toInt() : 24;
    final last = prefs.getInt(remindKey);
    final now = DateTime.now().millisecondsSinceEpoch;
    if (last != null && now - last < Duration(hours: hours).inMilliseconds) return;
    await prefs.setInt(remindKey, now);
  }

  final context = appNavigatorKey.currentContext;
  if (context == null || !context.mounted) return;
  _shownThisRun = true;

  final storeUrl = Uri.tryParse(config['storeUrl']?.toString() ?? '');
  final required = need == UpdateNeed.required;
  await showDialog<void>(
    context: context,
    barrierDismissible: !required,
    builder: (dialogContext) => PopScope(
      canPop: !required,
      child: AlertDialog(
        title: Text(config['title']?.toString() ?? 'Update available'),
        content: Text(
          required
              ? (config['requiredMessage']?.toString() ??
                  'This version of the app is no longer supported. Please update to continue.')
              : (config['message']?.toString() ?? 'A newer version of the app is available.'),
        ),
        actions: [
          if (!required)
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Later'),
            ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppTheme.wine),
            onPressed: () async {
              if (storeUrl != null) await launchUrl(storeUrl, mode: LaunchMode.externalApplication);
              if (!required && dialogContext.mounted) Navigator.of(dialogContext).pop();
            },
            child: const Text('Update'),
          ),
        ],
      ),
    ),
  );
}
