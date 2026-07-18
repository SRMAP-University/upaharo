import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/theme.dart';
import '../../providers/settings_provider.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

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
                  child: const Icon(Icons.local_florist, size: 36, color: AppTheme.wine),
                ),
                const SizedBox(height: 12),
                Text(
                  settings.siteName,
                  style: const TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Version 1.0.0',
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
            title: 'Map defaults',
            body:
                'Lat ${settings.mapLatitude.toStringAsFixed(4)}, Lng ${settings.mapLongitude.toStringAsFixed(4)}',
          ),
          _InfoTile(
            title: 'Recommendations',
            body:
                '${settings.homepageRecommendationTitle} · ${settings.homepageRecommendationMode}',
          ),
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.black12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: AppTheme.wine,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            style: const TextStyle(fontSize: 14, color: AppTheme.ink, height: 1.4),
          ),
        ],
      ),
    );
  }
}
