import 'package:flutter/material.dart';

/// Like [IndexedStack], but fades and slides when [index] changes.
/// Inactive tabs stay mounted so scroll/state is preserved.
class AnimatedIndexedStack extends StatefulWidget {
  const AnimatedIndexedStack({
    super.key,
    required this.index,
    required this.children,
    this.duration = const Duration(milliseconds: 320),
    this.curve = Curves.easeOutCubic,
  });

  final int index;
  final List<Widget> children;
  final Duration duration;
  final Curve curve;

  @override
  State<AnimatedIndexedStack> createState() => _AnimatedIndexedStackState();
}

class _AnimatedIndexedStackState extends State<AnimatedIndexedStack>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late Animation<double> _animation;
  late int _currentIndex;
  int? _previousIndex;
  bool _forward = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.index;
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = CurvedAnimation(parent: _controller, curve: widget.curve);
    _controller.value = 1;
  }

  @override
  void didUpdateWidget(covariant AnimatedIndexedStack oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.duration != oldWidget.duration) {
      _controller.duration = widget.duration;
    }
    if (widget.index != _currentIndex) {
      _forward = widget.index > _currentIndex;
      _previousIndex = _currentIndex;
      _currentIndex = widget.index;
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) {
        return Stack(
          fit: StackFit.expand,
          children: [
            for (var i = 0; i < widget.children.length; i++)
              _buildChild(i),
          ],
        );
      },
    );
  }

  Widget _buildChild(int i) {
    final isCurrent = i == _currentIndex;
    final isPrevious = i == _previousIndex && _controller.isAnimating;
    final visible = isCurrent || isPrevious;

    if (!visible) {
      return Offstage(
        offstage: true,
        child: TickerMode(
          enabled: false,
          child: widget.children[i],
        ),
      );
    }

    double opacity;
    Offset offset;

    if (isCurrent) {
      opacity = _animation.value;
      final dx = (1 - _animation.value) * (_forward ? 0.06 : -0.06);
      offset = Offset(dx, 0.012 * (1 - _animation.value));
    } else {
      opacity = 1 - _animation.value;
      final dx = _animation.value * (_forward ? -0.04 : 0.04);
      offset = Offset(dx, 0);
    }

    return IgnorePointer(
      ignoring: !isCurrent,
      child: TickerMode(
        enabled: isCurrent,
        child: Opacity(
          opacity: opacity.clamp(0.0, 1.0),
          child: FractionalTranslation(
            translation: offset,
            child: widget.children[i],
          ),
        ),
      ),
    );
  }
}
