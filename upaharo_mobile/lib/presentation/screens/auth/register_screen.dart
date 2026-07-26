import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../widgets/auth_scaffold.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscure = true;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _register() async {
    FocusScope.of(context).unfocus();
    final success = await context.read<AuthProvider>().signup(
          name: _nameController.text.trim(),
          email: _emailController.text.trim(),
          phone: _phoneController.text.trim(),
          password: _passwordController.text,
        );

    if (success && mounted) {
      Navigator.pushReplacementNamed(context, AppRoutes.main);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final loading = auth.status == AuthStatus.loading;

    return AuthScaffold(
      showBack: true,
      brandLine: 'Upaharo',
      headline: 'Join the celebration',
      subtitle: 'Create an account to track orders & save your favourites',
      child: AutofillGroup(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Soft perk strip — unique to register
            Container(
              margin: EdgeInsets.only(bottom: 18),
              padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                gradient: LinearGradient(
                  colors: [
                    AppTheme.wine.withAlpha(14),
                    AppTheme.gold.withAlpha(18),
                  ],
                ),
                border: Border.all(color: AppTheme.wine.withAlpha(22)),
              ),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withAlpha(220),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      Icons.card_giftcard_rounded,
                      size: 18,
                      color: AppTheme.wine,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Order faster, save addresses & get gift ideas for every occasion.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.35,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.charcoal.withAlpha(200),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            AuthField(
              controller: _nameController,
              label: 'Full name',
              icon: Icons.person_outline_rounded,
              keyboardType: TextInputType.name,
              autofillHints: const [AutofillHints.name],
            ),
            const SizedBox(height: 12),
            AuthField(
              controller: _emailController,
              label: 'Email',
              icon: Icons.mail_outline_rounded,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
            ),
            const SizedBox(height: 12),
            AuthField(
              controller: _phoneController,
              label: 'Phone',
              icon: Icons.phone_outlined,
              keyboardType: TextInputType.phone,
              autofillHints: const [AutofillHints.telephoneNumber],
            ),
            const SizedBox(height: 12),
            AuthField(
              controller: _passwordController,
              label: 'Password',
              icon: Icons.lock_outline_rounded,
              obscureText: _obscure,
              textInputAction: TextInputAction.done,
              autofillHints: const [AutofillHints.newPassword],
              onToggleObscure: () => setState(() => _obscure = !_obscure),
            ),
            const SizedBox(height: 8),
            Text(
              'Use at least 6 characters.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 11,
                color: AppTheme.charcoal.withAlpha(140),
              ),
            ),
            const SizedBox(height: 18),
            if (auth.errorMessage != null) AuthErrorBanner(message: auth.errorMessage!),
            AuthPrimaryButton(
              label: 'Create account',
              loading: loading,
              onPressed: _register,
            ),
            const SizedBox(height: 12),
            AuthLinkRow(
              prefix: 'Already have an account? ',
              action: 'Sign in',
              onPressed: loading ? null : () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }
}
