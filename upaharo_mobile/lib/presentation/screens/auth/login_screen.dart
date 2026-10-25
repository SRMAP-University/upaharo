import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../../../config/flavor.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/auth/truecaller_login_service.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wishlist_provider.dart';
import '../../widgets/auth_scaffold.dart';

enum _LoginMode { phone, email }

enum _PhoneStep { enterPhone, enterOtp, completeSignup }

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _nameController = TextEditingController();
  final _signupEmailController = TextEditingController();

  bool _obscure = true;
  _LoginMode _mode = _LoginMode.phone;
  _PhoneStep _phoneStep = _PhoneStep.enterPhone;
  int _resendSeconds = 0;
  Timer? _resendTimer;
  /// After trusted-login fails, show an explicit Send OTP control (no auto-SMS).
  bool _offerManualOtp = false;
  bool _truecallerAvailable = false;
  bool _truecallerBusy = false;
  bool _didLeave = false;
  AuthProvider? _auth;

  static const _groollGreen = Color(FlavorConfig.groollGreenValue);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _auth = context.read<AuthProvider>();
      if (_auth!.isAuthenticated) {
        _onAuthenticated();
        return;
      }
      _auth!.addListener(_onAuthFromProvider);
      _prefillRememberedPhone();
      _probeTruecaller();
    });
  }

  void _onAuthFromProvider() {
    if (!mounted || _didLeave) return;
    if (_auth?.isAuthenticated == true) {
      _onAuthenticated();
    }
  }

  Future<void> _probeTruecaller() async {
    // Always show the Android entry point. Usability (Truecaller installed +
    // logged in) is checked on tap so the option is never silently missing.
    final supported = TruecallerLoginService.isSupported;
    if (!mounted) return;
    setState(() => _truecallerAvailable = supported);
    if (!supported) return;
    unawaited(() async {
      try {
        final usable = await TruecallerLoginService.isUsable();
        if (kDebugMode) {
          debugPrint('Truecaller supported=$supported usable=$usable');
        }
      } catch (e) {
        if (kDebugMode) debugPrint('Truecaller probe failed: $e');
      }
    }());
  }

  Future<void> _prefillRememberedPhone() async {
    final auth = context.read<AuthProvider>();
    final phone =
        auth.rememberedPhone ?? await auth.readRememberedPhoneSafe();
    if (!mounted || phone == null || phone.isEmpty) return;
    if (_phoneController.text.trim().isNotEmpty) return;
    setState(() => _phoneController.text = phone);
  }

  @override
  void dispose() {
    _auth?.removeListener(_onAuthFromProvider);
    _resendTimer?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _otpController.dispose();
    _nameController.dispose();
    _signupEmailController.dispose();
    super.dispose();
  }

  void _startResendCountdown(int seconds) {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = seconds);
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendSeconds <= 1) {
        timer.cancel();
        setState(() => _resendSeconds = 0);
      } else {
        setState(() => _resendSeconds -= 1);
      }
    });
  }

  Future<void> _onAuthenticated() async {
    if (!mounted || _didLeave) return;
    _didLeave = true;
    unawaited(context.read<WishlistProvider>().load(force: true));
    Navigator.pushReplacementNamed(context, AppRoutes.main);
  }

  Future<void> _loginEmail() async {
    FocusScope.of(context).unfocus();
    final success = await context.read<AuthProvider>().login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (success) await _onAuthenticated();
  }

  Future<void> _sendOtp({bool resend = false}) async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    final phone = _phoneController.text.trim();

    // Resend always hits SMS (user explicitly asked).
    if (resend) {
      final result = await auth.sendOtp(phone: phone);
      if (result == null || !mounted) return;
      setState(() => _phoneStep = _PhoneStep.enterOtp);
      _startResendCountdown(result.resendIn);
      return;
    }

    // First continue: trusted device only when possible — never auto-SMS if trusted.
    final result = await auth.sendOtpOrTrusted(phone: phone);
    if (!mounted) return;
    if (auth.isAuthenticated) {
      await _onAuthenticated();
      return;
    }
    if (result == null) return;
    if (result.needsManualOtp) {
      setState(() => _offerManualOtp = true);
      return;
    }
    setState(() {
      _offerManualOtp = false;
      _phoneStep = _PhoneStep.enterOtp;
      _otpController.clear();
    });
    _startResendCountdown(result.resendIn);
  }

  Future<void> _sendOtpExplicit() async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    auth.clearError();
    final phone = auth.rememberedPhone?.trim().isNotEmpty == true
        ? auth.rememberedPhone!.trim()
        : _phoneController.text.trim();
    if (phone.isEmpty) return;
    setState(() {
      _phoneController.text = _last10(phone);
      _offerManualOtp = false;
    });
    final result = await auth.sendOtp(phone: _phoneController.text.trim());
    if (result == null || !mounted) return;
    setState(() {
      _phoneStep = _PhoneStep.enterOtp;
      _otpController.clear();
    });
    _startResendCountdown(result.resendIn);
  }

  Future<void> _forgetThisDevice() async {
    await context.read<AuthProvider>().forgetThisDevice();
    if (!mounted) return;
    setState(() {
      _phoneController.clear();
      _phoneStep = _PhoneStep.enterPhone;
      _otpController.clear();
      _offerManualOtp = false;
    });
  }

  Future<void> _verifyOtp() async {
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    final success = await auth.verifyOtp(
      phone: _phoneController.text.trim(),
      code: _otpController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      await _onAuthenticated();
      return;
    }

    if (auth.needsOtpSignup) {
      setState(() => _phoneStep = _PhoneStep.completeSignup);
    }
  }

  Future<void> _completeSignup() async {
    FocusScope.of(context).unfocus();
    final success = await context.read<AuthProvider>().completeOtpSignup(
      name: _nameController.text.trim(),
      email: _signupEmailController.text.trim(),
    );

    if (success) await _onAuthenticated();
  }

  Future<void> _loginWithTruecaller() async {
    if (_truecallerBusy) return;
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    auth.clearError();
    setState(() => _truecallerBusy = true);
    try {
      final result = await auth.loginWithTruecaller();
      if (!mounted) return;

      if (result.signedIn) {
        await _onAuthenticated();
        return;
      }

      if (auth.needsOtpSignup) {
        final name = result.suggestedName?.trim();
        final email = result.suggestedEmail?.trim();
        if (name != null && name.isNotEmpty) {
          _nameController.text = name;
        }
        if (email != null && email.isNotEmpty) {
          _signupEmailController.text = email;
        }
        if (auth.otpVerifiedPhone != null &&
            auth.otpVerifiedPhone!.isNotEmpty) {
          _phoneController.text = _last10(auth.otpVerifiedPhone!);
        }
        setState(() => _phoneStep = _PhoneStep.completeSignup);
      }
    } finally {
      if (mounted) setState(() => _truecallerBusy = false);
    }
  }

  Widget _truecallerButton({required bool loading, required Color accent}) {
    if (!_truecallerAvailable ||
        _mode != _LoginMode.phone ||
        _phoneStep != _PhoneStep.enterPhone) {
      return const SizedBox.shrink();
    }
    final busy = loading || _truecallerBusy;
    return Column(
      children: [
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                'or',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppTheme.charcoal.withValues(alpha: 0.45),
                ),
              ),
            ),
            Expanded(child: Divider(color: Colors.black.withValues(alpha: 0.12))),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 52,
          child: OutlinedButton(
            onPressed: busy ? null : _loginWithTruecaller,
            style: OutlinedButton.styleFrom(
              foregroundColor: accent,
              side: BorderSide(color: accent.withValues(alpha: 0.45)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: busy
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: accent,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.verified_user_outlined, size: 20, color: accent),
                      const SizedBox(width: 8),
                      Text(
                        'Continue with Truecaller',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: accent,
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  void _switchMode(_LoginMode mode) {
    context.read<AuthProvider>().clearError();
    setState(() {
      _mode = mode;
      if (mode == _LoginMode.phone) {
        _phoneStep = _PhoneStep.enterPhone;
      }
    });
  }

  void _backToPhone() {
    context.read<AuthProvider>().clearOtpSignupState();
    setState(() {
      _phoneStep = _PhoneStep.enterPhone;
      _otpController.clear();
    });
  }

  void _continueAsGuest() {
    Navigator.pushReplacementNamed(context, AppRoutes.main);
  }

  String _primaryLabel(AuthProvider auth) {
    if (_mode == _LoginMode.email) return 'Sign in';
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        final masked = _maskedPhone(auth.rememberedPhone);
        if (masked != null) return 'Continue with $masked';
        return 'Continue';
      case _PhoneStep.enterOtp:
        return 'Verify & continue';
      case _PhoneStep.completeSignup:
        return 'Create account';
    }
  }

  String? _maskedPhone(String? phone) {
    if (phone == null || phone.isEmpty) return null;
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) return digits;
    final last10 = digits.substring(digits.length - 10);
    return '${last10.substring(0, 2)}••••${last10.substring(6)}';
  }

  String _last10(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.length <= 10) return digits;
    return digits.substring(digits.length - 10);
  }

  VoidCallback? _primaryAction(AuthProvider auth, bool loading) {
    if (loading) return null;
    if (_mode == _LoginMode.email) return _loginEmail;
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        final remembered = auth.rememberedPhone;
        if (remembered != null && remembered.isNotEmpty) {
          return () async {
            setState(() => _phoneController.text = _last10(remembered));
            await _sendOtp();
          };
        }
        if (!_phoneLooksValid) return null;
        return () => _sendOtp();
      case _PhoneStep.enterOtp:
        return _verifyOtp;
      case _PhoneStep.completeSignup:
        return _completeSignup;
    }
  }

  bool get _phoneLooksValid {
    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    return digits.length >= 10;
  }

  Color get _accent =>
      FlavorConfig.isGrocery ? _groollGreen : _UpaharoLoginColors.accent;

  Color get _heroTop => FlavorConfig.isGrocery
      ? _GroollLoginColors.topGreen
      : _UpaharoLoginColors.topPink;

  String get _logoAsset => FlavorConfig.isGrocery
      ? 'assets/branding/grooll_logo.png'
      : 'assets/branding/upaharo_mark.png';

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.status == AuthStatus.loading;
    // Same phone-OTP-first login for Grooll and Upaharo (brand chrome differs).
    return _buildPhoneOtpLogin(auth, loading);
  }

  // ─── Phone OTP login (Grooll + Upaharo) ────────────────────────────────────

  Widget _buildPhoneOtpLogin(AuthProvider auth, bool loading) {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final accent = _accent;
    final heroTop = _heroTop;

    final lightHero = FlavorConfig.isGifts;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle(
        statusBarColor: heroTop,
        statusBarIconBrightness:
            lightHero ? Brightness.dark : Brightness.light,
        statusBarBrightness: lightHero ? Brightness.light : Brightness.dark,
      ),
      child: Scaffold(
      backgroundColor: heroTop,
      body: Stack(
        fit: StackFit.expand,
        children: [
          ColoredBox(color: heroTop),
          Column(
            children: [
              Expanded(
                flex: keyboardOpen ? 0 : 7,
                child: keyboardOpen
                    ? const SizedBox.shrink()
                    : (FlavorConfig.isGrocery
                        ? const _LoginHeroVideo()
                        : const _UpaharoLoginHero()),
              ),
              Expanded(
                flex: keyboardOpen ? 1 : 5,
                child: ColoredBox(
                  color: Colors.white,
                  child: SafeArea(
                    top: false,
                    child: SingleChildScrollView(
                      padding: EdgeInsets.fromLTRB(
                        22,
                        keyboardOpen ? 48 : 8,
                        22,
                        16,
                      ),
                      child: Column(
                        children: [
                          Image.asset(
                            _logoAsset,
                            height: FlavorConfig.isGrocery ? 52 : 72,
                            width: FlavorConfig.isGrocery ? 52 : 72,
                            fit: FlavorConfig.isGrocery
                                ? BoxFit.cover
                                : BoxFit.contain,
                          ),
                        const SizedBox(height: 14),
                        Text(
                          FlavorConfig.tagline,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: AppTheme.ink,
                            height: 1.15,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _phoneStep == _PhoneStep.completeSignup
                              ? 'Finish creating your account'
                              : _phoneStep == _PhoneStep.enterOtp
                                  ? 'Enter the OTP we sent'
                                  : 'Log in or Sign up',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: AppTheme.charcoal.withValues(alpha: 0.65),
                          ),
                        ),
                        const SizedBox(height: 20),
                        if (_mode == _LoginMode.phone)
                          ..._buildPhoneOtpFields(loading, auth)
                        else
                          ..._buildEmailFields(loading),
                        if (auth.errorMessage != null) ...[
                          const SizedBox(height: 12),
                          AuthErrorBanner(message: auth.errorMessage!),
                        ],
                        const SizedBox(height: 14),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: ElevatedButton(
                            onPressed: _primaryAction(auth, loading),
                            style: ElevatedButton.styleFrom(
                              elevation: 0,
                              backgroundColor:
                                  _primaryAction(auth, loading) == null
                                  ? const Color(0xFFBDBDBD)
                                  : accent,
                              foregroundColor: Colors.white,
                              disabledBackgroundColor: const Color(0xFFBDBDBD),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                            ),
                            child: loading
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    _primaryLabel(auth),
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                          ),
                        ),
                        _truecallerButton(loading: loading, accent: accent),
                        if (_mode == _LoginMode.phone &&
                            _phoneStep == _PhoneStep.enterPhone &&
                            auth.rememberedPhone != null &&
                            auth.rememberedPhone!.isNotEmpty) ...[
                          if (_offerManualOtp)
                            TextButton(
                              onPressed: loading ? null : _sendOtpExplicit,
                              child: Text(
                                'Send OTP instead',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                  color: accent,
                                ),
                              ),
                            ),
                          TextButton(
                            onPressed: loading ? null : _forgetThisDevice,
                            child: Text(
                              'Use a different number',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: AppTheme.charcoal.withValues(alpha: 0.55),
                              ),
                            ),
                          ),
                        ],
                        if (_mode == _LoginMode.phone &&
                            _phoneStep == _PhoneStep.enterOtp) ...[
                          const SizedBox(height: 6),
                          TextButton(
                            onPressed: loading || _resendSeconds > 0
                                ? null
                                : () => _sendOtp(resend: true),
                            child: Text(
                              _resendSeconds > 0
                                  ? 'Resend code in ${_resendSeconds}s'
                                  : 'Resend code',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: accent,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: loading ? null : _backToPhone,
                            child: Text(
                              'Change phone number',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: AppTheme.charcoal.withValues(alpha: 0.55),
                              ),
                            ),
                          ),
                        ],
                        if (_phoneStep != _PhoneStep.completeSignup) ...[
                          const SizedBox(height: 4),
                          TextButton(
                            onPressed: loading
                                ? null
                                : () => _switchMode(
                                      _mode == _LoginMode.phone
                                          ? _LoginMode.email
                                          : _LoginMode.phone,
                                    ),
                            child: Text(
                              _mode == _LoginMode.phone
                                  ? 'Use email instead'
                                  : 'Use phone OTP instead',
                              style: TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                                color: AppTheme.charcoal.withValues(alpha: 0.55),
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 8),
                        Text.rich(
                      TextSpan(
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.35,
                          color: AppTheme.charcoal.withValues(alpha: 0.45),
                        ),
                        children: const [
                          TextSpan(text: 'By continuing, you agree to our '),
                          TextSpan(
                            text: 'Terms of service',
                            style: TextStyle(
                              decoration: TextDecoration.underline,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          TextSpan(text: ' & '),
                          TextSpan(
                            text: 'Privacy policy',
                            style: TextStyle(
                              decoration: TextDecoration.underline,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.center,
                    ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            top: MediaQuery.paddingOf(context).top + 8,
            right: 16,
            child: Material(
              color: Colors.white,
              elevation: 1,
              shadowColor: Colors.black26,
              borderRadius: BorderRadius.circular(20),
              child: InkWell(
                onTap: loading ? null : _continueAsGuest,
                borderRadius: BorderRadius.circular(20),
                child: const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text(
                    'Skip',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1A1A1A),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ),
    );
  }

  List<Widget> _buildPhoneOtpFields(bool loading, AuthProvider auth) {
    final accent = _accent;
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        if (auth.rememberedPhone != null && auth.rememberedPhone!.isNotEmpty) {
          return [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFE0E0E0)),
              ),
              child: Row(
                children: [
                  const Text('🇳🇵', style: TextStyle(fontSize: 22)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _maskedPhone(auth.rememberedPhone) ??
                          auth.rememberedPhone!,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.verified_user_outlined,
                    size: 20,
                    color: accent,
                  ),
                ],
              ),
            ),
          ];
        }
        return [
          Row(
            children: [
              Container(
                height: 54,
                width: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE0E0E0)),
                ),
                child: const Text('🇳🇵', style: TextStyle(fontSize: 22)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  height: 54,
                  alignment: Alignment.centerLeft,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE0E0E0)),
                  ),
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      inputDecorationTheme: const InputDecorationTheme(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        errorBorder: InputBorder.none,
                        focusedErrorBorder: InputBorder.none,
                        filled: false,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                    child: TextField(
                      controller: _phoneController,
                      enabled: !loading,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      onChanged: (_) => setState(() {}),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.ink,
                      ),
                      decoration: InputDecoration(
                        hintText: 'Enter mobile number',
                        hintStyle: TextStyle(
                          fontWeight: FontWeight.w500,
                          color: AppTheme.charcoal.withValues(alpha: 0.4),
                        ),
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        disabledBorder: InputBorder.none,
                        filled: false,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ];
      case _PhoneStep.enterOtp:
        return [
          Text(
            'Code sent to ${_phoneController.text.trim()}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppTheme.charcoal.withValues(alpha: 0.65),
            ),
          ),
          const SizedBox(height: 12),
          _outlinedField(
            controller: _otpController,
            hint: '6-digit OTP',
            keyboardType: TextInputType.number,
            enabled: !loading,
            autofillHints: const [AutofillHints.oneTimeCode],
            formatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
          ),
        ];
      case _PhoneStep.completeSignup:
        return [
          if (auth.otpVerifiedPhone != null) ...[
            Text(
              'Phone ${auth.otpVerifiedPhone} verified',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: AppTheme.charcoal.withValues(alpha: 0.65),
              ),
            ),
            const SizedBox(height: 12),
          ],
          _outlinedField(
            controller: _nameController,
            hint: 'Full name',
            enabled: !loading,
            autofillHints: const [AutofillHints.name],
          ),
          const SizedBox(height: 12),
          _outlinedField(
            controller: _signupEmailController,
            hint: 'Email',
            keyboardType: TextInputType.emailAddress,
            enabled: !loading,
            autofillHints: const [AutofillHints.email],
          ),
        ];
    }
  }

  Widget _outlinedField({
    required TextEditingController controller,
    required String hint,
    bool enabled = true,
    TextInputType? keyboardType,
    List<String>? autofillHints,
    List<TextInputFormatter>? formatters,
  }) {
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E0E0)),
      ),
      alignment: Alignment.center,
      child: Theme(
        data: Theme.of(context).copyWith(
          inputDecorationTheme: const InputDecorationTheme(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            disabledBorder: InputBorder.none,
            errorBorder: InputBorder.none,
            focusedErrorBorder: InputBorder.none,
            filled: false,
            isDense: true,
            contentPadding: EdgeInsets.zero,
          ),
        ),
        child: TextField(
          controller: controller,
          enabled: enabled,
          keyboardType: keyboardType,
          autofillHints: autofillHints,
          inputFormatters: formatters,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: AppTheme.ink,
          ),
          decoration: InputDecoration(
            isDense: true,
            filled: false,
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            disabledBorder: InputBorder.none,
            contentPadding: EdgeInsets.zero,
            hintText: hint,
            hintStyle: TextStyle(
              fontWeight: FontWeight.w500,
              color: AppTheme.charcoal.withValues(alpha: 0.4),
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildEmailFields(bool loading) {
    return [
      _outlinedField(
        controller: _emailController,
        hint: 'Email',
        keyboardType: TextInputType.emailAddress,
        enabled: !loading,
        autofillHints: const [AutofillHints.email],
      ),
      const SizedBox(height: 12),
      Container(
        height: 54,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE0E0E0)),
        ),
        alignment: Alignment.center,
        child: Row(
          children: [
            Expanded(
              child: Theme(
                data: Theme.of(context).copyWith(
                  inputDecorationTheme: const InputDecorationTheme(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    filled: false,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
                child: TextField(
                  controller: _passwordController,
                  enabled: !loading,
                  obscureText: _obscure,
                  autofillHints: const [AutofillHints.password],
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    border: InputBorder.none,
                    hintText: 'Password',
                    hintStyle: TextStyle(
                      fontWeight: FontWeight.w500,
                      color: AppTheme.charcoal.withValues(alpha: 0.4),
                    ),
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: loading
                  ? null
                  : () => setState(() => _obscure = !_obscure),
              icon: Icon(
                _obscure
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined,
                size: 20,
                color: AppTheme.charcoal.withValues(alpha: 0.45),
              ),
            ),
          ],
        ),
      ),
    ];
  }
}

/// Greens matched to the visible video fill (not the file edge row).
abstract final class _GroollLoginColors {
  static const topGreen = Color(0xFF147E42);
}

/// Light pink wash for Upaharo phone-OTP login.
abstract final class _UpaharoLoginColors {
  static const topPink = Color(0xFFFFE4EC);
  static const midPink = Color(0xFFFFD0DE);
  static const deepPink = Color(0xFFFFC0D4);
  /// CTA / accents — readable rose on white buttons.
  static const accent = Color(0xFFE85A8C);
  static const ink = Color(0xFF5C2A3A);
}

/// Auto-scrolling gift mosaic for Upaharo login hero.
class _UpaharoLoginHero extends StatelessWidget {
  const _UpaharoLoginHero();

  static const _rowA = <_GiftChip>[
    _GiftChip('💐', 'Bouquet', Color(0xFFFFE0EC)),
    _GiftChip('🎂', 'Cake', Color(0xFFFFF0D6)),
    _GiftChip('🍫', 'Chocolate', Color(0xFFF3E0D4)),
    _GiftChip('🧸', 'Teddy', Color(0xFFE8F0FF)),
    _GiftChip('🌹', 'Roses', Color(0xFFFFD6E0)),
    _GiftChip('🎁', 'Hamper', Color(0xFFE8FFE8)),
    _GiftChip('🕯️', 'Candles', Color(0xFFFFF6D8)),
    _GiftChip('💍', 'Jewelry', Color(0xFFF0E8FF)),
    _GiftChip('🎈', 'Balloons', Color(0xFFE0F4FF)),
    _GiftChip('🧁', 'Cupcakes', Color(0xFFFFE8F2)),
    _GiftChip('🌿', 'Plants', Color(0xFFE4F5E8)),
    _GiftChip('🍾', 'Celebration', Color(0xFFFFEFD8)),
  ];

  static const _rowB = <_GiftChip>[
    _GiftChip('🎀', 'Gift wrap', Color(0xFFFFE4F0)),
    _GiftChip('🍪', 'Cookies', Color(0xFFFFF2DC)),
    _GiftChip('🌸', 'Orchid', Color(0xFFF8E0F0)),
    _GiftChip('💌', 'Cards', Color(0xFFFFE8E0)),
    _GiftChip('🍩', 'Donuts', Color(0xFFFFE6F4)),
    _GiftChip('🥂', 'Toast', Color(0xFFE8F4FF)),
    _GiftChip('🌻', 'Sunflower', Color(0xFFFFF4C8)),
    _GiftChip('🥝', 'Fruit box', Color(0xFFE4FFE8)),
    _GiftChip('📿', 'Accessories', Color(0xFFF0E8FF)),
    _GiftChip('🍯', 'Gourmet', Color(0xFFFFF0D0)),
    _GiftChip('🪄', 'Surprise', Color(0xFFE8ECFF)),
    _GiftChip('💝', 'Love box', Color(0xFFFFDCE8)),
  ];

  static const _rowC = <_GiftChip>[
    _GiftChip('🌷', 'Tulips', Color(0xFFFFE0F0)),
    _GiftChip('🍰', 'Pastry', Color(0xFFFFF0E4)),
    _GiftChip('🧸', 'Soft toy', Color(0xFFE8F0FF)),
    _GiftChip('🌺', 'Exotic', Color(0xFFFFD8E8)),
    _GiftChip('☕', 'Coffee set', Color(0xFFF3E8DC)),
    _GiftChip('🎄', 'Festive', Color(0xFFE4F8E8)),
    _GiftChip('💎', 'Sparkle', Color(0xFFE8F0FF)),
    _GiftChip('🍬', 'Sweets', Color(0xFFFFE8F4)),
    _GiftChip('🪴', 'Planter', Color(0xFFE0F5E4)),
    _GiftChip('🎻', 'Keepsake', Color(0xFFF8E8FF)),
    _GiftChip('🥳', 'Party', Color(0xFFFFEAD4)),
    _GiftChip('✨', 'Luxury', Color(0xFFFFE8F0)),
  ];

  @override
  Widget build(BuildContext context) {
    final topPad = MediaQuery.paddingOf(context).top;
    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        children: [
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  _UpaharoLoginColors.topPink,
                  _UpaharoLoginColors.midPink,
                  _UpaharoLoginColors.deepPink,
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: Padding(
              padding: EdgeInsets.only(top: topPad + 28, bottom: 40),
              child: Column(
                children: const [
                  Expanded(
                    child: _GiftMarqueeRow(
                      items: _rowA,
                      speed: 28,
                      reverse: false,
                      tileHeight: 92,
                    ),
                  ),
                  SizedBox(height: 10),
                  Expanded(
                    child: _GiftMarqueeRow(
                      items: _rowB,
                      speed: 34,
                      reverse: true,
                      tileHeight: 92,
                    ),
                  ),
                  SizedBox(height: 10),
                  Expanded(
                    child: _GiftMarqueeRow(
                      items: _rowC,
                      speed: 24,
                      reverse: false,
                      tileHeight: 92,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: 160,
            child: IgnorePointer(
              child: Image(
                image: AssetImage('assets/branding/login_white_fade.png'),
                fit: BoxFit.fill,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GiftChip {
  const _GiftChip(this.emoji, this.label, this.tint);
  final String emoji;
  final String label;
  final Color tint;
}

/// Seamless horizontal auto-scroll of gift chips (duplicated for loop).
class _GiftMarqueeRow extends StatefulWidget {
  const _GiftMarqueeRow({
    required this.items,
    required this.speed,
    required this.reverse,
    required this.tileHeight,
  });

  final List<_GiftChip> items;
  final double speed;
  final bool reverse;
  final double tileHeight;

  @override
  State<_GiftMarqueeRow> createState() => _GiftMarqueeRowState();
}

class _GiftMarqueeRowState extends State<_GiftMarqueeRow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  static const _tileWidth = 86.0;
  static const _gap = 10.0;

  @override
  void initState() {
    super.initState();
    final loopWidth = widget.items.length * (_tileWidth + _gap);
    final durationMs = ((loopWidth / widget.speed) * 1000).round().clamp(8000, 40000);
    _ctrl = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: durationMs),
    )..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final loopWidth = widget.items.length * (_tileWidth + _gap);
    final sequence = [...widget.items, ...widget.items];

    // Positioned + min-size Row avoids RenderFlex overflow (~full strip width).
    return ClipRect(
      child: AnimatedBuilder(
        animation: _ctrl,
        builder: (context, _) {
          final t = widget.reverse ? (1 - _ctrl.value) : _ctrl.value;
          final dx = -t * loopWidth;
          return Stack(
            clipBehavior: Clip.hardEdge,
            children: [
              Positioned(
                left: dx,
                top: 0,
                bottom: 0,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final gift in sequence)
                      Padding(
                        padding: const EdgeInsets.only(right: _gap),
                        child: _GiftMarqueeTile(
                          gift: gift,
                          width: _tileWidth,
                          height: widget.tileHeight,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _GiftMarqueeTile extends StatelessWidget {
  const _GiftMarqueeTile({
    required this.gift,
    required this.width,
    required this.height,
  });

  final _GiftChip gift;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: gift.tint,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.85)),
        boxShadow: [
          BoxShadow(
            color: _UpaharoLoginColors.accent.withValues(alpha: 0.12),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(gift.emoji, style: const TextStyle(fontSize: 30)),
          const SizedBox(height: 6),
          Text(
            gift.label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: _UpaharoLoginColors.ink,
              height: 1.1,
            ),
          ),
        ],
      ),
    );
  }
}

/// Login hero — looping scooter video; letterbox bars match clip edges.
class _LoginHeroVideo extends StatefulWidget {
  const _LoginHeroVideo();

  @override
  State<_LoginHeroVideo> createState() => _LoginHeroVideoState();
}

class _LoginHeroVideoState extends State<_LoginHeroVideo> {
  late final VideoPlayerController _controller;
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.asset('assets/branding/login_hero.mp4');
    _controller
      ..setLooping(true)
      ..setVolume(1);
    _controller.initialize().then((_) {
      if (!mounted) return;
      setState(() => _ready = true);
      _controller.play();
    }).catchError((_) {
      if (!mounted) return;
      setState(() => _failed = true);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // --- TWEAK HERE -------------------------------------------------
    // zoom: 1.0 = fill the hero. Raise (1.2, 1.4…) to zoom in more.
    // hideRight: 0.0..1.0 — how hard to crop the RIGHT (Gemini sits here)
    // hideBottom: 0.0..1.0 — how hard to crop the BOTTOM (Gemini sits here)
    // fadeHeight: how far white fades up from the bottom into the video.
    const zoom = 0.7;
    const hideRight = 0.001;
    const hideBottom = 0.0001;
    const fadeHeight = 280.0;
    // ----------------------------------------------------------------

    // Alignment: -1 = left/top, +1 = right/bottom.
    // Negative = keep left/top visible => crops right/bottom (logo).
    final focusX = -hideRight.clamp(0.0, 1.0);
    final focusY = -hideBottom.clamp(0.0, 1.0);

    return ClipRect(
      child: Stack(
        fit: StackFit.expand,
        clipBehavior: Clip.hardEdge,
        children: [
          // Letterbox fill — same green as the video's top edge.
          const ColoredBox(color: _GroollLoginColors.topGreen),
          if (_ready)
            Transform.scale(
              scale: zoom,
              alignment: Alignment(focusX, focusY),
              child: FittedBox(
                fit: BoxFit.cover,
                alignment: Alignment(focusX, focusY),
                child: SizedBox(
                  width: _controller.value.size.width,
                  height: _controller.value.size.height,
                  child: VideoPlayer(_controller),
                ),
              ),
            )
          else if (!_failed)
            const Center(
              child: SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  color: Colors.white54,
                ),
              ),
            ),
          // Dithered white fade PNG — avoids banding from LinearGradient on green.
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            height: fadeHeight,
            child: const IgnorePointer(
              child: Image(
                image: AssetImage('assets/branding/login_white_fade.png'),
                fit: BoxFit.fill,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

