import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../widgets/progressive_network_image.dart';
import '../../../core/utils/price_formatter.dart';
import '../../../data/models/ai_message.dart';
import '../../../data/models/product.dart';
import '../../providers/ai_chat_provider.dart';

class AiChatScreen extends StatefulWidget {
  const AiChatScreen({super.key});

  @override
  State<AiChatScreen> createState() => _AiChatScreenState();
}

class _AiChatScreenState extends State<AiChatScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    _controller.clear();
    _focusNode.unfocus();
    await context.read<AiChatProvider>().send(text);
    _scrollToBottom();
  }

  void _openProduct(Product product) {
    Navigator.pushNamed(context, AppRoutes.productDetail, arguments: product.id);
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AiChatProvider>();
    final messages = provider.messages;

    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.auto_awesome, size: 20, color: AppTheme.gold),
            SizedBox(width: 8),
            Text('Gift Assistant'),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'New chat',
            onPressed: provider.newChat,
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
              itemCount: messages.length,
              itemBuilder: (context, index) {
                final msg = messages[index];
                return _MessageItem(
                  message: msg,
                  onProductTap: _openProduct,
                );
              },
            ),
          ),
          if (provider.error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  provider.error!,
                  style: TextStyle(fontSize: 12, color: Colors.red.shade800),
                ),
              ),
            ),
          _QuickChips(onTap: (text) {
            _controller.text = text;
            _focusNode.requestFocus();
          }),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 6, 12, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _send(),
                    decoration: InputDecoration(
                      hintText: 'Ask for gift ideas...',
                      fillColor: Colors.white,
                      filled: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Material(
                  color: AppTheme.wine,
                  borderRadius: BorderRadius.circular(24),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: provider.isLoading ? null : _send,
                    child: Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      child: provider.isLoading
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.send, color: Colors.white, size: 20),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MessageItem extends StatelessWidget {
  const _MessageItem({required this.message, required this.onProductTap});

  final AiMessage message;
  final ValueChanged<Product> onProductTap;

  @override
  Widget build(BuildContext context) {
    final isUser = message.isUser;
    final alignment = isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final bubbleColor = isUser ? AppTheme.wine : Colors.white;
    final textColor = isUser ? Colors.white : AppTheme.ink;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: alignment,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.8,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: bubbleColor,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isUser ? 16 : 4),
                bottomRight: Radius.circular(isUser ? 4 : 16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withAlpha(8),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              message.content,
              style: TextStyle(fontSize: 14, color: textColor, height: 1.35),
            ),
          ),
          if (message.products.isNotEmpty)
            SizedBox(
              height: 170,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(top: 10),
                itemCount: message.products.length,
                separatorBuilder: (context, index) => const SizedBox(width: 10),
                itemBuilder: (context, index) => _ProductSuggestionCard(
                  product: message.products[index],
                  onTap: () => onProductTap(message.products[index]),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ProductSuggestionCard extends StatelessWidget {
  const _ProductSuggestionCard({required this.product, required this.onTap});

  final Product product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 130,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(10),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              child: ProgressiveNetworkImage(
                url: product.image,
                width: 130,
                height: 95,
                fit: BoxFit.cover,
                placeholder: Container(
                  width: 130,
                  height: 95,
                  color: Colors.grey.shade200,
                ),
                errorWidget: Container(
                  width: 130,
                  height: 95,
                  color: Colors.grey.shade200,
                  alignment: Alignment.center,
                  child: Icon(Icons.image_outlined, color: AppTheme.wine),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
              child: Text(
                product.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppTheme.ink),
              ),
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 8),
              child: Text(
                PriceFormatter.format(product.finalPrice),
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.wine),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickChips extends StatelessWidget {
  const _QuickChips({required this.onTap});

  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    const suggestions = [
      'Birthday gift for mom',
      'Budget under NPR 2000',
      'Romantic flowers',
      'Same day delivery',
    ];

    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsets.symmetric(horizontal: 12),
        itemCount: suggestions.length,
        separatorBuilder: (context, index) => SizedBox(width: 8),
        itemBuilder: (context, index) {
          return ActionChip(
            backgroundColor: Colors.white,
            side: BorderSide(color: AppTheme.wine.withAlpha(40)),
            label: Text(
              suggestions[index],
              style: TextStyle(fontSize: 12, color: AppTheme.ink),
            ),
            onPressed: () => onTap(suggestions[index]),
          );
        },
      ),
    );
  }
}
