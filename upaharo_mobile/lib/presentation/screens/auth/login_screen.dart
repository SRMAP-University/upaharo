import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/flavor.dart';
import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/wishlist_provider.dart';
import '../../widgets/auth_scaffold.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    FocusScope.of(context).unfocus();
    final success = await context.read<AuthProvider>().login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    if (success && mounted) {
      unawaited(context.read<WishlistProvider>().load(force: true));
      Navigator.pushReplacementNamed(context, AppRoutes.main);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.status == AuthStatus.loading;

    return AuthScaffold(
      brandLine: FlavorConfig.appName,
      headline: 'Welcome back',
      subtitle: FlavorConfig.isGrocery
          ? 'Sign in to shop fresh essentials and everyday needs.'
          : 'Sign in to send flowers, cakes and thoughtful gifts.',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
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
            const SizedBox(height: 20),
            if (auth.errorMessage != null)
              AuthErrorBanner(message: auth.errorMessage!),
            AuthPrimaryButton(
              label: 'Sign in',
              loading: loading,
              onPressed: _login,
            ),
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
                  : () =>
                        Navigator.pushReplacementNamed(context, AppRoutes.main),
              style: TextButton.styleFrom(
                foregroundColor: AppTheme.charcoal.withAlpha(160),
              ),
              child: const Text(
                'Continue as guest',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
