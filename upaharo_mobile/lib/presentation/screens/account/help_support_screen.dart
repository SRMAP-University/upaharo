import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/theme.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/support_info_card.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SettingsProvider>().load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    final loading = context.watch<SettingsProvider>().isLoading &&
        !context.watch<SettingsProvider>().isLoaded;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('Help & Support')),
      body: loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.wine))
          : RefreshIndicator(
              color: AppTheme.wine,
              onRefresh: () => context.read<SettingsProvider>().load(force: true),
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    'Need help with ${settings.siteName}?',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.ink,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Reach our team using the details below. Hours and contact info come from store settings.',
                    style: TextStyle(fontSize: 13, color: AppTheme.charcoal, height: 1.4),
                  ),
                  const SizedBox(height: 16),
                  SupportInfoCard(settings: settings),
                ],
              ),
            ),
    );
  }
}
