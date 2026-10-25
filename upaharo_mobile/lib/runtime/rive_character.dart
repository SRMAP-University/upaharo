import 'dart:async';

import 'package:flutter/material.dart';
import 'package:rive/rive.dart' as rive;

import '../config/theme.dart';
import 'feature.dart';
import 'open_path.dart';

/// Lets the runtime drive a [RiveCharacter].
class RiveCharacterController {
  _RiveCharacterState? _state;

  void say(String text) => _state?._say(text);
  void play(String name) => _state?._play(name);

  bool get visible {
    final state = _state;
    return state != null && state.mounted && TickerMode.of(state.context);
  }
}

/// How a feature's `play` name maps onto the Rive state machine:
/// `trigger:Name`, `bool:Name=true` or `number:Name=3`.
class RiveInputSpec {
  const RiveInputSpec(this.kind, this.name, this.value);

  final String kind;
  final String name;
  final String? value;

  static RiveInputSpec? parse(String raw) {
    final colon = raw.indexOf(':');
    if (colon <= 0) return null;
    final kind = raw.substring(0, colon).trim();
    final rest = raw.substring(colon + 1);
    final eq = rest.indexOf('=');
    final name = (eq < 0 ? rest : rest.substring(0, eq)).trim();
    if (name.isEmpty || !const {'trigger', 'bool', 'number'}.contains(kind)) return null;
    return RiveInputSpec(kind, name, eq < 0 ? null : rest.substring(eq + 1).trim());
  }
}

/// A character drawn by a Rive file the server points at. Its animations
/// live in the file's state machine; [RiveCharacterController.play] fires the
/// inputs named in the feature's `rive.inputs` map.
class RiveCharacter extends StatefulWidget {
  const RiveCharacter({
    super.key,
    required this.url,
    required this.size,
    this.artboard,
    this.stateMachine,
    this.inputs = const {},
    this.controller,
    this.onTap,
  });

  final String url;
  final double size;
  final String? artboard;
  final String? stateMachine;
  final Map<String, String> inputs;
  final RiveCharacterController? controller;
  final VoidCallback? onTap;

  @override
  State<RiveCharacter> createState() => _RiveCharacterState();
}

class _RiveCharacterState extends State<RiveCharacter> {
  final _overlay = OverlayPortalController();
  final _link = LayerLink();
  rive.File? _file;
  rive.RiveWidgetController? _rive;
  String? _line;
  Timer? _lineTimer;

  @override
  void initState() {
    super.initState();
    widget.controller?._state = this;
    _load();
  }

  Future<void> _load() async {
    try {
      final file = await rive.File.url(siteUri(widget.url).toString(), riveFactory: rive.Factory.rive);
      if (file == null || !mounted) {
        file?.dispose();
        return;
      }
      final controller = rive.RiveWidgetController(
        file,
        artboardSelector: widget.artboard == null
            ? rive.ArtboardSelector.byDefault()
            : rive.ArtboardSelector.byName(widget.artboard!),
        stateMachineSelector: widget.stateMachine == null
            ? rive.StateMachineSelector.byDefault()
            : rive.StateMachineSelector.byName(widget.stateMachine!),
      );
      setState(() {
        _file = file;
        _rive = controller;
      });
    } catch (e) {
      debugPrint('[runtime] Rive character failed to load: $e');
    }
  }

  @override
  void dispose() {
    if (widget.controller?._state == this) widget.controller?._state = null;
    _lineTimer?.cancel();
    _rive?.dispose();
    _file?.dispose();
    super.dispose();
  }

  void _play(String name) {
    final machine = _rive?.stateMachine;
    final spec = RiveInputSpec.parse(widget.inputs[name] ?? '');
    if (machine == null || spec == null) return;
    switch (spec.kind) {
      case 'trigger':
        // ignore: deprecated_member_use
        machine.trigger(spec.name)?.fire();
      case 'bool':
        // ignore: deprecated_member_use
        machine.boolean(spec.name)?.value = spec.value != 'false';
      case 'number':
        // ignore: deprecated_member_use
        machine.number(spec.name)?.value = double.tryParse(spec.value ?? '') ?? 0;
    }
  }

  void _say(String text) {
    if (!mounted) return;
    setState(() => _line = text);
    _overlay.show();
    _lineTimer?.cancel();
    final ms = (1800 + (text.length - 18) * 55).clamp(1800, 4800);
    _lineTimer = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      setState(() => _line = null);
      _overlay.hide();
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = _rive;
    return GestureDetector(
      onTap: widget.onTap,
      behavior: HitTestBehavior.opaque,
      child: OverlayPortal(
        controller: _overlay,
        overlayChildBuilder: (context) => Positioned(
          left: 0,
          top: 0,
          child: CompositedTransformFollower(
            link: _link,
            showWhenUnlinked: false,
            targetAnchor: Alignment.topCenter,
            followerAnchor: Alignment.bottomLeft,
            offset: const Offset(-4, -2),
            child: IgnorePointer(child: _Bubble(text: _line ?? '')),
          ),
        ),
        child: CompositedTransformTarget(
          link: _link,
          child: SizedBox.square(
            dimension: widget.size,
            child: controller == null ? null : rive.RiveWidget(controller: controller, fit: rive.Fit.contain),
          ),
        ),
      ),
    );
  }
}

class _Bubble extends StatelessWidget {
  const _Bubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Material(
      type: MaterialType.transparency,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 200),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(16),
            topRight: Radius.circular(16),
            bottomRight: Radius.circular(16),
            bottomLeft: Radius.circular(6),
          ),
          border: Border.all(color: AppTheme.wine.withAlpha(26)),
          boxShadow: [
            BoxShadow(color: Colors.black.withAlpha(40), blurRadius: 14, offset: const Offset(0, 6), spreadRadius: -6),
          ],
        ),
        child: Text(
          text,
          maxLines: 3,
          style: TextStyle(
            fontSize: 11,
            height: 1.3,
            fontWeight: FontWeight.w600,
            color: AppTheme.ink,
            decoration: TextDecoration.none,
          ),
        ),
      ),
    );
  }
}

/// `rive.inputs` from a feature config as a plain string map.
Map<String, String> riveInputs(dynamic raw) =>
    asMap(raw).map((key, value) => MapEntry(key, value?.toString() ?? ''));
