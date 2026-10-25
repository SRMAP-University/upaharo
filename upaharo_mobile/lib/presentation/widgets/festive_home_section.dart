import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../data/models/product.dart';
import '../../data/repositories/festive_repository.dart';
import '../../runtime/web_feature.dart';
import '../providers/cart_provider.dart';
import 'product_card.dart';

/// Home: Bhai Tika card with the countdown, then Tihar picks ordered by the
/// shopper's searches and views. Hidden when festival mode is off.
class FestiveHomeSection extends StatefulWidget {
  const FestiveHomeSection({super.key});

  @override
  State<FestiveHomeSection> createState() => _FestiveHomeSectionState();
}

class _FestiveHomeSectionState extends State<FestiveHomeSection> {
  static const _maroon = Color(0xFF5D1D34);
  static const _maroonLight = Color(0xFF9B2C4F);
  static const _maroonDark = Color(0xFF3A0F20);
  static const _amber = Color(0xFFFBBF24);

  FestiveCollection? _collection;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final collection = await const FestiveRepository().getCollection();
      if (mounted) setState(() => _collection = collection);
    } catch (_) {
      // Leave the section out if the collection cannot load.
    }
  }

  void _openCollection() {
    pushWebFeaturePage('/bhai-tika', title: 'Bhai Tika');
  }

  void _openProduct(Product product) {
    Navigator.of(context).pushNamed(AppRoutes.productDetail, arguments: product.id);
  }

  String? get _countdownText {
    final days = _collection?.daysLeft;
    if (days == null) return null;
    if (days == 0) return 'Bhai Tika is today';
    if (days == 1) return '1 day to go';
    return '$days days to go';
  }

  @override
  Widget build(BuildContext context) {
    final collection = _collection;
    if (collection == null || !collection.festivalMode) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCard(),
          if (collection.forYou.isNotEmpty) ...[
            const SizedBox(height: 18),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        collection.personalised ? 'PICKED FOR YOU' : 'TIHAR PICKS',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.6,
                          color: Color(0xFFB45309),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        collection.personalised ? 'Your Tihar & Bhai Tika picks' : 'Tihar & Bhai Tika gifts',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
                TextButton(onPressed: _openCollection, child: const Text('See all')),
              ],
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 268,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: collection.forYou.length,
                separatorBuilder: (_, _) => const SizedBox(width: 12),
                itemBuilder: (context, index) {
                  final product = collection.forYou[index];
                  return ProductCard(
                    product: product,
                    width: 158,
                    onTap: () => _openProduct(product),
                    onAddToCart: () => context.read<CartProvider>().addProduct(product),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildCard() {
    final countdown = _countdownText;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _openCollection,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            gradient: const RadialGradient(
              center: Alignment(-0.6, -1),
              radius: 1.6,
              colors: [_maroonLight, _maroon, _maroonDark],
              stops: [0, 0.55, 1],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 16, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // A string of marigolds along the top edge.
                const Text(
                  '🌼 🏵️ 🌼 🏵️ 🌼 🏵️ 🌼 🏵️ 🌼',
                  maxLines: 1,
                  overflow: TextOverflow.clip,
                  style: TextStyle(fontSize: 14, letterSpacing: 2),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Text(
                      'TIHAR SPECIAL',
                      style: TextStyle(
                        color: Color(0xFFFDE68A),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.8,
                      ),
                    ),
                    if (countdown != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
                        decoration: BoxDecoration(color: _amber, borderRadius: BorderRadius.circular(99)),
                        child: Text(
                          countdown,
                          style: const TextStyle(color: _maroonDark, fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 6),
                const Wrap(
                  crossAxisAlignment: WrapCrossAlignment.end,
                  spacing: 10,
                  children: [
                    Text(
                      'Bhai Tika',
                      style: TextStyle(
                        color: Color(0xFFFDE68A),
                        fontSize: 34,
                        height: 1,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'भाइटीका',
                      style: TextStyle(color: _amber, fontSize: 20, fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                const Text(
                  'Tika sets, hampers and gifts for your brother or sister.',
                  style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 13.5, height: 1.4),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      decoration: BoxDecoration(color: _amber, borderRadius: BorderRadius.circular(12)),
                      child: const Text(
                        'Explore  →',
                        style: TextStyle(color: _maroonDark, fontWeight: FontWeight.w700, fontSize: 14),
                      ),
                    ),
                    const Spacer(),
                    const Text('🪔 🪔 🪔', style: TextStyle(fontSize: 22)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
