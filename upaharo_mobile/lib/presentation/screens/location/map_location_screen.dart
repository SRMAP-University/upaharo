import 'dart:async';
import 'dart:math' show cos, sqrt;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:provider/provider.dart';

import '../../../config/app_constants.dart';
import '../../../config/theme.dart';
import '../../../core/services/location_service.dart';
import '../../../data/models/user_location.dart';
import '../../providers/location_provider.dart';
import '../../providers/settings_provider.dart';

class MapLocationScreen extends StatefulWidget {
  const MapLocationScreen({super.key});

  @override
  State<MapLocationScreen> createState() => _MapLocationScreenState();
}

class _MapLocationScreenState extends State<MapLocationScreen> {
  final _formKey = GlobalKey<FormState>();
  GoogleMapController? _mapController;

  late LatLng _selectedPosition;
  LatLng _currentCameraTarget = const LatLng(
    AppConstants.defaultLatitude,
    AppConstants.defaultLongitude,
  );

  final _labelController = TextEditingController(text: 'Home');
  final _streetController = TextEditingController();
  final _apartmentController = TextEditingController();
  final _landmarkController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _pincodeController = TextEditingController();

  bool _isFetchingAddress = false;
  String _resolvedAddress = '';
  Timer? _addressDebounce;
  LatLng _lastFetchedPosition = const LatLng(
    AppConstants.defaultLatitude,
    AppConstants.defaultLongitude,
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final initial = ModalRoute.of(context)?.settings.arguments as UserLocation?;
    final appSettings = context.read<SettingsProvider>().settings;
    final defaultLat = appSettings.mapLatitude;
    final defaultLng = appSettings.mapLongitude;
    _selectedPosition = LatLng(
      initial?.latitude ?? defaultLat,
      initial?.longitude ?? defaultLng,
    );
    _currentCameraTarget = _selectedPosition;
    _lastFetchedPosition = _selectedPosition;

    _labelController.text = initial?.label ?? 'Home';
    _streetController.text = initial?.street ?? '';
    _cityController.text = initial?.city ?? '';
    _stateController.text = initial?.state ?? '';
    _pincodeController.text = initial?.pincode ?? '';
    _apartmentController.text = initial?.apartment ?? '';
    _landmarkController.text = initial?.landmark ?? '';
    _resolvedAddress = initial?.address ?? '';
  }

  @override
  void dispose() {
    _addressDebounce?.cancel();
    _mapController?.dispose();
    _labelController.dispose();
    _streetController.dispose();
    _apartmentController.dispose();
    _landmarkController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _pincodeController.dispose();
    super.dispose();
  }

  double _distanceInKm(LatLng a, LatLng b) {
    const earthRadius = 6371;
    final dLat = _toRad(b.latitude - a.latitude);
    final dLng = _toRad(b.longitude - a.longitude);
    final x = dLng * cos(_toRad((a.latitude + b.latitude) / 2));
    return sqrt(x * x + dLat * dLat) * earthRadius;
  }

  double _toRad(double deg) => deg * 3.141592653589793 / 180;

  Future<void> _fetchAddressFromPin() async {
    if (!mounted) return;

    // Skip if already very close to the last fetched point.
    final distance = _distanceInKm(_currentCameraTarget, _lastFetchedPosition);
    if (distance < 0.05 && _resolvedAddress.isNotEmpty) return;

    setState(() => _isFetchingAddress = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final location = await const LocationService().reverseGeocode(
        _currentCameraTarget.latitude,
        _currentCameraTarget.longitude,
      );

      _lastFetchedPosition = _currentCameraTarget;

      _streetController.text = location.street ?? '';
      _cityController.text = location.city ?? '';
      _stateController.text = location.state ?? '';
      _pincodeController.text = location.pincode ?? '';
      _landmarkController.text = location.landmark ?? '';

      if (mounted) {
        setState(() => _resolvedAddress = location.address);
      }
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text('Could not fetch address: $e')),
      );
    } finally {
      if (mounted) {
        setState(() => _isFetchingAddress = false);
      }
    }
  }

  void _onCameraIdle() {
    setState(() => _selectedPosition = _currentCameraTarget);
    _addressDebounce?.cancel();
    _addressDebounce = Timer(const Duration(milliseconds: 500), _fetchAddressFromPin);
  }

  Future<void> _saveLocation() async {
    if (!_formKey.currentState!.validate()) return;

    final location = UserLocation(
      latitude: _currentCameraTarget.latitude,
      longitude: _currentCameraTarget.longitude,
      address: [
        _streetController.text,
        _apartmentController.text,
        _landmarkController.text,
        _cityController.text,
        _stateController.text,
        _pincodeController.text,
      ].where((part) => part.isNotEmpty).join(', '),
      label: _labelController.text.trim(),
      street: _streetController.text.trim(),
      apartment: _apartmentController.text.trim().isEmpty ? null : _apartmentController.text.trim(),
      landmark: _landmarkController.text.trim().isEmpty ? null : _landmarkController.text.trim(),
      city: _cityController.text.trim(),
      state: _stateController.text.trim(),
      pincode: _pincodeController.text.trim(),
    );

    await context.read<LocationProvider>().setLocation(location);

    if (!mounted) return;
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(
        title: const Text('Choose delivery location'),
      ),
      body: Column(
        children: [
          // Map
          Expanded(
            flex: 3,
            child: Stack(
              alignment: Alignment.center,
              children: [
                GoogleMap(
                  initialCameraPosition: CameraPosition(
                    target: _selectedPosition,
                    zoom: 16,
                  ),
                  onMapCreated: (controller) => _mapController = controller,
                  onCameraMove: (position) {
                    _currentCameraTarget = position.target;
                  },
                  onCameraIdle: _onCameraIdle,
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                  zoomControlsEnabled: true,
                  mapToolbarEnabled: false,
                ),
                IgnorePointer(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppTheme.wine,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Text(
                          'Move map to adjust',
                          style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Icon(
                        Icons.location_pin,
                        color: AppTheme.wine,
                        size: 44,
                      ),
                      const SizedBox(height: 38),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Address form
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(26)),
              ),
              child: Form(
                key: _formKey,
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppTheme.creamDeep,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.location_on, color: AppTheme.wine),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Selected location',
                                  style: TextStyle(fontSize: 12, color: AppTheme.charcoal, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _resolvedAddress.isNotEmpty
                                      ? _resolvedAddress
                                      : _streetController.text.isNotEmpty
                                          ? _streetController.text
                                          : _isFetchingAddress
                                              ? 'Detecting address...'
                                              : 'Move the pin to detect your address',
                                  style: const TextStyle(fontSize: 14, color: AppTheme.ink, fontWeight: FontWeight.w500),
                                ),
                                if (_cityController.text.isNotEmpty || _stateController.text.isNotEmpty)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 4),
                                    child: Text(
                                      [
                                        if (_cityController.text.isNotEmpty) _cityController.text,
                                        if (_stateController.text.isNotEmpty) _stateController.text,
                                        if (_pincodeController.text.isNotEmpty) _pincodeController.text,
                                      ].join(', '),
                                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (_isFetchingAddress)
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.wine),
                            )
                          else
                            IconButton(
                              icon: const Icon(Icons.refresh, size: 20, color: AppTheme.wine),
                              tooltip: 'Refresh address',
                              onPressed: _fetchAddressFromPin,
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    _buildField(_labelController, 'Label', required: true),
                    _buildField(_streetController, 'Street / Area', required: true),
                    Row(
                      children: [
                        Expanded(child: _buildField(_apartmentController, 'Apt / Flat')),
                        const SizedBox(width: 12),
                        Expanded(child: _buildField(_landmarkController, 'Landmark')),
                      ],
                    ),
                    Row(
                      children: [
                        Expanded(child: _buildField(_cityController, 'City', required: true)),
                        const SizedBox(width: 12),
                        Expanded(child: _buildField(_stateController, 'State', required: true)),
                      ],
                    ),
                    _buildField(_pincodeController, 'Pincode', required: true),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _saveLocation,
                        child: const Text('Save Delivery Location'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildField(TextEditingController controller, String label, {bool required = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        validator: required
            ? (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Required';
                }
                return null;
              }
            : null,
      ),
    );
  }
}
