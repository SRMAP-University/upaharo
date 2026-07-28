import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../config/theme.dart';
import '../../providers/settings_provider.dart';

class AboutScreen extends StatefulWidget {
  const AboutScreen({super.key});

  @override
  State<AboutScreen> createState() => _AboutScreenState();
}

class _AboutScreenState extends State<AboutScreen> {
  String _version = '…';

  @override
  void initState() {
    super.initState();
    PackageInfo.fromPlatform().then((info) {
      if (!mounted) return;
      setState(() => _version = '${info.version}+${info.buildNumber}');
    }).catchError((_) {
      if (mounted) setState(() => _version = '1.0.0');
    });
  }

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: const Text('About')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Center(
            child: Column(
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppTheme.wine.withAlpha(20),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.local_florist, size: 36, color: AppTheme.wine),
                ),
                const SizedBox(height: 12),
                Text(
                  settings.siteName,
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Version $_version',
                  style: TextStyle(fontSize: 13, color: AppTheme.charcoal),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          if (settings.announcementText.trim().isNotEmpty)
            _InfoTile(
              title: 'Announcement',
              body: settings.announcementText,
            ),
          if (settings.deliveryEstimate.trim().isNotEmpty)
            _InfoTile(
              title: 'Delivery',
              body: settings.deliveryEstimate,
            ),
          if (settings.deliveryNote.trim().isNotEmpty)
            _InfoTile(
              title: 'Delivery note',
              body: settings.deliveryNote,
            ),
          if (settings.storeAddress.trim().isNotEmpty)
            _InfoTile(
              title: 'Store address',
              body: settings.storeAddress,
            ),
          _InfoTile(
            title: 'Legal',
            body: 'Privacy Policy · Terms of Service',
            onTap: () => _open('https://www.upaharo.com/privacy'),
          ),
          TextButton(
            onPressed: () => _open('https://www.upaharo.com/terms'),
            child: const Text('Open Terms of Service'),
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.title, required this.body, this.onTap});

  final String title;
  final String body;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w500,
                    color: AppTheme.wine,
                  ),
                ),
                const SizedBox(height: 4),
                Text(body, style: const TextStyle(height: 1.35)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
