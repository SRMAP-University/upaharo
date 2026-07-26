import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/theme.dart';
import '../../data/models/app_settings.dart';

/// Support / delivery / store block matching website checkout info.
class SupportInfoCard extends StatelessWidget {
  const SupportInfoCard({
    super.key,
    required this.settings,
    this.showTitle = true,
  });

  final AppSettings settings;
  final bool showTitle;

  Future<void> _launch(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final phone = settings.supportPhone.trim();
    final email = settings.supportEmail.trim();
    final hours = settings.supportHours.trim();
    final message = settings.supportMessage.trim();
    final estimate = settings.deliveryEstimate.trim();
    final note = settings.deliveryNote.trim();
    final address = settings.storeAddress.trim();

    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.creamDeep,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.wine.withAlpha(30)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showTitle)
            const Text(
              'Support',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: AppTheme.ink,
              ),
            ),
          if (showTitle) const SizedBox(height: 10),
          if (message.isNotEmpty) ...[
            Text(message, style: const TextStyle(fontSize: 13, color: AppTheme.charcoal, height: 1.35)),
            const SizedBox(height: 12),
          ],
          if (hours.isNotEmpty)
            _InfoRow(icon: Icons.schedule, label: 'Hours', value: hours),
          if (phone.isNotEmpty)
            _InfoRow(
              icon: Icons.phone_outlined,
              label: 'Phone',
              value: phone,
              onTap: () => _launch(Uri(scheme: 'tel', path: phone)),
            ),
          if (email.isNotEmpty)
            _InfoRow(
              icon: Icons.email_outlined,
              label: 'Email',
              value: email,
              onTap: () => _launch(Uri(scheme: 'mailto', path: email)),
            ),
          if (address.isNotEmpty)
            _InfoRow(
              icon: Icons.storefront_outlined,
              label: 'Store',
              value: address,
              onTap: () {
                final query = Uri.encodeComponent(address);
                _launch(Uri.parse(
                  'https://www.google.com/maps/search/?api=1&query=$query',
                ));
              },
            ),
          if (estimate.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFA5D6A7)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.local_shipping_outlined, size: 18, color: Color(0xFF2E7D32)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      estimate,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF1B5E20),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (note.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              note,
              style: const TextStyle(fontSize: 12, color: AppTheme.charcoal, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: AppTheme.wine),
            const SizedBox(width: 8),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 13, color: AppTheme.ink, height: 1.35),
                  children: [
                    TextSpan(
                      text: '$label: ',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    TextSpan(
                      text: value,
                      style: TextStyle(
                        color: onTap != null ? AppTheme.wine : AppTheme.charcoal,
                        decoration: onTap != null ? TextDecoration.underline : null,
                        decorationColor: AppTheme.wine,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (onTap != null)
              const Icon(Icons.open_in_new, size: 14, color: AppTheme.charcoal),
          ],
        ),
      ),
    );
  }
}
