import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/flavor.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
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

  void _startResendCooldown(int seconds) {
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
    final result = await auth.sendOtp(phone: _phoneController.text.trim());
    if (result == null || !mounted) return;

    setState(() {
      _phoneStep = _PhoneStep.enterOtp;
      if (!resend) _otpController.clear();
    });
    _startResendCooldown(result.resendIn);
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

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.status == AuthStatus.loading;

    return AuthScaffold(
      brandLine: FlavorConfig.appName,
      headline: _phoneStep == _PhoneStep.completeSignup
          ? 'Almost there'
          : 'Welcome back',
      subtitle: _phoneStep == _PhoneStep.completeSignup
          ? 'Add your name and email to finish creating your account.'
          : FlavorConfig.isGrocery
          ? 'Sign in to shop fresh essentials and everyday needs.'
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
              ..._buildPhoneFields(loading, auth)
            else
              ..._buildEmailFields(loading),
            const SizedBox(height: 20),
            if (auth.errorMessage != null)
              AuthErrorBanner(message: auth.errorMessage!),
            AuthPrimaryButton(
              label: _primaryLabel,
              loading: loading,
              onPressed: loading ? null : _onPrimaryPressed,
            ),
            if (_mode == _LoginMode.phone &&
                _phoneStep == _PhoneStep.enterOtp) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: loading || _resendSeconds > 0
                    ? null
                    : () => _sendOtp(resend: true),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.wine,
                ),
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
              TextButton(
                onPressed: loading
                    ? null
                    : () => Navigator.pushReplacementNamed(
                        context,
                        AppRoutes.main,
                      ),
                style: TextButton.styleFrom(
                  foregroundColor: AppTheme.charcoal.withAlpha(160),
                ),
                child: const Text(
                  'Continue as guest',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  String get _primaryLabel {
    if (_mode == _LoginMode.email) return 'Sign in';
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        return 'Send OTP';
      case _PhoneStep.enterOtp:
        return 'Verify & sign in';
      case _PhoneStep.completeSignup:
        return 'Create account';
    }
  }

  VoidCallback get _onPrimaryPressed {
    if (_mode == _LoginMode.email) return _loginEmail;
    switch (_phoneStep) {
      case _PhoneStep.enterPhone:
        return () => _sendOtp();
      case _PhoneStep.enterOtp:
        return _verifyOtp;
      case _PhoneStep.completeSignup:
        return _completeSignup;
    }
  }

  List<Widget> _buildPhoneFields(bool loading, AuthProvider auth) {
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
