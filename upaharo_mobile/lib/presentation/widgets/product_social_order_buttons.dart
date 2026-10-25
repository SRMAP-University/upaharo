import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/utils/social_order_links.dart';
import '../../data/models/product.dart';
import '../providers/settings_provider.dart';

class ProductSocialOrderButtons extends StatelessWidget {
  const ProductSocialOrderButtons({
    super.key,
    required this.product,
    this.quantity = 1,
    this.compact = true,
  });

  final Product product;
  final int quantity;
  final bool compact;

  Future<void> _open(Uri uri) async {
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    final whatsapp = SocialOrderLinks.whatsAppOrderUri(
      phone: settings.supportPhone,
      productId: product.id,
      productName: product.name,
      price: product.finalPrice,
      quantity: quantity,
    );
    final instagram = SocialOrderLinks.instagramOrderUri(
      settings.supportInstagram.trim().isEmpty
          ? 'upaharo'
          : settings.supportInstagram,
    );

    if (whatsapp == null && instagram == null) return const SizedBox.shrink();

    final height = compact ? 30.0 : 40.0;
    final fontSize = compact ? 10.0 : 13.0;

    Widget pill({
      required String label,
      required Color color,
      required Gradient? gradient,
      required VoidCallback onTap,
      required IconData icon,
    }) {
      return Expanded(
        child: Material(
          color: gradient == null ? color : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(999),
            child: Ink(
              height: height,
              decoration: BoxDecoration(
                color: gradient == null ? color : null,
                gradient: gradient,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(icon, size: compact ? 13 : 16, color: Colors.white),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: fontSize,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Row(
      children: [
        if (whatsapp != null)
          pill(
            label: compact ? 'WhatsApp' : 'Order on WhatsApp',
            color: const Color(0xFF25D366),
            gradient: null,
            icon: Icons.chat,
            onTap: () => _open(whatsapp),
          ),
        if (whatsapp != null && instagram != null) const SizedBox(width: 6),
        if (instagram != null)
          pill(
            label: compact ? 'Instagram' : 'Order on Instagram',
            color: const Color(0xFFEE2A7B),
            gradient: const LinearGradient(
              colors: [Color(0xFFF9CE34), Color(0xFFEE2A7B), Color(0xFF6228D7)],
            ),
            icon: Icons.camera_alt_outlined,
            onTap: () => _open(instagram),
          ),
      ],
    );
  }
}
