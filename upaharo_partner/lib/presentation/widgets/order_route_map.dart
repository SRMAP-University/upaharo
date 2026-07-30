import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/order_geo.dart';

/// Large interactive map with pickup → drop route line and distance chips.
class OrderRouteMap extends StatefulWidget {
  const OrderRouteMap({
    super.key,
    this.pickup,
    this.destination,
    this.me,
    required this.accent,
    this.height = 340,
    this.showMyLocation = false,
    this.pickupLabel = 'Pickup',
    this.destinationLabel = 'Customer',
    this.borderRadius = 10,
  });

  final LatLng? pickup;
  final LatLng? destination;
  final LatLng? me;
  final Color accent;
  final double height;
  final bool showMyLocation;
  final String pickupLabel;
  final String destinationLabel;
  final double borderRadius;

  @override
  State<OrderRouteMap> createState() => _OrderRouteMapState();
}

class _OrderRouteMapState extends State<OrderRouteMap> {
  GoogleMapController? _ctrl;

  @override
  void dispose() {
    _ctrl?.dispose();
    super.dispose();
  }

  @override
  void didUpdateWidget(covariant OrderRouteMap oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pickup != widget.pickup ||
        oldWidget.destination != widget.destination ||
        oldWidget.me != widget.me) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _fit());
    }
  }

  List<LatLng> get _points {
    final pts = <LatLng>[];
    if (widget.pickup != null) pts.add(widget.pickup!);
    if (widget.destination != null) pts.add(widget.destination!);
    if (widget.me != null) pts.add(widget.me!);
    return pts;
  }

  Future<void> _fit() async {
    final ctrl = _ctrl;
    final pts = _points;
    if (ctrl == null || pts.isEmpty) return;
    if (pts.length == 1) {
      await ctrl.animateCamera(CameraUpdate.newLatLngZoom(pts.first, 15.5));
      return;
    }
    await ctrl.animateCamera(
      CameraUpdate.newLatLngBounds(boundsFor(pts), 64),
    );
  }

  Set<Marker> get _markers {
    final set = <Marker>{};
    final pickup = widget.pickup;
    final dest = widget.destination;
    final me = widget.me;
    if (pickup != null) {
      set.add(
        Marker(
          markerId: const MarkerId('pickup'),
          position: pickup,
          infoWindow: InfoWindow(title: widget.pickupLabel),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueGreen,
          ),
        ),
      );
    }
    if (dest != null) {
      set.add(
        Marker(
          markerId: const MarkerId('dropoff'),
          position: dest,
          infoWindow: InfoWindow(title: widget.destinationLabel),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueRed,
          ),
        ),
      );
    }
    if (me != null) {
      set.add(
        Marker(
          markerId: const MarkerId('me'),
          position: me,
          infoWindow: const InfoWindow(title: 'You'),
          icon: BitmapDescriptor.defaultMarkerWithHue(
            BitmapDescriptor.hueAzure,
          ),
        ),
      );
    }
    return set;
  }

  Set<Polyline> get _polylines {
    final pickup = widget.pickup;
    final dest = widget.destination;
    final me = widget.me;
    final lines = <Polyline>{};
    if (pickup != null && dest != null) {
      lines.add(
        Polyline(
          polylineId: const PolylineId('route'),
          points: [pickup, dest],
          color: widget.accent.withValues(alpha: 0.85),
          width: 5,
          patterns: [PatternItem.dash(18), PatternItem.gap(10)],
        ),
      );
    }
    if (me != null && pickup != null) {
      lines.add(
        Polyline(
          polylineId: const PolylineId('to_pickup'),
          points: [me, pickup],
          color: Colors.blueGrey.withValues(alpha: 0.55),
          width: 3,
          patterns: [PatternItem.dot, PatternItem.gap(8)],
        ),
      );
    } else if (me != null && dest != null && pickup == null) {
      lines.add(
        Polyline(
          polylineId: const PolylineId('to_drop'),
          points: [me, dest],
          color: Colors.blueGrey.withValues(alpha: 0.55),
          width: 3,
          patterns: [PatternItem.dot, PatternItem.gap(8)],
        ),
      );
    }
    return lines;
  }

  @override
  Widget build(BuildContext context) {
    final pts = _points;
    if (pts.isEmpty) {
      return SizedBox(
        height: widget.height * 0.35,
        child: const Center(
          child: Text(
            'No map coordinates for this order',
            style: TextStyle(fontSize: 12, color: AppTheme.muted),
          ),
        ),
      );
    }

    final initial = widget.destination ?? widget.pickup ?? widget.me!;
    final routeMeters = distanceMeters(widget.pickup, widget.destination);
    final toPickup = distanceMeters(widget.me, widget.pickup);
    final toDrop = distanceMeters(widget.me, widget.destination);

    return ClipRRect(
      borderRadius: BorderRadius.circular(widget.borderRadius),
      child: SizedBox(
        height: widget.height,
        width: double.infinity,
        child: Stack(
          children: [
            GoogleMap(
              initialCameraPosition: CameraPosition(
                target: initial,
                zoom: 14.5,
              ),
              markers: _markers,
              polylines: _polylines,
              myLocationEnabled: widget.showMyLocation,
              myLocationButtonEnabled: false,
              zoomControlsEnabled: true,
              mapToolbarEnabled: false,
              compassEnabled: true,
              liteModeEnabled: false,
              gestureRecognizers: <Factory<OneSequenceGestureRecognizer>>{
                Factory<EagerGestureRecognizer>(EagerGestureRecognizer.new),
              },
              onMapCreated: (c) async {
                _ctrl = c;
                await Future<void>.delayed(const Duration(milliseconds: 280));
                await _fit();
              },
            ),
            Positioned(
              left: 8,
              right: 8,
              top: 8,
              child: Wrap(
                spacing: 6,
                runSpacing: 6,
                children: [
                  if (routeMeters != null)
                    _DistanceChip(
                      icon: Icons.route,
                      label:
                          '${widget.pickupLabel} → ${widget.destinationLabel}',
                      value: formatDistanceMeters(routeMeters),
                      accent: widget.accent,
                    ),
                  if (toPickup != null)
                    _DistanceChip(
                      icon: Icons.directions_bike,
                      label: 'You → ${widget.pickupLabel}',
                      value: formatDistanceMeters(toPickup),
                      accent: Colors.blueGrey.shade700,
                    ),
                  if (toDrop != null && widget.me != null)
                    _DistanceChip(
                      icon: Icons.flag,
                      label: 'You → ${widget.destinationLabel}',
                      value: formatDistanceMeters(toDrop),
                      accent: AppTheme.danger,
                    ),
                  if (routeMeters == null &&
                      widget.destination != null &&
                      widget.pickup == null)
                    _DistanceChip(
                      icon: Icons.location_on,
                      label: widget.destinationLabel,
                      value: 'Drop pin',
                      accent: widget.accent,
                    ),
                ],
              ),
            ),
            Positioned(
              right: 8,
              bottom: 8,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (widget.pickup != null)
                    _NavFab(
                      heroTag: 'nav_pickup_${identityHashCode(this)}',
                      color: Colors.white,
                      iconColor: widget.accent,
                      icon: Icons.storefront,
                      tooltip: 'Navigate to pickup',
                      onPressed: () => openGoogleMapsDirections(
                        destination: widget.pickup!,
                        origin: widget.me,
                      ),
                    ),
                  if (widget.destination != null) ...[
                    const SizedBox(width: 6),
                    _NavFab(
                      heroTag: 'nav_drop_${identityHashCode(this)}',
                      color: widget.accent,
                      iconColor: Colors.white,
                      icon: Icons.navigation,
                      tooltip: 'Navigate to customer',
                      onPressed: () => openGoogleMapsDirections(
                        destination: widget.destination!,
                        origin: widget.me ?? widget.pickup,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DistanceChip extends StatelessWidget {
  const _DistanceChip({
    required this.icon,
    required this.label,
    required this.value,
    required this.accent,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.94),
      elevation: 2,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: accent),
            const SizedBox(width: 4),
            Text(
              '$label · ',
              style: const TextStyle(
                fontSize: 11,
                color: AppTheme.charcoal,
                fontWeight: FontWeight.w500,
              ),
            ),
            Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: accent,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavFab extends StatelessWidget {
  const _NavFab({
    required this.heroTag,
    required this.color,
    required this.iconColor,
    required this.icon,
    required this.onPressed,
    required this.tooltip,
  });

  final Object heroTag;
  final Color color;
  final Color iconColor;
  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: FloatingActionButton.small(
        heroTag: heroTag,
        backgroundColor: color,
        onPressed: onPressed,
        child: Icon(icon, color: iconColor, size: 18),
      ),
    );
  }
}

/// Opens a tall route map sheet (pool / quick preview).
Future<void> showOrderRouteMapSheet({
  required BuildContext context,
  required Color accent,
  LatLng? pickup,
  LatLng? destination,
  LatLng? me,
  String title = 'Route',
  bool showMyLocation = false,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: AppTheme.pageBg,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
    ),
    builder: (ctx) {
      final h = MediaQuery.sizeOf(ctx).height * 0.72;
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(ctx),
                    icon: const Icon(Icons.close, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              OrderRouteMap(
                pickup: pickup,
                destination: destination,
                me: me,
                accent: accent,
                height: h - 72,
                showMyLocation: showMyLocation,
                borderRadius: 12,
              ),
            ],
          ),
        ),
      );
    },
  );
}
