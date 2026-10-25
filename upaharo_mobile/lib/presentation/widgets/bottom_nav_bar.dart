import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/flavor.dart';
import '../../config/routes.dart';
import '../../config/theme.dart';
import '../providers/settings_provider.dart';
import '../providers/shell_tab_controller.dart';
import '../screens/main_shell.dart';

/// Docked bar: Home · Categories · Orders · Promo.
class BottomNavBar extends StatelessWidget {
  const BottomNavBar({super.key, required this.currentIndex});

  /// 0 Home · 1 Categories · 2 Orders · 3 Promo
  final int currentIndex;

  /// Menu height above the phone's home-gesture strip. The logo peeks above it.
  static const double height = 70;

  void _onTap(BuildContext context, int index) {
    final inShell = context.findAncestorWidgetOfExactType<MainShell>() != null;
    if (inShell) {
      if (index == currentIndex) return;
      context.read<ShellTabController>().goTo(index);
      return;
    }

    context.read<ShellTabController>().goTo(index);
    final navigator = Navigator.of(context);
    var foundShell = false;
    navigator.popUntil((route) {
      final name = route.settings.name;
      final isShell = name == AppRoutes.main || name == AppRoutes.home;
      if (isShell) foundShell = true;
      return isShell || route.isFirst;
    });
    if (!foundShell) {
      navigator.pushReplacementNamed(AppRoutes.main);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsProvider>().settings;
    final items = <_NavItem>[
      _NavItem(
        outline: Icons.cottage_outlined,
        filled: Icons.cottage_rounded,
        label: settings.navHomeLabel,
        assetIcon: FlavorConfig.isGrocery
            ? 'assets/branding/grooll_mark.png'
            : 'assets/branding/upaharo_mark.png',
        hideLabel: true,
        tintAsset: FlavorConfig.isGrocery,
      ),
      _NavItem(
        outline: Icons.local_florist_outlined,
        filled: Icons.local_florist_rounded,
        label: settings.navCategoriesLabel,
      ),
      const _NavItem(
        outline: Icons.receipt_long_outlined,
        filled: Icons.receipt_long_rounded,
        label: 'Orders',
      ),
      if (settings.showPromoTab)
        _NavItem(
          outline: Icons.local_offer_outlined,
          filled: Icons.local_offer_rounded,
          label: settings.promoOrbLabel.trim().isEmpty
              ? 'Promo'
              : settings.promoOrbLabel.trim(),
          orb: true,
        ),
    ];

    final home = items.first;
    final rest = items.sublist(1);
    final safe = MediaQuery.paddingOf(context).bottom;
    final onHomeTab =
        context.findAncestorWidgetOfExactType<MainShell>() != null &&
            currentIndex == 0;

    return Material(
      color: Colors.transparent,
      child: SizedBox(
        height: height + safe,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Fill the phone's home-gesture strip so the page does not show through.
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: safe,
              child: const ColoredBox(color: Colors.white),
            ),
            Positioned(
              left: 76,
              right: 0,
              bottom: safe,
              height: 56,
              child: _CurvedMenu(
                items: rest,
                startIndex: 1,
                currentIndex: currentIndex,
                onTap: (index) => _onTap(context, index),
              ),
            ),
            Positioned(
              left: 12,
              bottom: safe,
              child: _HomeFloat(
                item: home,
                selected: onHomeTab,
                onTap: () => _onTap(context, 0),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HomeFloat extends StatelessWidget {
  const _HomeFloat({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 54,
        height: 54,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(
            color: selected ? AppTheme.wine : Colors.white,
            width: 1.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.14),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 280),
          switchInCurve: Curves.easeOutCubic,
          switchOutCurve: Curves.easeInCubic,
          transitionBuilder: (child, animation) {
            return FadeTransition(
              opacity: animation,
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.86, end: 1).animate(animation),
                child: child,
              ),
            );
          },
          child: selected && item.assetIcon != null
              ? _NavAssetIcon(
                  key: const ValueKey('logo'),
                  item: item,
                  color: AppTheme.wine,
                  size: 34,
                )
              : Icon(
                  key: const ValueKey('home'),
                  Icons.home_rounded,
                  color: AppTheme.wine,
                  size: 24,
                ),
        ),
      ),
    );
  }
}

class _CurvedMenu extends StatelessWidget {
  const _CurvedMenu({
    required this.items,
    required this.startIndex,
    required this.currentIndex,
    required this.onTap,
  });

  final List<_NavItem> items;
  final int startIndex;
  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 56,
      width: double.infinity,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          const Positioned(
            left: -16,
            right: 0,
            top: -14,
            bottom: 0,
            child: CustomPaint(painter: _MenuTopShadowPainter()),
          ),
          const ClipPath(
            clipper: _LogoSideCurveClipper(),
            child: ColoredBox(
              color: Colors.white,
              child: SizedBox.expand(),
            ),
          ),
          Row(
          children: [
            for (var i = 0; i < items.length; i++)
              Expanded(
                child: items[i].orb
                    ? _PromoOrbTab(
                        item: items[i],
                        selected: currentIndex == startIndex + i,
                        onTap: () => onTap(startIndex + i),
                      )
                    : _NavTab(
                        item: items[i],
                        selected: currentIndex == startIndex + i,
                        onTap: () => onTap(startIndex + i),
                      ),
              ),
          ],
          ),
        ],
      ),
    );
  }
}

class _MenuTopShadowPainter extends CustomPainter {
  const _MenuTopShadowPainter();

  @override
  void paint(Canvas canvas, Size size) {
    const lift = 14.0;
    final bar = Size(size.width - 16, size.height - lift);
    final path = _LogoSideCurveClipper()
        .getClip(bar)
        .shift(const Offset(16, lift - 3));
    canvas.save();
    // Keep the blur on the top and the curved side. Cut it off along the bottom.
    canvas.clipRect(Rect.fromLTWH(0, 0, size.width, size.height - 3));
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.black.withValues(alpha: 0.16)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 7),
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _LogoSideCurveClipper extends CustomClipper<Path> {
  const _LogoSideCurveClipper();

  @override
  Path getClip(Size size) {
    const sweep = 40.0;
    return Path()
      ..moveTo(0, size.height)
      ..lineTo(0, sweep)
      ..quadraticBezierTo(0, 0, sweep, 0)
      ..lineTo(size.width, 0)
      ..lineTo(size.width, size.height)
      ..close();
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _NavItem {
  const _NavItem({
    required this.outline,
    required this.filled,
    required this.label,
    this.assetIcon,
    this.hideLabel = false,
    this.tintAsset = false,
    this.orb = false,
  });

  final IconData outline;
  final IconData filled;
  final String label;
  final String? assetIcon;
  final bool hideLabel;
  final bool tintAsset;
  final bool orb;
}

class _NavTab extends StatelessWidget {
  const _NavTab({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? AppTheme.wine : AppTheme.charcoal.withAlpha(170);

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (item.assetIcon != null)
            _NavAssetIcon(item: item, color: color)
          else
            Icon(
              selected ? item.filled : item.outline,
              color: color,
              size: 22,
            ),
          if (!item.hideLabel) ...[
            const SizedBox(height: 2),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 11,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: color,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _NavAssetIcon extends StatelessWidget {
  const _NavAssetIcon({
    super.key,
    required this.item,
    required this.color,
    this.size,
  });

  final _NavItem item;
  final Color color;
  final double? size;

  @override
  Widget build(BuildContext context) {
    final image = Image.asset(
      item.assetIcon!,
      width: size ?? (item.tintAsset ? 34 : 32),
      height: size ?? (item.tintAsset ? 22 : 32),
      fit: BoxFit.contain,
    );
    if (!item.tintAsset) return image;
    return ColorFiltered(
      colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
      child: image,
    );
  }
}

class _PromoOrbTab extends StatefulWidget {
  const _PromoOrbTab({
    required this.item,
    required this.selected,
    required this.onTap,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  State<_PromoOrbTab> createState() => _PromoOrbTabState();
}

class _PromoOrbTabState extends State<_PromoOrbTab>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.selected;
    final label = widget.item.label;

    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: _pulse,
            builder: (context, child) {
              final glow = 0.22 + (_pulse.value * 0.16);
              return Transform.scale(
                scale: selected ? 1.04 : 1 + (_pulse.value * 0.04),
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: selected
                          ? [
                              AppTheme.gold,
                              AppTheme.wine,
                            ]
                          : [
                              AppTheme.wine,
                              Color.lerp(AppTheme.wine, AppTheme.gold, 0.35)!,
                            ],
                    ),
                    border: Border.all(color: Colors.white, width: 1.6),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.wine.withValues(alpha: glow),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: child,
                ),
              );
            },
            child: Icon(
              selected ? widget.item.filled : widget.item.outline,
              color: Colors.white,
              size: 17,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: label.length > 8 ? 9 : 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.15,
              color: selected ? AppTheme.wine : AppTheme.wine.withAlpha(210),
            ),
          ),
        ],
      ),
    );
  }
}
