import 'package:flutter/material.dart';

/// Soft fade + slight upward slide for all platform page pushes.
class AppFadeSlideTransitionsBuilder extends PageTransitionsBuilder {
  const AppFadeSlideTransitionsBuilder();

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(
      parent: animation,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    );
    final secondary = CurvedAnimation(
      parent: secondaryAnimation,
      curve: Curves.easeOutCubic,
    );

    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0.04, 0.03),
          end: Offset.zero,
        ).animate(curved),
        child: FadeTransition(
          opacity: Tween<double>(begin: 1, end: 0.92).animate(secondary),
          child: SlideTransition(
            position: Tween<Offset>(
              begin: Offset.zero,
              end: const Offset(-0.02, 0),
            ).animate(secondary),
            child: child,
          ),
        ),
      ),
    );
  }
}

/// Apply on [ThemeData.pageTransitionsTheme].
const appPageTransitionsTheme = PageTransitionsTheme(
  builders: {
    TargetPlatform.android: AppFadeSlideTransitionsBuilder(),
    TargetPlatform.iOS: AppFadeSlideTransitionsBuilder(),
    TargetPlatform.macOS: AppFadeSlideTransitionsBuilder(),
    TargetPlatform.windows: AppFadeSlideTransitionsBuilder(),
    TargetPlatform.linux: AppFadeSlideTransitionsBuilder(),
    TargetPlatform.fuchsia: AppFadeSlideTransitionsBuilder(),
  },
);
