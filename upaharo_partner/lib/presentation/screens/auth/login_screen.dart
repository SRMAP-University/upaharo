import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../../core/theme/app_theme.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  bool _otpSent = false;
  /// After trusted login fails, show explicit Send OTP (never auto-SMS).
  bool _needOtp = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final remembered = context.read<AuthProvider>().rememberedPhone;
      if (remembered != null && remembered.isNotEmpty && _phone.text.isEmpty) {
        _phone.text = remembered.replaceFirst(RegExp(r'^\+?977'), '');
        if (_phone.text.length > 10) {
          _phone.text = _phone.text.substring(_phone.text.length - 10);
        }
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    final auth = context.read<AuthProvider>();
    final phone = _phone.text.trim();
    if (phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Enter a valid 10-digit mobile number')),
      );
      return;
    }

    // Prefer trusted device — never auto-send SMS when trust exists.
    final hasTrust = await auth.hasTrustedDeviceToken();
    if (hasTrust) {
      final ok = await auth.tryTrustedLogin(phone);
      if (ok) return;
      if (!mounted) return;
      setState(() {
        _needOtp = true;
        _otpSent = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(auth.error ?? 'Verify with OTP this time'),
        ),
      );
      return;
    }

    await _sendOtp();
  }

  Future<void> _sendOtp() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.sendOtp(_phone.text.trim());
      setState(() {
        _otpSent = true;
        _needOtp = true;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('OTP sent')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Failed to send OTP')),
        );
      }
    }
  }

  Future<void> _verify() async {
    final auth = context.read<AuthProvider>();
    try {
      await auth.verifyOtp(_phone.text.trim(), _otp.text.trim());
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Invalid OTP')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final showOtpField = _otpSent;
    final primaryAction = showOtpField
        ? _verify
        : (_needOtp ? _sendOtp : _continue);
    final primaryLabel = showOtpField
        ? 'Verify & continue'
        : (_needOtp ? 'Send OTP' : 'Continue');

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
      ),
      child: Scaffold(
        backgroundColor: AppTheme.pageBg,
        body: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.asset(
                      'assets/branding/app_icon.png',
                      width: 72,
                      height: 72,
                      fit: BoxFit.cover,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Grooll Partner',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppTheme.ink,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Merchant & delivery · Grooll & Upaharo',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppTheme.muted, fontSize: 12),
                ),
                const SizedBox(height: 24),
                Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 14, 14, 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Login with phone',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppTheme.ink,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Trusted devices skip OTP after the first login',
                          style: TextStyle(fontSize: 11, color: AppTheme.muted),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _phone,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                            LengthLimitingTextInputFormatter(10),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Mobile number',
                            hintText: '98xxxxxxxx',
                            prefixText: '+977 ',
                          ),
                        ),
                        if (showOtpField) ...[
                          const SizedBox(height: 8),
                          TextField(
                            controller: _otp,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(6),
                            ],
                            decoration: const InputDecoration(
                              labelText: '6-digit OTP',
                            ),
                          ),
                        ],
                        const SizedBox(height: 14),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.groollGreen,
                          ),
                          onPressed: auth.busy ? null : primaryAction,
                          child: auth.busy
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(primaryLabel),
                        ),
                        if (showOtpField)
                          TextButton(
                            onPressed: auth.busy ? null : _sendOtp,
                            child: const Text('Resend OTP'),
                          )
                        else if (!_needOtp)
                          TextButton(
                            onPressed: auth.busy
                                ? null
                                : () {
                                    setState(() => _needOtp = true);
                                  },
                            child: const Text('Use OTP instead'),
                          ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
