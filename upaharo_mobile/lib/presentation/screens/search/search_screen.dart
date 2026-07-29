import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/models/product.dart';
import '../../../data/repositories/ai_repository.dart';
import '../../../data/repositories/product_repository.dart';
import '../../providers/cart_provider.dart';
import '../../providers/settings_provider.dart';
import '../../widgets/bottom_nav_bar.dart';
import '../../widgets/mini_cart_bar.dart';
import '../../widgets/product_card.dart';
import '../../widgets/product_quick_sheet.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key, this.showBottomNav = true});

  final bool showBottomNav;

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  final _aiRepo = const AiRepository();
  final _productRepo = const ProductRepository();
  Timer? _debounce;

  List<Product> _products = const [];
  String? _interpretation;
  String _source = 'keyword';
  bool _loading = false;
  String? _error;
  int _requestId = 0;

  static const _suggestions = [
    'Flowers under 2000',
    'Birthday cake',
    'Gift for mom',
    'Plants around 1500',
    'Anniversary roses',
  ];

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final q = value.trim();
    if (q.isEmpty) {
      setState(() {
        _products = const [];
        _interpretation = null;
        _error = null;
        _loading = false;
      });
      return;
    }

    _debounce = Timer(const Duration(milliseconds: 450), () {
      _runSearch(q);
    });
  }

  Future<void> _runSearch(String query) async {
    final id = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final aiEnabled = context
          .read<SettingsProvider>()
          .settings
          .featureAiAssistant;
      if (aiEnabled) {
        final result = await _aiRepo.searchProducts(query);
        if (!mounted || id != _requestId) return;
        setState(() {
          _products = result.products;
          _interpretation = result.interpretation;
          _source = result.source;
          _loading = false;
        });
      } else {
        final products = await _productRepo.getProducts(
          search: query,
          limit: 60,
        );
        if (!mounted || id != _requestId) return;
        setState(() {
          _products = products;
          _interpretation = null;
          _source = 'keyword';
          _loading = false;
        });
      }
    } catch (e) {
      if (!mounted || id != _requestId) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : 'Search failed. Try again.';
        _products = const [];
      });
    }
  }

  void _applySuggestion(String text) {
    _controller.text = text;
    _controller.selection = TextSelection.collapsed(offset: text.length);
    _runSearch(text);
  }

  @override
  Widget build(BuildContext context) {
    final cartPad = context.watch<CartProvider>().totalItems > 0
        ? MiniCartBar.height + 8
        : 0.0;
    final aiEnabled = context
        .watch<SettingsProvider>()
        .settings
        .featureAiAssistant;
    final query = _controller.text.trim();

    return Scaffold(
      extendBody: true,
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        automaticallyImplyLeading: widget.showBottomNav,
        leading: widget.showBottomNav
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  if (Navigator.of(context).canPop()) {
                    Navigator.of(context).pop();
                  } else {
                    Navigator.of(context).pushReplacementNamed(AppRoutes.main);
                  }
                },
              )
            : null,
        title: TextField(
          controller: _controller,
          autofocus: widget.showBottomNav,
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: aiEnabled
                ? 'Try “flowers under 2000”…'
                : 'Search products',
            border: InputBorder.none,
          ),
          onChanged: _onQueryChanged,
          onSubmitted: (q) {
            if (q.trim().isEmpty) return;
            _debounce?.cancel();
            _runSearch(q.trim());
          },
        ),
        actions: [
          if (query.isNotEmpty)
            IconButton(
              tooltip: 'Clear',
              icon: const Icon(Icons.close),
              onPressed: () {
                _debounce?.cancel();
                _controller.clear();
                setState(() {
                  _products = const [];
                  _interpretation = null;
                  _error = null;
                  _loading = false;
                });
              },
            ),
        ],
      ),
      body: _buildBody(cartPad, aiEnabled),
      bottomNavigationBar: widget.showBottomNav
          ? const BottomNavBar(currentIndex: 0)
          : null,
    );
  }

  Widget _buildBody(double cartPad, bool aiEnabled) {
    final query = _controller.text.trim();

    if (query.isEmpty) {
      return ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          if (aiEnabled) ...[_aiHintCard(), const SizedBox(height: 16)],
          Text(
            aiEnabled ? 'Try asking' : 'Popular searches',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppTheme.ink,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _suggestions.map((s) {
              return ActionChip(
                label: Text(s),
                backgroundColor: Colors.white,
                side: BorderSide(color: AppTheme.wine.withAlpha(40)),
                onPressed: () => _applySuggestion(s),
              );
            }).toList(),
          ),
          SizedBox(height: 110 + cartPad),
        ],
      );
    }

    if (_loading && _products.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppTheme.wine),
            const SizedBox(height: 12),
            Text(
              aiEnabled ? 'AI is finding gifts…' : 'Finding products…',
              style: TextStyle(color: AppTheme.charcoal),
            ),
          ],
        ),
      );
    }

    if (_error != null && _products.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(_error!, textAlign: TextAlign.center),
        ),
      );
    }

    if (_products.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            aiEnabled
                ? 'No gifts matched. Try a different budget or gift type.'
                : 'No products matched. Try a different search.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppTheme.charcoal),
          ),
        ),
      );
    }

    return CustomScrollView(
      slivers: [
        if (_interpretation != null || _source == 'ai')
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, size: 16, color: AppTheme.wine),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      _interpretation ?? 'AI search results',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.charcoal,
                      ),
                    ),
                  ),
                  if (_loading)
                    SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppTheme.wine,
                      ),
                    ),
                ],
              ),
            ),
          ),
        SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 8, 16, 110 + cartPad),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.72,
            ),
            delegate: SliverChildBuilderDelegate((context, index) {
              final product = _products[index];
              return ProductCard(
                product: product,
                onTap: () => showProductQuickSheet(context, product: product),
              );
            }, childCount: _products.length),
          ),
        ),
      ],
    );
  }

  Widget _aiHintCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.wine.withAlpha(35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.auto_awesome, color: AppTheme.wine, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'AI search',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Search in plain language — budget, occasion, or who it’s for.',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    color: AppTheme.charcoal,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
