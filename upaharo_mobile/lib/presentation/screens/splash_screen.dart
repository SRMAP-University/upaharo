import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/auth_provider.dart';
import '../providers/catalog_provider.dart';
import '../providers/location_provider.dart';
import '../providers/settings_provider.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String _statusMessage = 'Loading...';

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    if (!mounted) return;

    setState(() => _statusMessage = 'Restoring session...');

    final auth = context.read<AuthProvider>();
    final location = context.read<LocationProvider>();
    final settings = context.read<SettingsProvider>();
    final catalog = context.read<CatalogProvider>();

    // Restore auth first so we never bounce logged-in users to welcome.
    await auth.checkAuth();
    if (!mounted) return;

    setState(() => _statusMessage = 'Getting things ready...');

    // Warm cache in parallel — UI can show stale data instantly after this.
    await Future.wait([
      location.loadSavedLocation().catchError((_) {}),
      location.detectLocation().catchError((_) => false),
      settings.load().catchError((_) {}),
      catalog.load().catchError((_) {}),
    ]);

    if (!mounted) return;

    final target = auth.isAuthenticated ? AppRoutes.main : AppRoutes.welcome;
    Navigator.pushReplacementNamed(context, target);
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              settings.siteName,
              style: const TextStyle(
                fontSize: 42,
                fontWeight: FontWeight.bold,
                color: AppTheme.wine,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              settings.announcementText.trim().isEmpty
                  ? 'Gifts & Flowers'
                  : settings.announcementText,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                color: AppTheme.charcoal,
              ),
            ),
            const SizedBox(height: 32),
            const CircularProgressIndicator(color: AppTheme.wine),
            const SizedBox(height: 16),
            Text(
              _statusMessage,
              style: const TextStyle(fontSize: 13, color: AppTheme.charcoal),
            ),
          ],
        ),
      ),
    );
  }
}
