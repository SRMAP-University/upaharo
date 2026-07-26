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
  final String homepageRecommendationMode;
  final String homepageRecommendationTitle;
  final String brandPrimary;
  final String brandSecondary;
  final String headerWash;
  final String pageBackground;

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
    this.homepageRecommendationMode = 'LATEST',
    this.homepageRecommendationTitle = 'Latest Arrivals',
    this.brandPrimary = '#8B5A2B',
    this.brandSecondary = '#D4AF37',
    this.headerWash = '#F7F0E8',
    this.pageBackground = '#FFFFFF',
  });

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
      homepageRecommendationMode: json['homepageRecommendationMode'] as String? ?? 'LATEST',
      homepageRecommendationTitle: json['homepageRecommendationTitle'] as String? ?? 'Latest Arrivals',
      brandPrimary: json['brandPrimary'] as String? ?? '#8B5A2B',
      brandSecondary: json['brandSecondary'] as String? ?? '#D4AF37',
      headerWash: json['headerWash'] as String? ?? '#F7F0E8',
      pageBackground: json['pageBackground'] as String? ?? '#FFFFFF',
    );
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
        'homepageRecommendationMode': homepageRecommendationMode,
        'homepageRecommendationTitle': homepageRecommendationTitle,
        'brandPrimary': brandPrimary,
        'brandSecondary': brandSecondary,
        'headerWash': headerWash,
        'pageBackground': pageBackground,
      };
}
