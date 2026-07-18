class FormatTime {
  FormatTime._();

  static String format(int minutes) {
    final safe = minutes <= 0 ? 0 : minutes;
    if (safe < 60) return '$safe min';
    final hours = safe ~/ 60;
    final mins = safe % 60;
    if (mins == 0) return '${hours}h';
    return '${hours}h ${mins}m';
  }
}
