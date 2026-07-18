class BannerModel {
  final String id;
  final String title;
  final String? subtitle;
  final String image;
  final String? link;

  const BannerModel({
    required this.id,
    required this.title,
    this.subtitle,
    required this.image,
    this.link,
  });

  factory BannerModel.fromJson(Map<String, dynamic> json) {
    return BannerModel(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String?,
      image: json['image'] as String? ?? '',
      link: json['link'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        if (subtitle != null) 'subtitle': subtitle,
        'image': image,
        if (link != null) 'link': link,
      };
}
