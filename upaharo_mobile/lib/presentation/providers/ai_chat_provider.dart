import 'package:flutter/foundation.dart';

import '../../core/network/api_exception.dart';
import '../../data/models/ai_message.dart';
import '../../data/repositories/ai_repository.dart';

class AiChatProvider extends ChangeNotifier {
  AiChatProvider({AiRepository? repository})
      : _repository = repository ?? const AiRepository();

  final AiRepository _repository;

  final List<AiMessage> _messages = [
    AiMessage(
      role: AiRole.assistant,
      content:
          "Hi! I'm Upaharo's gifting assistant. Tell me the occasion, recipient, or budget and I'll suggest the perfect gift.",
    ),
  ];
  bool _loading = false;
  String? _error;

  List<AiMessage> get messages => List.unmodifiable(_messages);
  bool get isLoading => _loading;
  String? get error => _error;

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<void> send(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    _messages.add(AiMessage(role: AiRole.user, content: trimmed));
    _loading = true;
    _error = null;
    notifyListeners();

    try {
      final reply = await _repository.sendMessage(_messages);
      _messages.add(reply);
      _error = null;
    } catch (e) {
      if (e is ApiException) {
        _error = e.message;
      } else {
        _error = 'Something went wrong. Please try again.';
      }
      if (kDebugMode) debugPrint('AI chat send failed: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  void newChat() {
    _messages
      ..clear()
      ..add(
        AiMessage(
          role: AiRole.assistant,
          content:
              "Hi! I'm Upaharo's gifting assistant. What are you shopping for today?",
        ),
      );
    _error = null;
    notifyListeners();
  }
}
