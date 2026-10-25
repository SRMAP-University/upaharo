import '../../config/api_endpoints.dart';

/// Decode / CDN quality tiers for progressive network images.
enum ImageQuality {
  /// Tiny preview (~64–96px) — first paint.
  low,

  /// Single-pass list tiles (~180–360px) — scroll-friendly.
  medium,

  /// Display-sized decode (~viewport).
  high,
}

class ImageResolver {
  ImageResolver._();

  static const _nextWidths = <int>[
    16,
    32,
    48,
    64,
    96,
    128,
    256,
    384,
    640,
    750,
    828,
    1080,
    1200,
    1920,
  ];

  static String resolve(String? rawUrl) {
    final base = ApiEndpoints.baseUrl;
    final imageUrl = (rawUrl ?? '').trim();
    if (imageUrl.isEmpty) return '';
    if (imageUrl.startsWith('/api/uploads')) {
      return '$base$imageUrl';
    }
    // Rewrite apex/www/netlify upload URLs onto the working API host.
    if (imageUrl.contains('/api/uploads?') &&
        (imageUrl.contains('upaharo.com') ||
            imageUrl.contains('netlify.app'))) {
      final uri = Uri.tryParse(imageUrl);
      final key = uri?.queryParameters['key'];
      if (key != null && key.isNotEmpty) {
        return '$base/api/uploads?key=${Uri.encodeComponent(key)}';
      }
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    if (imageUrl.startsWith('data:') || imageUrl.startsWith('//')) {
      return imageUrl.startsWith('//') ? 'https:$imageUrl' : imageUrl;
    }
    // Admin-pasted values are often site-relative (`/uploads/hero.jpg`) or
    // scheme-less (`cdn.host/hero.jpg`); both are unloadable as-is.
    if (imageUrl.startsWith('/')) {
      return '$base$imageUrl';
    }
    if (RegExp(r'^[\w.-]+\.[a-z]{2,}/').hasMatch(imageUrl)) {
      return 'https://$imageUrl';
    }
    if (imageUrl.startsWith('assets/')) return imageUrl;
    return '$base/$imageUrl';
  }

  /// Resolved URL tuned for [quality]. Thumbnails go through the image
  /// optimizer so a category tile does not download the original PNG.
  static String resolveQuality(
    String? rawUrl, {
    ImageQuality quality = ImageQuality.high,
    int? targetWidth,
  }) {
    final resolved = resolve(rawUrl);
    if (resolved.isEmpty) return '';

    if (quality == ImageQuality.high) {
      if (_isVideoUrl(resolved)) return resolved;
      return variant(resolved, width: targetWidth ?? 1080, quality: 75);
    }

    if (quality == ImageQuality.medium) {
      return variant(resolved, width: targetWidth ?? 384, quality: 65);
    }

    return variant(resolved, width: targetWidth ?? 96, quality: 35);
  }

  /// Best-effort resize/quality rewrite for known CDNs + Upaharo uploads via Next image.
  static String variant(
    String absoluteUrl, {
    required int width,
    required int quality,
  }) {
    final trimmed = absoluteUrl.trim();
    if (trimmed.isEmpty) return '';

    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme) return trimmed;

    final host = uri.host.toLowerCase();

    if (host.contains('images.unsplash.com')) {
      final params = Map<String, String>.from(uri.queryParameters);
      params['w'] = '$width';
      params['q'] = '$quality';
      params.putIfAbsent('auto', () => 'format');
      params.putIfAbsent('fit', () => 'crop');
      return uri.replace(queryParameters: params).toString();
    }

    if (host.contains('res.cloudinary.com')) {
      // Insert /q_XX,w_YY/ after /upload/
      final path = uri.path;
      final marker = '/upload/';
      final idx = path.indexOf(marker);
      if (idx >= 0) {
        final after = path.substring(idx + marker.length);
        // Avoid double-transform if already present.
        if (!after.startsWith('q_') && !after.startsWith('w_')) {
          final newPath =
              '${path.substring(0, idx + marker.length)}q_$quality,w_$width,f_auto/$after';
          return uri.replace(path: newPath).toString();
        }
      }
      return trimmed;
    }

    // ImgBB and other hosts have no size parameter. A quick-pick tile was
    // downloading the original 1MB+ PNG. Ask our image optimizer for a
    // display-sized file instead. Videos stay on their own URL.
    if (_isVideoUrl(trimmed) || trimmed.contains('/_next/image?')) {
      return trimmed;
    }

    final origin = (host.contains('upaharo.com') ||
            host.contains('vercel.app') ||
            host == 'localhost' ||
            host == '127.0.0.1')
        ? '${uri.scheme}://${uri.host}'
        : ApiEndpoints.baseUrl;
    final w = _nearestNextWidth(width);
    final q = quality.clamp(1, 100);
    return '$origin/_next/image?url=${Uri.encodeComponent(trimmed)}&w=$w&q=$q';
  }

  static bool _isVideoUrl(String url) {
    final decoded = Uri.decodeFull(url).toLowerCase();
    return RegExp(r'\.(mp4|webm|mov)(?:$|[?#])').hasMatch(decoded);
  }

  static int _nearestNextWidth(int width) {
    for (final w in _nextWidths) {
      if (w >= width) return w;
    }
    return _nextWidths.last;
  }

  /// Pixel cache width for [CachedNetworkImage] decode (lazy memory).
  static int? memCacheWidth(double? layoutWidth, double devicePixelRatio) {
    if (layoutWidth == null || !layoutWidth.isFinite || layoutWidth <= 0) {
      return null;
    }
    // Cap aggressively — decoding 2–3x display size was janking home scroll.
    return (layoutWidth * devicePixelRatio).round().clamp(48, 720);
  }
}
