class SocialOrderLinks {
  static String? whatsAppDigits(String phone) {
    var digits = phone.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) return null;
    if (digits.startsWith('00')) digits = digits.substring(2);
    if (digits.startsWith('91') && digits.length >= 12) return digits;
    if (digits.startsWith('977') && digits.length >= 12) return digits;
    if (digits.length == 10 && RegExp(r'^(97|98)\d{8}$').hasMatch(digits)) {
      return '977$digits';
    }
    if (digits.length == 10 && RegExp(r'^[6-9]\d{9}$').hasMatch(digits)) {
      return '91$digits';
    }
    return digits;
  }

  static String? instagramHandle(String input) {
    var handle = input.trim();
    if (handle.isEmpty) return null;
    if (handle.startsWith('@')) handle = handle.substring(1);
    final fromUrl = RegExp(
      r'(?:instagram\.com/|ig\.me/m/)([A-Za-z0-9._]+)',
      caseSensitive: false,
    ).firstMatch(handle);
    if (fromUrl != null) handle = fromUrl.group(1)!;
    handle = handle.replaceAll(RegExp(r'[/?#].*$'), '');
    if (!RegExp(r'^[A-Za-z0-9._]{1,30}$').hasMatch(handle)) return null;
    return handle;
  }

  static Uri? whatsAppOrderUri({
    required String phone,
    required String productId,
    required String productName,
    required double price,
    int quantity = 1,
  }) {
    final digits = whatsAppDigits(phone);
    if (digits == null) return null;
    final qty = quantity < 1 ? 1 : quantity;
    final text = [
      "Hi, I'd like to order:",
      '$productName x$qty — Rs. ${(price * qty).round()}',
      'https://www.upaharo.com/products/$productId',
    ].join('\n');
    return Uri.parse(
      'https://wa.me/$digits?text=${Uri.encodeComponent(text)}',
    );
  }

  static Uri? instagramOrderUri(String instagram) {
    final handle = instagramHandle(instagram);
    if (handle == null) return null;
    return Uri.parse('https://ig.me/m/$handle');
  }
}
