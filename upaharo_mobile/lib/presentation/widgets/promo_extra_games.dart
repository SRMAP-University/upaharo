import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../config/routes.dart';
import '../../config/theme.dart';
import '../../core/network/api_exception.dart';
import '../../data/repositories/promo_game_repository.dart';
import '../providers/auth_provider.dart';
import '../providers/coupon_provider.dart';

/// Scratch-to-reveal daily % coupon.
class ScratchCardGame extends StatefulWidget {
  const ScratchCardGame({super.key});

  @override
  State<ScratchCardGame> createState() => _ScratchCardGameState();
}

class _ScratchCardGameState extends State<ScratchCardGame> {
  static const _game = 'scratch';
  final _repo = const PromoGameRepository();

  bool _loading = true;
  bool _playing = false;
  bool _canPlay = false;
  bool _revealed = false;
  int _percent = 0;
  String? _code;
  String? _error;
  double _scratchProgress = 0;
  final _scratched = <Offset>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      setState(() {
        _loading = false;
        _canPlay = true;
      });
      return;
    }
    try {
      final status = await _repo.getStatus(_game);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canPlay = status.canPlay;
        _percent = status.percent;
        _code = status.code;
        _revealed = !status.canPlay && status.percent > 0;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : 'Could not load game';
      });
    }
  }

  Future<void> _claim() async {
    if (_playing) return;
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      Navigator.pushNamed(context, AppRoutes.login);
      return;
    }
    setState(() {
      _playing = true;
      _error = null;
    });
    try {
      final result = await _repo.play(_game);
      if (!mounted) return;
      setState(() {
        _playing = false;
        _canPlay = false;
        _revealed = true;
        _percent = result.percent;
        _code = result.code;
        _scratchProgress = 1;
      });
      final code = result.code;
      if (code != null && code.isNotEmpty) {
        await context.read<CouponProvider>().applyCode(code);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('You won ${result.percent}% off! Code applied.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _playing = false;
        _error = e is ApiException ? e.message : 'Play failed';
      });
    }
  }

  void _onScratch(Offset local) {
    if (!_canPlay || _revealed || _playing) return;
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      Navigator.pushNamed(context, AppRoutes.login);
      return;
    }
    _scratched.add(Offset(
      (local.dx / 20).floorToDouble(),
      (local.dy / 20).floorToDouble(),
    ));
    final progress = (_scratched.length / 28).clamp(0.0, 1.0);
    setState(() => _scratchProgress = progress);
    if (progress >= 0.45) {
      _claim();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return _PromoGameShell(
      title: 'Scratch & Win',
      subtitle: 'Scratch the card once a day for up to 30% off',
      icon: Icons.brush_outlined,
      child: Column(
        children: [
          AspectRatio(
            aspectRatio: 1.6,
            child: LayoutBuilder(
              builder: (context, constraints) {
                return GestureDetector(
                  onPanUpdate: (d) => _onScratch(d.localPosition),
                  onTapDown: (d) => _onScratch(d.localPosition),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppTheme.wine,
                                AppTheme.gold.withValues(alpha: 0.85),
                              ],
                            ),
                          ),
                          child: Center(
                            child: _loading || _playing
                                ? const SizedBox(
                                    width: 28,
                                    height: 28,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2.4,
                                      color: Colors.white,
                                    ),
                                  )
                                : Text(
                                    _revealed || !_canPlay
                                        ? '$_percent% OFF'
                                        : '?',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 36,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                        ),
                        if (_canPlay && !_revealed)
                          Opacity(
                            opacity: (1 - _scratchProgress).clamp(0.15, 1),
                            child: CustomPaint(
                              painter: _ScratchFoilPainter(progress: _scratchProgress),
                              child: const SizedBox.expand(),
                            ),
                          ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          if (_code != null && _code!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Today’s code: $_code',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: AppTheme.wine,
                fontSize: 13,
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: (_loading || _playing || (!_canPlay && auth.isAuthenticated))
                  ? null
                  : () {
                      if (!auth.isAuthenticated) {
                        Navigator.pushNamed(context, AppRoutes.login);
                        return;
                      }
                      if (_canPlay && _scratchProgress < 0.45) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Scratch the foil to reveal your prize')),
                        );
                      }
                    },
              child: Text(
                !auth.isAuthenticated
                    ? 'Login to play'
                    : _canPlay
                        ? 'Scratch to reveal'
                        : 'Come back tomorrow',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScratchFoilPainter extends CustomPainter {
  _ScratchFoilPainter({required this.progress});
  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          const Color(0xFFB0BEC5),
          const Color(0xFFECEFF1),
          const Color(0xFF90A4AE),
        ],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ).createShader(Offset.zero & size);
    canvas.drawRect(Offset.zero & size, paint);
    final sparkle = Paint()..color = Colors.white.withValues(alpha: 0.35);
    for (var i = 0; i < 18; i++) {
      final x = (i * 47 + progress * 30) % size.width;
      final y = (i * 73) % size.height;
      canvas.drawCircle(Offset(x, y), 2.5, sparkle);
    }
    final tp = TextPainter(
      text: TextSpan(
        text: 'SCRATCH HERE',
        style: TextStyle(
          color: Colors.black.withValues(alpha: 0.45),
          fontWeight: FontWeight.w800,
          fontSize: 16,
          letterSpacing: 1.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(
      canvas,
      Offset((size.width - tp.width) / 2, (size.height - tp.height) / 2),
    );
  }

  @override
  bool shouldRepaint(covariant _ScratchFoilPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

/// Flip tiles to find a matching pair, then claim today's coupon.
class FlipMatchGame extends StatefulWidget {
  const FlipMatchGame({super.key});

  @override
  State<FlipMatchGame> createState() => _FlipMatchGameState();
}

class _FlipMatchGameState extends State<FlipMatchGame> {
  static const _game = 'flip';
  final _repo = const PromoGameRepository();

  bool _loading = true;
  bool _playing = false;
  bool _canPlay = false;
  int _percent = 0;
  String? _code;
  String? _error;

  late List<_FlipTile> _tiles;
  int? _first;
  bool _locked = false;
  bool _won = false;

  static const _icons = [
    Icons.local_cafe_outlined,
    Icons.cake_outlined,
    Icons.card_giftcard_outlined,
    Icons.favorite_outline,
  ];

  @override
  void initState() {
    super.initState();
    _resetBoard();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _resetBoard() {
    final values = <int>[0, 0, 1, 1, 2, 2];
    values.shuffle(math.Random());
    _tiles = [
      for (var i = 0; i < values.length; i++)
        _FlipTile(id: i, pair: values[i], faceUp: false, matched: false),
    ];
    _first = null;
    _locked = false;
    _won = false;
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      setState(() {
        _loading = false;
        _canPlay = true;
      });
      return;
    }
    try {
      final status = await _repo.getStatus(_game);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canPlay = status.canPlay;
        _percent = status.percent;
        _code = status.code;
        _won = !status.canPlay && status.percent > 0;
        if (_won) {
          for (final t in _tiles) {
            t.faceUp = true;
            t.matched = true;
          }
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : 'Could not load game';
      });
    }
  }

  Future<void> _claim() async {
    if (_playing || !_canPlay) return;
    setState(() => _playing = true);
    try {
      final result = await _repo.play(_game);
      if (!mounted) return;
      setState(() {
        _playing = false;
        _canPlay = false;
        _percent = result.percent;
        _code = result.code;
        _won = true;
      });
      final code = result.code;
      if (code != null && code.isNotEmpty) {
        await context.read<CouponProvider>().applyCode(code);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Match! ${result.percent}% off applied.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _playing = false;
        _error = e is ApiException ? e.message : 'Play failed';
      });
    }
  }

  void _tapTile(int index) {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      Navigator.pushNamed(context, AppRoutes.login);
      return;
    }
    if (!_canPlay || _locked || _won || _playing) return;
    final tile = _tiles[index];
    if (tile.faceUp || tile.matched) return;

    setState(() => tile.faceUp = true);
    if (_first == null) {
      _first = index;
      return;
    }
    final a = _first!;
    _first = null;
    if (_tiles[a].pair == tile.pair) {
      setState(() {
        _tiles[a].matched = true;
        tile.matched = true;
      });
      if (_tiles.every((t) => t.matched)) {
        _claim();
      }
    } else {
      _locked = true;
      Future.delayed(const Duration(milliseconds: 650), () {
        if (!mounted) return;
        setState(() {
          _tiles[a].faceUp = false;
          tile.faceUp = false;
          _locked = false;
        });
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return _PromoGameShell(
      title: 'Flip Match',
      subtitle: 'Match all pairs to unlock today’s coupon',
      icon: Icons.grid_view_rounded,
      child: Column(
        children: [
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(strokeWidth: 2.4),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _tiles.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3,
                mainAxisSpacing: 8,
                crossAxisSpacing: 8,
                childAspectRatio: 1,
              ),
              itemBuilder: (context, i) {
                final tile = _tiles[i];
                return Material(
                  color: tile.matched || tile.faceUp
                      ? AppTheme.wine.withValues(alpha: 0.12)
                      : AppTheme.creamDeep,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _tapTile(i),
                    child: Center(
                      child: tile.faceUp || tile.matched
                          ? Icon(_icons[tile.pair], color: AppTheme.wine, size: 28)
                          : Text(
                              '?',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.charcoal.withValues(alpha: 0.4),
                              ),
                            ),
                    ),
                  ),
                );
              },
            ),
          if (_code != null && _code!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Today’s code: $_code · $_percent% off',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: AppTheme.wine,
                fontSize: 13,
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: !auth.isAuthenticated
                  ? () => Navigator.pushNamed(context, AppRoutes.login)
                  : (_canPlay && !_won
                      ? () {
                          setState(_resetBoard);
                        }
                      : null),
              child: Text(
                !auth.isAuthenticated
                    ? 'Login to play'
                    : _canPlay
                        ? (_playing ? 'Claiming…' : 'Reset board')
                        : 'Come back tomorrow',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FlipTile {
  _FlipTile({
    required this.id,
    required this.pair,
    required this.faceUp,
    required this.matched,
  });
  final int id;
  final int pair;
  bool faceUp;
  bool matched;
}

/// Pick one of three mystery doors for a daily coupon.
class LuckyPickGame extends StatefulWidget {
  const LuckyPickGame({super.key});

  @override
  State<LuckyPickGame> createState() => _LuckyPickGameState();
}

class _LuckyPickGameState extends State<LuckyPickGame> {
  static const _game = 'lucky';
  final _repo = const PromoGameRepository();

  bool _loading = true;
  bool _playing = false;
  bool _canPlay = false;
  int _percent = 0;
  String? _code;
  String? _error;
  int? _picked;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      setState(() {
        _loading = false;
        _canPlay = true;
      });
      return;
    }
    try {
      final status = await _repo.getStatus(_game);
      if (!mounted) return;
      setState(() {
        _loading = false;
        _canPlay = status.canPlay;
        _percent = status.percent;
        _code = status.code;
        if (!status.canPlay) _picked = 1;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e is ApiException ? e.message : 'Could not load game';
      });
    }
  }

  Future<void> _pick(int index) async {
    final auth = context.read<AuthProvider>();
    if (!auth.isAuthenticated) {
      Navigator.pushNamed(context, AppRoutes.login);
      return;
    }
    if (!_canPlay || _playing) return;
    setState(() {
      _playing = true;
      _picked = index;
      _error = null;
    });
    try {
      final result = await _repo.play(_game);
      if (!mounted) return;
      setState(() {
        _playing = false;
        _canPlay = false;
        _percent = result.percent;
        _code = result.code;
      });
      final code = result.code;
      if (code != null && code.isNotEmpty) {
        await context.read<CouponProvider>().applyCode(code);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lucky! ${result.percent}% off applied.')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _playing = false;
        _picked = null;
        _error = e is ApiException ? e.message : 'Play failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return _PromoGameShell(
      title: 'Lucky Pick',
      subtitle: 'Open one door once a day — every door wins something',
      icon: Icons.meeting_room_outlined,
      child: Column(
        children: [
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(24),
              child: CircularProgressIndicator(strokeWidth: 2.4),
            )
          else
            Row(
              children: List.generate(3, (i) {
                final selected = _picked == i;
                final showPrize = !_canPlay && selected;
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(
                      left: i == 0 ? 0 : 4,
                      right: i == 2 ? 0 : 4,
                    ),
                    child: Material(
                      color: selected
                          ? AppTheme.wine.withValues(alpha: 0.14)
                          : AppTheme.creamDeep,
                      borderRadius: BorderRadius.circular(14),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: _canPlay && !_playing ? () => _pick(i) : null,
                        child: SizedBox(
                          height: 110,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                showPrize
                                    ? Icons.emoji_events_outlined
                                    : Icons.meeting_room_outlined,
                                color: AppTheme.wine,
                                size: 34,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                showPrize
                                    ? '$_percent%'
                                    : _playing && selected
                                        ? '…'
                                        : 'Door ${i + 1}',
                                style: TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.ink,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          if (_code != null && _code!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Text(
              'Today’s code: $_code',
              style: TextStyle(
                fontWeight: FontWeight.w500,
                color: AppTheme.wine,
                fontSize: 13,
              ),
            ),
          ],
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: !auth.isAuthenticated
                  ? () => Navigator.pushNamed(context, AppRoutes.login)
                  : null,
              child: Text(
                !auth.isAuthenticated
                    ? 'Login to play'
                    : _canPlay
                        ? (_playing ? 'Opening…' : 'Pick a door')
                        : 'Come back tomorrow',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PromoGameShell extends StatelessWidget {
  const _PromoGameShell({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.child,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      child: Material(
        color: Colors.white,
        elevation: 1.5,
        shadowColor: Colors.black.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.wine.withValues(alpha: 0.12)),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppTheme.wine.withValues(alpha: 0.04),
                Colors.white,
                const Color(0xFFF3F8FF),
              ],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: AppTheme.wine, size: 22),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      title,
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: AppTheme.charcoal.withValues(alpha: 0.7),
                ),
              ),
              const SizedBox(height: 14),
              child,
            ],
          ),
        ),
      ),
    );
  }
}
