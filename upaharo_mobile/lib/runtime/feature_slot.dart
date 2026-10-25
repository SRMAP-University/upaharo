import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'character_feature.dart';
import 'feature_runtime.dart';
import 'web_feature.dart';

/// A spot in a screen where server features can appear. Renders nothing
/// when the server has nothing for [placement].
class FeatureSlot extends StatelessWidget {
  const FeatureSlot({
    super.key,
    required this.placement,
    this.slotContext = const {},
    this.builder,
  });

  final String placement;

  /// Passed to features, e.g. `{tab: home}` or `{productId: …}`.
  final Map<String, dynamic> slotContext;

  /// Wraps the content when there is some (padding, positioning…).
  final Widget Function(BuildContext context, Widget child)? builder;

  /// Whether anything will show at [placement] (for layouts that make room).
  static bool hasContent(BuildContext context, String placement) {
    try {
      return context.watch<FeatureRuntime>().featuresAt(placement).isNotEmpty;
    } on ProviderNotFoundException {
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    FeatureRuntime runtime;
    try {
      runtime = context.watch<FeatureRuntime>();
    } on ProviderNotFoundException {
      return const SizedBox.shrink();
    }
    final features = runtime.featuresAt(placement);
    if (features.isEmpty) return const SizedBox.shrink();

    final children = <Widget>[
      for (final feature in features)
        if (feature.type == 'character')
          CharacterFeature(
            key: ValueKey('${feature.id}@$placement'),
            feature: feature,
            runtime: runtime,
            placement: placement,
            slotContext: slotContext,
          )
        else
          WebFeatureBlock(key: ValueKey('${feature.id}@$placement'), feature: feature),
    ];
    final child = children.length == 1
        ? children.first
        : Column(mainAxisSize: MainAxisSize.min, children: children);
    return builder?.call(context, child) ?? child;
  }
}
