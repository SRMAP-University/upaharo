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
///
/// Important: several `truecaller_sdk` MethodChannel handlers never call
/// `result.success()` on the native side (initialize / setOAuth* /
/// getAuthorizationCode). Awaiting those futures hangs forever — match the
/// official example and only await methods that return values.
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

  /// Native init omits `result.success` — treat a short hang as success.
  static Future<void> _invokeIgnoringMissingResult(
    Future<dynamic> future, {
    Duration wait = const Duration(milliseconds: 400),
  }) async {
    try {
      await future.timeout(wait);
    } on TimeoutException {
      // Expected for several Truecaller plugin methods.
    } catch (e) {
      // Real channel errors (e.g. activity missing) should surface.
      rethrow;
    }
  }

  static Future<void> ensureInitialized() async {
    if (!isSupported || _initialized) return;

    await _invokeIgnoringMissingResult(
      TcSdk.initializeSDK(
        sdkOption: TcSdkOptions.OPTION_VERIFY_ONLY_TC_USERS,
        consentHeadingOption: TcSdkOptions.SDK_CONSENT_HEADING_LOG_IN_TO,
        ctaText: TcSdkOptions.CTA_TEXT_CONTINUE,
        buttonShapeOption: TcSdkOptions.BUTTON_SHAPE_ROUNDED,
        footerType: TcSdkOptions.FOOTER_TYPE_ANOTHER_MOBILE_NO,
      ),
    );

    await _subscription?.cancel();
    _subscription = TcSdk.streamCallbackData.listen(
      _onCallback,
      onError: (Object e, StackTrace st) {
        if (kDebugMode) debugPrint('Truecaller stream error: $e');
        _failPending(e, st);
      },
    );
    _initialized = true;
  }

  /// Returns false when Truecaller OAuth is not usable on this device.
  static Future<bool> isUsable() async {
    if (!isSupported) return false;
    await ensureInitialized();
    try {
      final result = await TcSdk.isOAuthFlowUsable;
      if (kDebugMode) {
        debugPrint(
          'Truecaller isOAuthFlowUsable => $result (${result.runtimeType})',
        );
      }
      if (result is bool) return result;
      if (result is num) return result != 0;
      final text = result?.toString().toLowerCase().trim();
      return text == 'true' || text == '1';
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
        'Truecaller is not available. Install Truecaller and stay signed in, '
        'or use phone OTP.',
      );
    }

    if (_pending != null && !_pending!.isCompleted) {
      _failPending(StateError('Truecaller login cancelled'));
    }

    final completer = Completer<TruecallerOAuthResult>();
    _pending = completer;

    try {
      final state = _randomState();
      _oauthState = state;

      // These setters never complete the MethodChannel result — do not await.
      unawaited(TcSdk.setOAuthState(state));
      unawaited(TcSdk.setOAuthScopes(['profile', 'phone', 'openid', 'email']));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final codeVerifierRaw = await TcSdk.generateRandomCodeVerifier;
      final codeVerifier = codeVerifierRaw?.toString() ?? '';
      if (codeVerifier.isEmpty) {
        throw StateError('Truecaller code verifier unavailable on this device');
      }
      final codeChallenge = await TcSdk.generateCodeChallenge(codeVerifier);
      if (codeChallenge == null || codeChallenge.isEmpty) {
        throw StateError('Truecaller code challenge unavailable on this device');
      }
      _codeVerifier = codeVerifier;

      unawaited(TcSdk.setCodeChallenge(codeChallenge));
      await Future<void>.delayed(const Duration(milliseconds: 50));

      // Opens consent UI; native side never calls result.success().
      // Result arrives via [streamCallbackData] only.
      unawaited(
        TcSdk.getAuthorizationCode.catchError((Object e, StackTrace st) {
          if (kDebugMode) debugPrint('Truecaller getAuthorizationCode error: $e');
          _failPending(e, st);
        }),
      );

      if (kDebugMode) debugPrint('Truecaller consent requested, waiting…');

      return await completer.future.timeout(
        const Duration(seconds: 60),
        onTimeout: () {
          throw TimeoutException(
            'Truecaller timed out. Try again or use phone OTP.',
          );
        },
      );
    } catch (e, st) {
      if (_pending == completer && !completer.isCompleted) {
        completer.completeError(e, st);
      }
      if (identical(_pending, completer)) {
        _pending = null;
      }
      rethrow;
    }
  }

  static void _onCallback(TcSdkCallback callback) {
    if (kDebugMode) {
      debugPrint('Truecaller callback: ${callback.result}');
    }
    final pending = _pending;
    if (pending == null || pending.isCompleted) return;

    switch (callback.result) {
      case TcSdkCallbackResult.success:
        final data = callback.tcOAuthData;
        final verifier = _codeVerifier;
        if (data == null ||
            data.authorizationCode.isEmpty ||
            verifier == null ||
            verifier.isEmpty) {
          _failPending(StateError('Truecaller response incomplete'));
          return;
        }
        final expected = _oauthState;
        if (expected != null &&
            expected.isNotEmpty &&
            data.state.isNotEmpty &&
            data.state != expected) {
          _failPending(StateError('Truecaller OAuth state mismatch'));
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
        final friendly = switch (code) {
          2 || 14 => 'Truecaller sign-in was cancelled',
          _ => code != null ? 'Truecaller ($code): $message' : message,
        };
        _failPending(StateError(friendly));
        break;
      case TcSdkCallbackResult.verification:
        _failPending(
          StateError('Truecaller verification required — use phone OTP instead'),
        );
        break;
      default:
        _failPending(StateError('Unexpected Truecaller result'));
    }
  }

  static void _failPending(Object error, [StackTrace? st]) {
    final pending = _pending;
    if (pending != null && !pending.isCompleted) {
      pending.completeError(error, st);
    }
    _pending = null;
  }

  static String _randomState() {
    final r = Random.secure();
    final bytes = List<int>.generate(16, (_) => r.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  static Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    _failPending(StateError('Truecaller disposed'));
    _oauthState = null;
    _codeVerifier = null;
    _initialized = false;
  }
}
