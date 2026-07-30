import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:truecaller_sdk/truecaller_sdk.dart';

/// Result of a successful Truecaller OAuth consent (authorization code + PKCE).
class TruecallerOAuthResult {
  const TruecallerOAuthResult({
    required this.authorizationCode,
    required this.codeVerifier,
    required this.state,
  });

  final String authorizationCode;
  final String codeVerifier;
  final String state;
}

/// Android-only Truecaller OAuth helper (sandbox ClientId in AndroidManifest).
class TruecallerLoginService {
  TruecallerLoginService._();

  static bool get isSupported {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid;
    } catch (_) {
      return false;
    }
  }

  static bool _initialized = false;
  static StreamSubscription<TcSdkCallback>? _subscription;
  static Completer<TruecallerOAuthResult>? _pending;
  static String? _oauthState;
  static String? _codeVerifier;

  static Future<void> ensureInitialized() async {
    if (!isSupported || _initialized) return;
    TcSdk.initializeSDK(
      sdkOption: TcSdkOptions.OPTION_VERIFY_ONLY_TC_USERS,
      consentHeadingOption: TcSdkOptions.SDK_CONSENT_HEADING_LOG_IN_TO,
      ctaText: TcSdkOptions.CTA_TEXT_CONTINUE,
      buttonShapeOption: TcSdkOptions.BUTTON_SHAPE_ROUNDED,
      footerType: TcSdkOptions.FOOTER_TYPE_ANOTHER_MOBILE_NO,
    );
    _initialized = true;
  }

  /// Returns null when Truecaller OAuth is not usable on this device.
  static Future<bool> isUsable() async {
    if (!isSupported) return false;
    await ensureInitialized();
    try {
      final result = await TcSdk.isOAuthFlowUsable;
      return result == true || result == 'true' || result == 1;
    } catch (e) {
      if (kDebugMode) debugPrint('Truecaller isOAuthFlowUsable failed: $e');
      return false;
    }
  }

  /// Opens Truecaller consent and resolves with auth code + code verifier.
  static Future<TruecallerOAuthResult> requestAuthorizationCode() async {
    if (!isSupported) {
      throw StateError('Truecaller is only available on Android');
    }
    await ensureInitialized();

    final usable = await isUsable();
    if (!usable) {
      throw StateError(
        'Truecaller is not available. Install Truecaller or use phone OTP.',
      );
    }

    if (_pending != null && !_pending!.isCompleted) {
      _pending!.completeError(StateError('Truecaller login already in progress'));
    }
    final completer = Completer<TruecallerOAuthResult>();
    _pending = completer;

    await _subscription?.cancel();
    _subscription = TcSdk.streamCallbackData.listen(
      _onCallback,
      onError: (Object e, StackTrace st) {
        if (_pending != null && !_pending!.isCompleted) {
          _pending!.completeError(e, st);
        }
      },
    );

    final state = _randomState();
    _oauthState = state;
    TcSdk.setOAuthState(state);
    TcSdk.setOAuthScopes(['profile', 'phone', 'openid', 'email']);

    final codeVerifier = await TcSdk.generateRandomCodeVerifier;
    final codeChallenge = await TcSdk.generateCodeChallenge(codeVerifier);
    if (codeChallenge == null || codeChallenge.isEmpty) {
      throw StateError('Truecaller code challenge unavailable on this device');
    }
    _codeVerifier = codeVerifier;
    TcSdk.setCodeChallenge(codeChallenge);
    await TcSdk.getAuthorizationCode;

    return completer.future.timeout(
      const Duration(minutes: 2),
      onTimeout: () {
        throw TimeoutException('Truecaller login timed out');
      },
    );
  }

  static void _onCallback(TcSdkCallback callback) {
    final pending = _pending;
    if (pending == null || pending.isCompleted) return;

    switch (callback.result) {
      case TcSdkCallbackResult.success:
        final data = callback.tcOAuthData;
        final verifier = _codeVerifier;
        if (data == null || verifier == null || verifier.isEmpty) {
          pending.completeError(StateError('Truecaller response incomplete'));
          return;
        }
        final expected = _oauthState;
        if (expected != null &&
            expected.isNotEmpty &&
            data.state.isNotEmpty &&
            data.state != expected) {
          pending.completeError(StateError('Truecaller OAuth state mismatch'));
          return;
        }
        pending.complete(
          TruecallerOAuthResult(
            authorizationCode: data.authorizationCode,
            codeVerifier: verifier,
            state: data.state,
          ),
        );
        break;
      case TcSdkCallbackResult.failure:
        final code = callback.error?.code;
        final message = callback.error?.message ?? 'Truecaller login failed';
        pending.completeError(
          StateError(code != null ? 'Truecaller ($code): $message' : message),
        );
        break;
      case TcSdkCallbackResult.verification:
        // OPTION_VERIFY_ONLY_TC_USERS should not land here; treat as fallback.
        pending.completeError(
          StateError('Truecaller verification required — use phone OTP instead'),
        );
        break;
      default:
        pending.completeError(StateError('Unexpected Truecaller result'));
    }
  }

  static String _randomState() {
    final r = Random.secure();
    final bytes = List<int>.generate(16, (_) => r.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    _pending = null;
    _oauthState = null;
    _codeVerifier = null;
  }
}
