/// One reorderable mobile home section, configured from the admin panel.
class HomeSectionConfig {
  final String id;
  final String title;
  final String subtitle;
  final bool visible;

  const HomeSectionConfig({
    required this.id,
    required this.title,
    this.subtitle = '',
    this.visible = true,
  });

  factory HomeSectionConfig.fromJson(Map<String, dynamic> json) {
    return HomeSectionConfig(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      subtitle: json['subtitle'] as String? ?? '',
      visible: json['visible'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'subtitle': subtitle,
        'visible': visible,
      };
}

/// Fallback order + copy used before settings load (mirrors the web defaults).
const List<HomeSectionConfig> defaultHomeSections = [
  HomeSectionConfig(
    id: 'spinBanner',
    title: 'Spin & Win',
    subtitle: 'Daily roulette · 5% to 30% off',
  ),
  HomeSectionConfig(id: 'valueDeals', title: 'Value', subtitle: 'DEALS'),
  HomeSectionConfig(id: 'quickPicks', title: 'Quick picks'),
  HomeSectionConfig(id: 'productGrid', title: 'All gifts'),
];

class AppSettings {
  final String siteName;
  final String supportPhone;
  final String supportEmail;
  final String supportHours;
  final String supportMessage;
  final String deliveryEstimate;
  final String deliveryNote;
  final String announcementText;
  final String storeAddress;
  final double mapLatitude;
  final double mapLongitude;
  final bool homepageShowBanner;
  final bool homepageShowTopCategories;
  final bool homepageShowCategorySections;
  final bool homepageShowOccasionTabs;
  final bool homepageShowRecommendations;
  final bool homepageShowValueDeals;
  final bool homepageShowSpinBanner;
  final String homepageRecommendationMode;
  final String homepageRecommendationTitle;
  final List<HomeSectionConfig> homeSectionLayout;
  final String brandPrimary;
  final String brandSecondary;
  final String headerWash;
  final String pageBackground;
  final String textInk;
  final String textMuted;
  final String surfaceSoft;
  final String cardBackground;
  final int cornerRadius;
  final int buttonRadius;
  final String uiDensity;
  final int productGridColumns;
  final double productCardAspectRatio;
  final bool productShowDiscountBadge;
  final bool productShowCategoryLabel;
  final bool showPromoTab;
  final String promoOrbLabel;
  final String navHomeLabel;
  final String navCategoriesLabel;
  final String navTopPicksLabel;
  final double freeDeliveryMinAmount;
  final double deliveryFeeAmount;

  const AppSettings({
    this.siteName = 'Upaharo',
    this.supportPhone = '',
    this.supportEmail = '',
    this.supportHours = '9:00 AM - 9:00 PM',
    this.supportMessage = 'Need help with your order? Our team is available during support hours.',
    this.deliveryEstimate = 'Estimated delivery: 20-30 minutes',
    this.deliveryNote = 'Delivery timings may vary depending on location and order volume.',
    this.announcementText = 'Same day gifting with live support and doorstep delivery.',
    this.storeAddress = '',
    this.mapLatitude = 27.7172,
    this.mapLongitude = 85.324,
    this.homepageShowBanner = true,
    this.homepageShowTopCategories = true,
    this.homepageShowCategorySections = true,
    this.homepageShowOccasionTabs = true,
    this.homepageShowRecommendations = true,
    this.homepageShowValueDeals = true,
    this.homepageShowSpinBanner = true,
    this.homepageRecommendationMode = 'LATEST',
    this.homepageRecommendationTitle = 'Latest Arrivals',
    this.homeSectionLayout = defaultHomeSections,
    this.brandPrimary = '#8B5A2B',
    this.brandSecondary = '#D4AF37',
    this.headerWash = '#F7F0E8',
    this.pageBackground = '#FFFFFF',
    this.textInk = '#1F1F1F',
    this.textMuted = '#3E3E3E',
    this.surfaceSoft = '#F4F4F5',
    this.cardBackground = '#FFFFFF',
    this.cornerRadius = 12,
    this.buttonRadius = 30,
    this.uiDensity = 'COMFORTABLE',
    this.productGridColumns = 2,
    this.productCardAspectRatio = 0.68,
    this.productShowDiscountBadge = true,
    this.productShowCategoryLabel = false,
    this.showPromoTab = true,
    this.promoOrbLabel = '20% OFF',
    this.navHomeLabel = 'Home',
    this.navCategoriesLabel = 'Categories',
    this.navTopPicksLabel = 'Top picks',
    this.freeDeliveryMinAmount = 199,
    this.deliveryFeeAmount = 40,
  });

  /// Ordered, de-duplicated sections; unknown ids are dropped and any section
  /// missing from the server payload is appended from [defaultHomeSections].
  static List<HomeSectionConfig> _parseSections(dynamic raw) {
    if (raw is! List) return defaultHomeSections;

    final known = {for (final s in defaultHomeSections) s.id: s};
    final seen = <String>{};
    final out = <HomeSectionConfig>[];

    for (final item in raw) {
      if (item is! Map) continue;
      final section = HomeSectionConfig.fromJson(
        Map<String, dynamic>.from(item),
      );
      final fallback = known[section.id];
      if (fallback == null || !seen.add(section.id)) continue;
      out.add(
        HomeSectionConfig(
          id: section.id,
          title: section.title.trim().isEmpty ? fallback.title : section.title,
          subtitle: section.subtitle,
          visible: section.visible,
        ),
      );
    }

    for (final fallback in defaultHomeSections) {
      if (!seen.contains(fallback.id)) out.add(fallback);
    }
    return out.isEmpty ? defaultHomeSections : out;
  }

  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      siteName: json['siteName'] as String? ?? 'Upaharo',
      supportPhone: json['supportPhone'] as String? ?? '',
      supportEmail: json['supportEmail'] as String? ?? '',
      supportHours: json['supportHours'] as String? ?? '9:00 AM - 9:00 PM',
      supportMessage: json['supportMessage'] as String? ?? '',
      deliveryEstimate: json['deliveryEstimate'] as String? ?? '',
      deliveryNote: json['deliveryNote'] as String? ?? '',
      announcementText: json['announcementText'] as String? ?? '',
      storeAddress: json['storeAddress'] as String? ?? '',
      mapLatitude: (json['mapLatitude'] as num?)?.toDouble() ?? 27.7172,
      mapLongitude: (json['mapLongitude'] as num?)?.toDouble() ?? 85.324,
      homepageShowBanner: json['homepageShowBanner'] as bool? ?? true,
      homepageShowTopCategories: json['homepageShowTopCategories'] as bool? ?? true,
      homepageShowCategorySections: json['homepageShowCategorySections'] as bool? ?? true,
      homepageShowOccasionTabs: json['homepageShowOccasionTabs'] as bool? ?? true,
      homepageShowRecommendations: json['homepageShowRecommendations'] as bool? ?? true,
      homepageShowValueDeals: json['homepageShowValueDeals'] as bool? ?? true,
      homepageShowSpinBanner: json['homepageShowSpinBanner'] as bool? ?? true,
      homepageRecommendationMode: json['homepageRecommendationMode'] as String? ?? 'LATEST',
      homepageRecommendationTitle: json['homepageRecommendationTitle'] as String? ?? 'Latest Arrivals',
      homeSectionLayout: _parseSections(json['homeSectionLayout']),
      brandPrimary: json['brandPrimary'] as String? ?? '#8B5A2B',
      brandSecondary: json['brandSecondary'] as String? ?? '#D4AF37',
      headerWash: json['headerWash'] as String? ?? '#F7F0E8',
      pageBackground: json['pageBackground'] as String? ?? '#FFFFFF',
      textInk: json['textInk'] as String? ?? '#1F1F1F',
      textMuted: json['textMuted'] as String? ?? '#3E3E3E',
      surfaceSoft: json['surfaceSoft'] as String? ?? '#F4F4F5',
      cardBackground: json['cardBackground'] as String? ?? '#FFFFFF',
      cornerRadius: (json['cornerRadius'] as num?)?.round() ?? 12,
      buttonRadius: (json['buttonRadius'] as num?)?.round() ?? 30,
      uiDensity: json['uiDensity'] as String? ?? 'COMFORTABLE',
      productGridColumns: (json['productGridColumns'] as num?)?.round() ?? 2,
      productCardAspectRatio: (json['productCardAspectRatio'] as num?)?.toDouble() ?? 0.68,
      productShowDiscountBadge: json['productShowDiscountBadge'] as bool? ?? true,
      productShowCategoryLabel: json['productShowCategoryLabel'] as bool? ?? false,
      showPromoTab: json['showPromoTab'] as bool? ?? true,
      promoOrbLabel: json['promoOrbLabel'] as String? ?? '20% OFF',
      navHomeLabel: json['navHomeLabel'] as String? ?? 'Home',
      navCategoriesLabel: json['navCategoriesLabel'] as String? ?? 'Categories',
      navTopPicksLabel: json['navTopPicksLabel'] as String? ?? 'Top picks',
      freeDeliveryMinAmount:
          (json['freeDeliveryMinAmount'] as num?)?.toDouble() ?? 199,
      deliveryFeeAmount: (json['deliveryFeeAmount'] as num?)?.toDouble() ?? 40,
    );
  }

  /// Section config by id, or null when the admin removed/hid it.
  HomeSectionConfig? sectionById(String id) {
    for (final section in homeSectionLayout) {
      if (section.id == id) return section;
    }
    return null;
  }

  Map<String, dynamic> toJson() => {
        'siteName': siteName,
        'supportPhone': supportPhone,
        'supportEmail': supportEmail,
        'supportHours': supportHours,
        'supportMessage': supportMessage,
        'deliveryEstimate': deliveryEstimate,
        'deliveryNote': deliveryNote,
        'announcementText': announcementText,
        'storeAddress': storeAddress,
        'mapLatitude': mapLatitude,
        'mapLongitude': mapLongitude,
        'homepageShowBanner': homepageShowBanner,
        'homepageShowTopCategories': homepageShowTopCategories,
        'homepageShowCategorySections': homepageShowCategorySections,
        'homepageShowOccasionTabs': homepageShowOccasionTabs,
        'homepageShowRecommendations': homepageShowRecommendations,
        'homepageShowValueDeals': homepageShowValueDeals,
        'homepageShowSpinBanner': homepageShowSpinBanner,
        'homepageRecommendationMode': homepageRecommendationMode,
        'homepageRecommendationTitle': homepageRecommendationTitle,
        'homeSectionLayout': homeSectionLayout.map((e) => e.toJson()).toList(),
        'brandPrimary': brandPrimary,
        'brandSecondary': brandSecondary,
        'headerWash': headerWash,
        'pageBackground': pageBackground,
        'textInk': textInk,
        'textMuted': textMuted,
        'surfaceSoft': surfaceSoft,
        'cardBackground': cardBackground,
        'cornerRadius': cornerRadius,
        'buttonRadius': buttonRadius,
        'uiDensity': uiDensity,
        'productGridColumns': productGridColumns,
        'productCardAspectRatio': productCardAspectRatio,
        'productShowDiscountBadge': productShowDiscountBadge,
        'productShowCategoryLabel': productShowCategoryLabel,
        'showPromoTab': showPromoTab,
        'promoOrbLabel': promoOrbLabel,
        'navHomeLabel': navHomeLabel,
        'navCategoriesLabel': navCategoriesLabel,
        'navTopPicksLabel': navTopPicksLabel,
        'freeDeliveryMinAmount': freeDeliveryMinAmount,
        'deliveryFeeAmount': deliveryFeeAmount,
      };
}
