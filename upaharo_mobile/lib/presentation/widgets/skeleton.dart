import 'package:flutter/material.dart';
import 'package:shimmer/shimmer.dart';

import '../../config/theme.dart';

class SkeletonBox extends StatelessWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.radius = 8,
  });

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: Colors.grey.shade300,
      highlightColor: Colors.grey.shade100,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(radius),
        ),
      ),
    );
  }
}

class HomeSkeleton extends StatelessWidget {
  const HomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return ListView(
      padding: EdgeInsets.fromLTRB(12, top + 12, 12, 120),
      children: [
        const SkeletonBox(height: 36, radius: 18),
        const SizedBox(height: 12),
        const SkeletonBox(height: 36, radius: 8),
        const SizedBox(height: 12),
        const SkeletonBox(height: 200, radius: 18),
        const SizedBox(height: 16),
        const SkeletonBox(height: 220, radius: 18),
        const SizedBox(height: 16),
        Row(
          children: List.generate(
            4,
            (_) => const Expanded(
              child: Padding(
                padding: EdgeInsets.only(right: 8),
                child: SkeletonBox(height: 72, radius: 36),
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: const [
            Expanded(child: SkeletonBox(height: 180, radius: 14)),
            SizedBox(width: 10),
            Expanded(child: SkeletonBox(height: 180, radius: 14)),
          ],
        ),
      ],
    );
  }
}

class OrdersSkeleton extends StatelessWidget {
  const OrdersSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      itemCount: 4,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (_, _) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.black12),
        ),
        child: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SkeletonBox(width: 140, height: 16),
            SizedBox(height: 12),
            Row(
              children: [
                SkeletonBox(width: 56, height: 56, radius: 12),
                SizedBox(width: 10),
                Expanded(child: SkeletonBox(height: 40)),
              ],
            ),
            SizedBox(height: 10),
            Row(
              children: [
                SkeletonBox(width: 56, height: 56, radius: 12),
                SizedBox(width: 10),
                Expanded(child: SkeletonBox(height: 40)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class ListSkeleton extends StatelessWidget {
  const ListSkeleton({super.key, this.count = 6});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: count,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (_, _) => const Row(
        children: [
          SkeletonBox(width: 64, height: 64, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 100, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Soft cream shimmer for brand-aligned skeletons.
class BrandShimmer extends StatelessWidget {
  const BrandShimmer({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: AppTheme.creamDeep,
      highlightColor: Colors.white,
      child: child,
    );
  }
}
