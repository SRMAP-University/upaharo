import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../../../config/routes.dart';
import '../../../core/network/api_exception.dart';
import '../../../data/models/address.dart';
import '../../../data/models/user_location.dart';
import '../../../data/repositories/address_repository.dart';
import '../../providers/auth_provider.dart';
import '../../providers/location_provider.dart';

class LocationScreen extends StatefulWidget {
  const LocationScreen({super.key});

  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen> {
  final _addressesRepo = const AddressRepository();

  List<Address> _addresses = [];
  bool _loading = true;
  String? _selectedKey;

  @override
  void initState() {
    super.initState();
    _loadAddresses();
  }

  Future<void> _loadAddresses() async {
    if (!context.read<AuthProvider>().isAuthenticated) {
      if (mounted) setState(() => _loading = false);
      return;
    }

    try {
      final addresses = await _addressesRepo.getAddresses();
      if (!mounted) return;
      setState(() {
        _addresses = addresses;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  List<_SavedPlace> _places(UserLocation? current) {
    final places = _addresses.map(_SavedPlace.fromAddress).toList();
    if (current != null && !places.any((place) => place.matches(current))) {
      places.insert(0, _SavedPlace.fromCurrent(current));
    }
    return places;
  }

  Future<void> _select(_SavedPlace place) async {
    setState(() => _selectedKey = place.key);
    await context.read<LocationProvider>().setLocation(place.location);
  }

  Future<void> _edit(_SavedPlace place) async {
    final result = await Navigator.pushNamed(
      context,
      AppRoutes.mapLocation,
      arguments: place.location,
    );
    if (!mounted || result is! UserLocation) return;

    final saved = place.address;
    if (saved != null && context.read<AuthProvider>().isAuthenticated) {
      try {
        await _addressesRepo.updateAddress(
          saved.copyWith(
            label: result.label?.trim().isNotEmpty == true
                ? result.label!.trim()
                : saved.label,
            street: result.street?.trim().isNotEmpty == true
                ? result.street!.trim()
                : saved.street,
            apartment: result.apartment,
            landmark: result.landmark,
            city: result.city?.trim().isNotEmpty == true
                ? result.city!.trim()
                : saved.city,
            state: result.state?.trim().isNotEmpty == true
                ? result.state!.trim()
                : saved.state,
            pincode: result.pincode?.trim().isNotEmpty == true
                ? result.pincode!.trim()
                : saved.pincode,
            latitude: result.latitude,
            longitude: result.longitude,
          ),
        );
        await _loadAddresses();
      } catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is ApiException ? e.message : 'Could not update this location',
            ),
          ),
        );
      }
    }

    if (mounted) setState(() => _selectedKey = place.key);
  }

  void _leave() {
    if (Navigator.canPop(context)) {
      Navigator.pop(context);
    } else {
      Navigator.pushReplacementNamed(context, AppRoutes.main);
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationProvider = context.watch<LocationProvider>();
    final current = locationProvider.location;
    final places = _places(current);
    final loadingGps = locationProvider.status == LocationStatus.loading;
    final denied = locationProvider.status == LocationStatus.denied &&
        locationProvider.errorMessage != null;
    final failed = locationProvider.status == LocationStatus.error &&
        locationProvider.errorMessage != null;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'Location',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: Color(0xFF1F1F1F),
          ),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF1F1F1F)),
          onPressed: _leave,
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF1F1F1F),
              ),
            )
          : places.isEmpty
              ? const Center(
                  child: Text(
                    'No saved locations yet',
                    style: TextStyle(fontSize: 15, color: Color(0xFF6B6B6B)),
                  ),
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
                  itemCount: places.length + 1,
                  separatorBuilder: (context, index) {
                    if (index == 0) return const SizedBox.shrink();
                    return const Divider(
                      height: 1,
                      thickness: 1,
                      indent: 52,
                      color: Color(0xFFF0F0F0),
                    );
                  },
                  itemBuilder: (context, index) {
                    if (index == 0) {
                      return const Padding(
                        padding: EdgeInsets.fromLTRB(16, 8, 16, 8),
                        child: Text(
                          'Saved locations',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3,
                            color: Color(0xFF1F1F1F),
                          ),
                        ),
                      );
                    }
                    final place = places[index - 1];
                    final selected = place.key == _selectedKey;
                    return InkWell(
                      onTap: () => _select(place),
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
                        child: Row(
                          children: [
                            Icon(
                              selected
                                  ? Icons.location_on_rounded
                                  : Icons.location_on_outlined,
                              size: 22,
                              color: const Color(0xFF1F1F1F),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    place.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: selected
                                          ? FontWeight.w700
                                          : FontWeight.w600,
                                      color: const Color(0xFF1F1F1F),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    place.subtitle,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      height: 1.3,
                                      color: Color(0xFF6B6B6B),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (selected)
                              OutlinedButton(
                                onPressed: () => _edit(place),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: const Color(0xFF1F1F1F),
                                  side: const BorderSide(color: Color(0xFFE0E0E0)),
                                  minimumSize: const Size(0, 34),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                ),
                                child: const Text(
                                  'Edit',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              )
                            else
                              const Icon(
                                Icons.chevron_right_rounded,
                                size: 22,
                                color: Color(0xFFB0B0B0),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
      bottomNavigationBar: Material(
        color: Colors.white,
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Divider(height: 1, thickness: 1, color: Color(0xFFF0F0F0)),
              if (denied || failed)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: Text(
                    locationProvider.errorMessage!,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: denied
                          ? const Color(0xFFB42318)
                          : const Color(0xFF8A5A00),
                    ),
                  ),
                ),
              if (denied)
                _action(
                  icon: Icons.settings_outlined,
                  title: 'Open phone settings',
                  subtitle: 'Allow location access for Upaharo',
                  onTap: Geolocator.openAppSettings,
                ),
              _action(
                icon: Icons.my_location_outlined,
                title: 'Use current location',
                subtitle: loadingGps ? 'Finding your location…' : 'Detect where you are',
                trailing: loadingGps
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Color(0xFF1F1F1F),
                        ),
                      )
                    : null,
                onTap: loadingGps
                    ? null
                    : () async {
                        final success =
                            await context.read<LocationProvider>().detectLocation();
                        if (success && context.mounted) _leave();
                      },
              ),
              _action(
                icon: Icons.map_outlined,
                title: 'Choose on map',
                subtitle: 'Drop a pin and confirm the address',
                onTap: () async {
                  final result = await Navigator.pushNamed(
                    context,
                    AppRoutes.mapLocation,
                    arguments: current,
                  );
                  if (result != null && context.mounted) _leave();
                },
              ),
              _action(
                icon: Icons.arrow_forward_rounded,
                title: 'Continue without location',
                subtitle: 'You can set this later',
                onTap: () => Navigator.pushNamed(context, AppRoutes.main),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _action({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback? onTap,
    Widget? trailing,
  }) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
        child: Row(
          children: [
            Icon(icon, size: 22, color: const Color(0xFF1F1F1F)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF1F1F1F),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 13, color: Color(0xFF6B6B6B)),
                  ),
                ],
              ),
            ),
            trailing ??
                const Icon(
                  Icons.chevron_right_rounded,
                  size: 22,
                  color: Color(0xFFB0B0B0),
                ),
          ],
        ),
      ),
    );
  }
}

class _SavedPlace {
  const _SavedPlace({
    required this.key,
    required this.title,
    required this.subtitle,
    required this.location,
    this.address,
  });

  final String key;
  final String title;
  final String subtitle;
  final UserLocation location;
  final Address? address;

  factory _SavedPlace.fromAddress(Address address) {
    final title = address.label.trim().isEmpty ? 'Saved location' : address.label.trim();
    final subtitle = address.displayAddress.trim().isEmpty
        ? 'No address details'
        : address.displayAddress;
    return _SavedPlace(
      key: address.id,
      title: title,
      subtitle: subtitle,
      address: address,
      location: UserLocation(
        latitude: address.latitude,
        longitude: address.longitude,
        address: address.displayAddress,
        label: title,
        street: address.street,
        apartment: address.apartment,
        landmark: address.landmark,
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      ),
    );
  }

  factory _SavedPlace.fromCurrent(UserLocation location) {
    final title = location.headerLabel;
    final detail = location.headerAddress;
    return _SavedPlace(
      key: 'current',
      title: title,
      subtitle: detail == title || detail.isEmpty
          ? location.shortAddress
          : detail,
      location: location,
    );
  }

  bool matches(UserLocation other) {
    if (location.latitude != 0 && other.latitude != 0) {
      final near = (location.latitude - other.latitude).abs() < 0.0005 &&
          (location.longitude - other.longitude).abs() < 0.0005;
      if (near) return true;
    }
    final left = location.headerAddress.toLowerCase();
    final right = other.headerAddress.toLowerCase();
    return left.isNotEmpty && left != 'choose location' && left == right;
  }
}
