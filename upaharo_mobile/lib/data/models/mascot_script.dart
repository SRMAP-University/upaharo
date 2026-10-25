/// What the gift-box mascot can say on a screen.
class MascotScript {
  const MascotScript({this.intro, this.lines = const [], this.added = const []});

  /// Said once, unprompted, when the screen opens.
  final String? intro;

  /// Rotated through on taps and the occasional idle tip.
  final List<String> lines;

  /// Said when something lands in the cart.
  final List<String> added;

  MascotScript copyWith({String? intro, List<String>? lines, List<String>? added}) =>
      MascotScript(
        intro: intro ?? this.intro,
        lines: lines ?? this.lines,
        added: added ?? this.added,
      );
}
