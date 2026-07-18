import 'package:flutter/foundation.dart';

/// Controls which main tab is visible inside [MainShell].
class ShellTabController extends ChangeNotifier {
  int _index = 0;

  int get index => _index;

  void goTo(int index) {
    if (index < 0 || index > 4) return;
    if (index == _index) return;
    _index = index;
    notifyListeners();
  }

  void resetToHome() {
    if (_index == 0) return;
    _index = 0;
    notifyListeners();
  }
}
