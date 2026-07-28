/// A compact tile in the home "mini banner" row.
///
/// The server resolves each tile's target before sending it, so a link that
/// points at a deleted product or category arrives as [MiniBannerLinkType.none]
/// rather than a dead id.
enum MiniBannerLinkType { none, product, category }

class MiniBanner {
  final String id;
  final String title;
  final String image;
  final MiniBannerLinkType linkType;

  /// Product or category id, depending on [linkType].
  final String? linkId;

  /// Target name, used as the title of the screen the tile opens.
  final String? linkLabel;

  const MiniBanner({
    required this.id,
    required this.title,
    required this.image,
    this.linkType = MiniBannerLinkType.none,
    this.linkId,
    this.linkLabel,
  });

  bool get hasLink => linkType != MiniBannerLinkType.none && (linkId ?? '').isNotEmpty;

  factory MiniBanner.fromJson(Map<String, dynamic> json) {
    final rawId = (json['linkId'] as String? ?? '').trim();
    final type = _parseLinkType(json['linkType']);

    return MiniBanner(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      image: json['image'] as String? ?? '',
      linkType: rawId.isEmpty ? MiniBannerLinkType.none : type,
      linkId: rawId.isEmpty ? null : rawId,
      linkLabel: (json['linkLabel'] as String?)?.trim(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'image': image,
        'linkType': switch (linkType) {
          MiniBannerLinkType.product => 'PRODUCT',
          MiniBannerLinkType.category => 'CATEGORY',
          MiniBannerLinkType.none => 'NONE',
        },
        'linkId': linkId,
        'linkLabel': linkLabel,
      };

  static MiniBannerLinkType _parseLinkType(dynamic raw) {
    return switch (raw?.toString().trim().toUpperCase()) {
      'PRODUCT' => MiniBannerLinkType.product,
      'CATEGORY' => MiniBannerLinkType.category,
      _ => MiniBannerLinkType.none,
    };
  }
}
