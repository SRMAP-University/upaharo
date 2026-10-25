import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../data/models/mascot_script.dart';
import '../presentation/widgets/nav_mascot.dart';
import 'feature.dart';
import 'feature_runtime.dart';
import 'rive_character.dart';

/// A `character` feature at one placement: picks the script for this spot,
/// hooks the character up to runtime events, and draws the built-in gift
/// buddy or a Rive character.
class CharacterFeature extends StatefulWidget {
  const CharacterFeature({
    super.key,
    required this.feature,
    required this.runtime,
    required this.placement,
    this.slotContext = const {},
  });

  final AppFeature feature;
  final FeatureRuntime runtime;
  final String placement;

  /// What the host screen knows, e.g. `{tab: home}` or `{productId: …}`.
  final Map<String, dynamic> slotContext;

  @override
  State<CharacterFeature> createState() => _CharacterFeatureState();
}

class _CharacterFeatureState extends State<CharacterFeature> implements CharacterHandle {
  final _buddy = NavMascotController();
  final _rive = RiveCharacterController();
  final _rng = math.Random();
  StreamSubscription<FeatureEvent>? _events;
  MascotScript _script = const MascotScript();
  String _scriptKey = '';

  Map<String, dynamic> get _config => widget.feature.config;
  bool get _isRive => _config['character'] == 'rive';
  Map<String, dynamic> get _personality => asMap(_config['personality']);
  Map<String, dynamic> get _context => {'placement': widget.placement, ...widget.slotContext};

  @override
  void initState() {
    super.initState();
    widget.runtime.registerCharacter(widget.feature.key, this);
    _events = widget.runtime.events.listen(_onEvent);
    _resolveScript();
  }

  @override
  void didUpdateWidget(covariant CharacterFeature oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.feature.key != widget.feature.key) {
      widget.runtime.unregisterCharacter(oldWidget.feature.key, this);
      widget.runtime.registerCharacter(widget.feature.key, this);
    }
    final contextChanged = jsonEncode(oldWidget.slotContext) != jsonEncode(widget.slotContext);
    if (contextChanged || !identical(oldWidget.feature.config, widget.feature.config)) _resolveScript();
  }

  @override
  void dispose() {
    _events?.cancel();
    widget.runtime.unregisterCharacter(widget.feature.key, this);
    super.dispose();
  }

  /// The first `scripts[]` entry whose `when` matches this spot, plus any
  /// lines it `fetch`es from our API (e.g. the product chatter).
  Future<void> _resolveScript() async {
    final ctx = _context;
    final key = '${widget.feature.key}|${jsonEncode(ctx)}';
    final entry = asList(_config['scripts'])
        .map(asMap)
        .where((s) => matchesAll(asMap(s['when']), ctx))
        .firstOrNull;
    final vars = {...widget.runtime.vars, ...ctx};

    var intro = entry?['intro'] is String ? fillTemplate(entry!['intro'] as String, vars) : null;
    if (intro != null && entry?['introOnce'] == 'session' && !widget.runtime.takeOncePerSession('intro:$key')) {
      intro = null;
    }
    var script = MascotScript(
      intro: (intro?.isEmpty ?? true) ? null : intro,
      lines: [...asStrings(entry?['lines']), ...asStrings(_config['lines'])],
      added: asStrings(entry?['added']).isNotEmpty ? asStrings(entry?['added']) : asStrings(_config['added']),
    );
    if (mounted) {
      setState(() {
        _script = script;
        _scriptKey = key;
      });
    }

    final fetch = entry?['fetch'];
    if (fetch is! String || fetch.isEmpty) return;
    final data = await widget.runtime.fetchJson(fillTemplate(fetch, vars));
    if (data == null || !mounted || _scriptKey != key) return;
    final fetchedLines = asStrings(data['lines']);
    final fetchedAdded = asStrings(data['added']);
    script = MascotScript(
      intro: data['intro'] is String ? data['intro'] as String : script.intro,
      lines: [...fetchedLines, ...script.lines],
      added: fetchedAdded.isNotEmpty ? fetchedAdded : script.added,
    );
    setState(() => _script = script);
  }

  void _onEvent(FeatureEvent event) {
    if (!visible) return;
    if (event.name == 'cart.added' && _personality['celebrateCart'] != false) {
      play('love');
      final added = this.added;
      if (added.isNotEmpty) say(added[_rng.nextInt(added.length)]);
    }
    for (final rule in widget.feature.rules) {
      if (rule.event != 'tap' && rule.matches(event)) {
        widget.runtime.run(rule.actions, character: this, vars: {..._context, ...event.data});
      }
    }
  }

  void _onTap() {
    final tapRules = widget.feature.rules.where((r) => r.event == 'tap').toList();
    for (final rule in tapRules) {
      widget.runtime.run(rule.actions, character: this, vars: _context);
    }
  }

  // ---- CharacterHandle -------------------------------------------------------

  @override
  void say(String text) => _isRive ? _rive.say(text) : _buddy.say(text);

  @override
  void play(String name) => _isRive ? _rive.play(name) : _buddy.play(name);

  @override
  List<String> get lines => _script.lines;

  @override
  List<String> get added => _script.added;

  @override
  bool get visible => mounted && TickerMode.of(context) && (_isRive ? _rive.visible : _buddy.visible);

  @override
  Widget build(BuildContext context) {
    final size = _config['size'] is num ? (_config['size'] as num).toDouble().clamp(24.0, 120.0) : 38.0;
    final hasTapRules = widget.feature.rules.any((r) => r.event == 'tap');

    if (_isRive) {
      final riveConfig = asMap(_config['rive']);
      final url = riveConfig['url']?.toString() ?? '';
      if (url.isEmpty) return const SizedBox.shrink();
      return RiveCharacter(
        url: url,
        size: size,
        artboard: riveConfig['artboard']?.toString(),
        stateMachine: riveConfig['stateMachine']?.toString(),
        inputs: riveInputs(riveConfig['inputs']),
        controller: _rive,
        onTap: _onTap,
      );
    }

    final sleepSeconds = _personality['sleepAfterSeconds'];
    return NavMascot(
      size: size,
      script: _script,
      scriptKey: _scriptKey,
      controller: _buddy,
      onTap: hasTapRules ? _onTap : null,
      // Custom tap rules replace the built-in squeaks unless asked to keep them.
      tapCycle: _personality['tapCycle'] != false && (!hasTapRules || _personality['tapCycle'] == true),
      idleActivities: _personality['idle'] != false,
      glance: _personality['glance'] != false,
      sleepAfter: sleepSeconds == 0 || sleepSeconds == false
          ? null
          : Duration(seconds: sleepSeconds is num ? sleepSeconds.toInt().clamp(10, 3600) : 40),
    );
  }
}
