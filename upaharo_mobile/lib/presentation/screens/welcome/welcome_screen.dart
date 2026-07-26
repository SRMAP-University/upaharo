import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../widgets/progressive_network_image.dart';

class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  Timer? _autoPlayTimer;

  final List<_CarouselSlide> _slides = const [
    _CarouselSlide(
      imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80',
      title: 'Hand-crafted Gifts',
      subtitle: 'Curated flowers, cakes, and surprises for every moment.',
    ),
    _CarouselSlide(
      imageUrl: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=800&q=80',
      title: 'Same-Day Delivery',
      subtitle: 'Order before the cut-off and we deliver today, right on time.',
    ),
    _CarouselSlide(
      imageUrl: 'https://images.unsplash.com/photo-1526045612212-70caf35c14df?auto=format&fit=crop&w=800&q=80',
      title: 'Make Them Smile',
      subtitle: 'Beautifully arranged gifts, delivered to their doorstep.',
    ),
  ];

  @override
  void initState() {
    super.initState();
    _startAutoPlay();
  }

  @override
  void dispose() {
    _autoPlayTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoPlay() {
    _autoPlayTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (!mounted) return;
      final next = (_currentPage + 1) % _slides.length;
      _pageController.animateToPage(
        next,
        duration: const Duration(milliseconds: 600),
        curve: Curves.easeInOut,
      );
    });
  }

  void _onPageChanged(int page) {
    setState(() => _currentPage = page);
  }

  void _goToAuth() {
    _autoPlayTimer?.cancel();
    Navigator.pushReplacementNamed(context, AppRoutes.login);
  }

  void _goToHomeAsGuest() {
    _autoPlayTimer?.cancel();
    Navigator.pushReplacementNamed(context, AppRoutes.main);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Branding header
            Padding(
              padding: const EdgeInsets.only(top: 32, bottom: 8),
              child: Column(
                children: [
                  Text(
                    'Upaharo',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.wine,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Gifts that say everything words can\'t.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: AppTheme.charcoal,
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ),
            ),

            // Carousel
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: _onPageChanged,
                  itemCount: _slides.length,
                  itemBuilder: (context, index) {
                    final slide = _slides[index];
                    return LayoutBuilder(
                      builder: (context, constraints) {
                        final imageHeight = math.max(
                          220.0,
                          math.min(constraints.maxHeight * 0.50, 360.0),
                        );

                        return SingleChildScrollView(
                          physics: const ClampingScrollPhysics(),
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              minHeight: constraints.maxHeight,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 24),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(34),
                                    child: Container(
                                      height: imageHeight,
                                      width: double.infinity,
                                      decoration: BoxDecoration(
                                        color: AppTheme.creamDeep,
                                        borderRadius: BorderRadius.circular(34),
                                      ),
                                      child: ProgressiveNetworkImage(
                                        url: slide.imageUrl,
                                        fit: BoxFit.cover,
                                        placeholder: Container(
                                          color: AppTheme.creamDeep,
                                        ),
                                        errorWidget: Container(
                                          color: AppTheme.creamDeep,
                                          child: const Icon(Icons.image_not_supported),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 28),
                                  AnimatedOpacity(
                                    opacity: _currentPage == index ? 1 : 0.3,
                                    duration: const Duration(milliseconds: 400),
                                    child: Column(
                                      children: [
                                        Text(
                                          slide.title,
                                          textAlign: TextAlign.center,
                                          style: TextStyle(
                                            fontSize: 22,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.ink,
                                          ),
                                        ),
                                        const SizedBox(height: 10),
                                        Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 12),
                                          child: Text(
                                            slide.subtitle,
                                            textAlign: TextAlign.center,
                                            style: TextStyle(
                                              fontSize: 14,
                                              height: 1.5,
                                              color: AppTheme.charcoal,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                ],
                              ),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ),

            // Page indicators
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _slides.length,
                (index) => AnimatedContainer(
                  duration: Duration(milliseconds: 300),
                  margin: EdgeInsets.symmetric(horizontal: 4),
                  width: _currentPage == index ? 24 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: _currentPage == index ? AppTheme.wine : AppTheme.wine.withAlpha(60),
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),

            // Bottom actions
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ElevatedButton(
                    onPressed: _goToAuth,
                    child: const Text('Get Started'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: _goToHomeAsGuest,
                    child: const Text('Continue as guest'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CarouselSlide {
  final String imageUrl;
  final String title;
  final String subtitle;

  const _CarouselSlide({
    required this.imageUrl,
    required this.title,
    required this.subtitle,
  });
}
