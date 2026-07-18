import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';

import '../../../config/routes.dart';
import '../../../config/theme.dart';
import '../../providers/location_provider.dart';

class LocationScreen extends StatelessWidget {
  const LocationScreen({super.key});

  Future<void> _openSettings() async {
    await Geolocator.openAppSettings();
  }

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<LocationProvider>();
    final location = locationProvider.location;

    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Choose Location'),
        bottom: location != null && location.address.isNotEmpty
            ? PreferredSize(
                preferredSize: const Size.fromHeight(44),
                child: Container(
                  alignment: Alignment.center,
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Text(
                    location.shortAddress,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white, fontSize: 13),
                  ),
                ),
              )
            : null,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.creamDeep,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.location_on, color: AppTheme.wine),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Delivery Location',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.charcoal,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              location?.label ?? 'Your location',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.ink,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    location?.shortAddress ?? 'We need your location to check delivery availability.',
                    style: const TextStyle(fontSize: 14, height: 1.5, color: AppTheme.charcoal),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            if (locationProvider.status == LocationStatus.loading)
              const Center(child: CircularProgressIndicator(color: AppTheme.wine))
            else if (locationProvider.status == LocationStatus.denied &&
                locationProvider.errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  locationProvider.errorMessage!,
                  style: TextStyle(color: Colors.red.shade800),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _openSettings,
                child: const Text('Open Settings'),
              ),
            ] else if (locationProvider.status == LocationStatus.error &&
                locationProvider.errorMessage != null) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  locationProvider.errorMessage!,
                  style: TextStyle(color: Colors.orange.shade900),
                ),
              ),
              const SizedBox(height: 16),
            ],
            const Spacer(),
            ElevatedButton.icon(
              onPressed: locationProvider.status == LocationStatus.loading
                  ? null
                  : () async {
                      final success = await context.read<LocationProvider>().detectLocation();
                      if (success && context.mounted) {
                        Navigator.pop(context);
                      }
                    },
              icon: const Icon(Icons.my_location),
              label: const Text('Use my current location'),
            ),
            const SizedBox(height: 12),
            ElevatedButton.icon(
              onPressed: () => Navigator.pushNamed(
                context,
                AppRoutes.mapLocation,
                arguments: location,
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppTheme.wine,
              ),
              icon: const Icon(Icons.map_outlined),
              label: const Text('Choose on map'),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.pushNamed(context, AppRoutes.main),
              child: const Text('Continue without location'),
            ),
          ],
        ),
      ),
    );
  }
}
