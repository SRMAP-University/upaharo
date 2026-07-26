import '../../config/api_endpoints.dart';

/// Decode / CDN quality tiers for progressive network images.
enum ImageQuality {
  /// Tiny preview (~64–96px) — first paint.
  low,

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
    final url = String.fromEnvironment(
      'BASE_URL',
      defaultValue: ApiEndpoints.baseUrl,
    );

    final imageUrl = (rawUrl ?? '').trim();
    if (imageUrl.isEmpty) return '';
    if (imageUrl.startsWith('/api/uploads')) {
      return '$url$imageUrl';
    }
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    return imageUrl;
  }

  /// Resolved URL tuned for [quality] (smaller download for [ImageQuality.low]).
  ///
  /// High quality keeps the original asset URL when possible so we do not
  /// re-encode through the Next optimizer.
  static String resolveQuality(
    String? rawUrl, {
    ImageQuality quality = ImageQuality.high,
    int? targetWidth,
  }) {
    final resolved = resolve(rawUrl);
    if (resolved.isEmpty) return '';

    if (quality == ImageQuality.high) {
      // Unsplash / Cloudinary can still request a display-sized high encode.
      final uri = Uri.tryParse(resolved);
      final host = uri?.host.toLowerCase() ?? '';
      if (host.contains('images.unsplash.com') ||
          host.contains('res.cloudinary.com')) {
        return variant(
          resolved,
          width: targetWidth ?? 1080,
          quality: 80,
        );
      }
      return resolved;
    }

    return variant(
      resolved,
      width: targetWidth ?? 96,
      quality: 35,
    );
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

    // Same-origin uploads (and other Upaharo assets) via Next.js optimizer.
    if (host.contains('upaharo.com') ||
        trimmed.contains('/api/uploads') ||
        host == 'localhost' ||
        host == '127.0.0.1') {
      final base = String.fromEnvironment(
        'BASE_URL',
        defaultValue: ApiEndpoints.baseUrl,
      );
      final w = _nearestNextWidth(width);
      final q = quality.clamp(1, 100);
      return '$base/_next/image?url=${Uri.encodeComponent(trimmed)}&w=$w&q=$q';
    }

    return trimmed;
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
