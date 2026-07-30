import 'dart:async';

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

  static const _groollGreen = Color(FlavorConfig.groollGreenValue);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _prefillRememberedPhone();
      _probeTruecaller();
    });
  }

  Future<void> _probeTruecaller() async {
    if (!TruecallerLoginService.isSupported) return;
    final usable = await TruecallerLoginService.isUsable();
    if (!mounted) return;
    setState(() => _truecallerAvailable = usable);
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
    if (!mounted) return;
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
    FocusScope.of(context).unfocus();
    final auth = context.read<AuthProvider>();
    auth.clearError();
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
  }

  Widget _truecallerButton({required bool loading, required Color accent}) {
    if (!_truecallerAvailable ||
        _mode != _LoginMode.phone ||
        _phoneStep != _PhoneStep.enterPhone) {
      return const SizedBox.shrink();
    }
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
          child: OutlinedButton.icon(
            onPressed: loading ? null : _loginWithTruecaller,
            icon: const Icon(Icons.verified_user_outlined, size: 20),
            label: const Text(
              'Continue with Truecaller',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
            ),
            style: OutlinedButton.styleFrom(
              foregroundColor: accent,
              side: BorderSide(color: accent.withValues(alpha: 0.45)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.status == AuthStatus.loading;

    if (FlavorConfig.isGrocery) {
      return _buildGroollLogin(auth, loading);
    }
    return _buildClassicLogin(auth, loading);
  }

  // ─── Grooll / Blinkit-style login ──────────────────────────────────────────

  Widget _buildGroollLogin(AuthProvider auth, bool loading) {
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: _GroollLoginColors.topGreen,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
      backgroundColor: _GroollLoginColors.topGreen,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Solid green behind the hero — matches visible video fill.
          const ColoredBox(color: _GroollLoginColors.topGreen),
          Column(
            children: [
              Expanded(
                flex: keyboardOpen ? 0 : 7,
                child: keyboardOpen
                    ? const SizedBox.shrink()
                    : const _LoginHeroVideo(),
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
                          // Brand mark (logo already includes green square)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.asset(
                              'assets/branding/grooll_logo.png',
                              height: 52,
                              width: 52,
                              fit: BoxFit.cover,
                            ),
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
                          ..._buildGroollPhoneFields(loading, auth)
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
                                  : _groollGreen,
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
                        _truecallerButton(loading: loading, accent: _groollGreen),
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
                                  color: _groollGreen,
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
                                color: _groollGreen,
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

  List<Widget> _buildGroollPhoneFields(bool loading, AuthProvider auth) {
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
                    color: _groollGreen,
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

  // ─── Classic gifts AuthScaffold login ──────────────────────────────────────

  Widget _buildClassicLogin(AuthProvider auth, bool loading) {
    return AuthScaffold(
      brandLine: FlavorConfig.appName,
      headline: _phoneStep == _PhoneStep.completeSignup
          ? 'Almost there'
          : 'Welcome back',
      subtitle: _phoneStep == _PhoneStep.completeSignup
          ? 'Add your name and email to finish creating your account.'
          : 'Sign in to send flowers, cakes and thoughtful gifts.',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (_phoneStep != _PhoneStep.completeSignup) ...[
              _ModeToggle(
                mode: _mode,
                enabled: !loading,
                onChanged: _switchMode,
              ),
              const SizedBox(height: 16),
            ],
            if (_mode == _LoginMode.phone)
              ..._buildClassicPhoneFields(loading, auth)
            else
              ..._buildEmailFields(loading),
            const SizedBox(height: 20),
            if (auth.errorMessage != null)
              AuthErrorBanner(message: auth.errorMessage!),
            AuthPrimaryButton(
              label: _primaryLabel(auth),
              loading: loading,
              onPressed: _primaryAction(auth, loading),
            ),
            _truecallerButton(loading: loading, accent: AppTheme.wine),
            if (_offerManualOtp &&
                _mode == _LoginMode.phone &&
                _phoneStep == _PhoneStep.enterPhone)
              TextButton(
                onPressed: loading ? null : _sendOtpExplicit,
                style: TextButton.styleFrom(foregroundColor: AppTheme.wine),
                child: const Text(
                  'Send OTP instead',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                ),
              ),
            if (_mode == _LoginMode.phone &&
                _phoneStep == _PhoneStep.enterOtp) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: loading || _resendSeconds > 0
                    ? null
                    : () => _sendOtp(resend: true),
                style: TextButton.styleFrom(foregroundColor: AppTheme.wine),
                child: Text(
                  _resendSeconds > 0
                      ? 'Resend code in ${_resendSeconds}s'
                      : 'Resend code',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ),
              TextButton(
                onPressed: loading ? null : _backToPhone,
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.charcoal.withAlpha(160),
                ),
                child: const Text(
                  'Change phone number',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
            if (_phoneStep != _PhoneStep.completeSignup) ...[
              const SizedBox(height: 10),
              AuthLinkRow(
                prefix: 'New here? ',
                action: 'Create an account',
                onPressed: loading
                    ? null
                    : () => Navigator.pushNamed(context, AppRoutes.register),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _buildClassicPhoneFields(bool loading, AuthProvider auth) {
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        return [
          AuthField(
            controller: _phoneController,
            label: 'Mobile number',
            icon: Icons.phone_outlined,
            keyboardType: TextInputType.phone,
            autofillHints: const [AutofillHints.telephoneNumber],
            textInputAction: TextInputAction.done,
          ),
          if (auth.rememberedPhone != null &&
              auth.rememberedPhone!.isNotEmpty) ...[
            TextButton(
              onPressed: loading ? null : _forgetThisDevice,
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.charcoal.withAlpha(160),
              ),
              child: const Text(
                'Use a different number',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ];
      case _PhoneStep.enterOtp:
        return [
          Text(
            'Code sent to ${_phoneController.text.trim()}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppTheme.charcoal.withAlpha(170),
            ),
          ),
          const SizedBox(height: 12),
          AuthField(
            controller: _otpController,
            label: '6-digit OTP',
            icon: Icons.lock_outline_rounded,
            keyboardType: TextInputType.number,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.oneTimeCode],
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
                color: AppTheme.charcoal.withAlpha(170),
              ),
            ),
            const SizedBox(height: 12),
          ],
          AuthField(
            controller: _nameController,
            label: 'Full name',
            icon: Icons.person_outline_rounded,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.name],
          ),
          const SizedBox(height: 12),
          AuthField(
            controller: _signupEmailController,
            label: 'Email',
            icon: Icons.mail_outline_rounded,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.email],
          ),
        ];
    }
  }

  List<Widget> _buildEmailFields(bool loading) {
    return [
      AuthField(
        controller: _emailController,
        label: 'Email',
        icon: Icons.mail_outline_rounded,
        keyboardType: TextInputType.emailAddress,
        autofillHints: const [AutofillHints.email],
      ),
      const SizedBox(height: 12),
      AuthField(
        controller: _passwordController,
        label: 'Password',
        icon: Icons.lock_outline_rounded,
        obscureText: _obscure,
        textInputAction: TextInputAction.done,
        autofillHints: const [AutofillHints.password],
        onToggleObscure: () => setState(() => _obscure = !_obscure),
      ),
    ];
  }
}

/// Greens matched to the visible video fill (not the file edge row).
abstract final class _GroollLoginColors {
  static const topGreen = Color(0xFF147E42);
  static const bottomGreen = Color(0xFF27974D);
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

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.mode,
    required this.enabled,
    required this.onChanged,
  });

  final _LoginMode mode;
  final bool enabled;
  final ValueChanged<_LoginMode> onChanged;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(12);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppTheme.charcoal.withAlpha(12),
        borderRadius: radius,
      ),
      child: Row(
        children: [
          Expanded(
            child: _Segment(
              label: 'Phone OTP',
              selected: mode == _LoginMode.phone,
              enabled: enabled,
              onTap: () => onChanged(_LoginMode.phone),
            ),
          ),
          Expanded(
            child: _Segment(
              label: 'Email',
              selected: mode == _LoginMode.email,
              enabled: enabled,
              onTap: () => onChanged(_LoginMode.email),
            ),
          ),
        ],
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppTheme.wine : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected
                  ? Colors.white
                  : AppTheme.charcoal.withAlpha(170),
            ),
          ),
        ),
      ),
    );
  }
}
