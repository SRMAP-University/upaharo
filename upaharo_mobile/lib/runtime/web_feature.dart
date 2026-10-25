import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../config/flavor.dart';
import '../config/theme.dart';
import '../core/navigation/app_navigator.dart';
import 'feature.dart';
import 'feature_runtime.dart';
import 'open_path.dart';

/// JS channel name; pages call `window.UpaharoApp.postMessage(json)`.
const kBridgeChannel = 'UpaharoApp';

/// The page URL with the app's details, so the page knows it's in the app.
Uri webFeatureUri(String url, {required String appVersion, String platform = 'android'}) {
  final base = siteUri(url);
  return base.replace(queryParameters: {
    ...base.queryParameters,
    'inApp': '1',
    'platform': platform,
    'appVersion': appVersion,
    'runtime': '$kRuntimeVersion',
    'store': FlavorConfig.storeSlug,
  });
}

/// Only our own pages may drive the app (add to cart, navigate…).
bool bridgeAllowed(String? currentUrl) {
  final uri = Uri.tryParse(currentUrl ?? '');
  if (uri == null) return false;
  if (uri.scheme == 'https' && isOurHost(uri.host)) return true;
  // Local dev servers while building a feature.
  return kDebugMode && const {'localhost', '127.0.0.1', '10.0.2.2'}.contains(uri.host);
}

/// `{"do": "...", ...}` from the page, or null.
Map<String, dynamic>? parseBridgeMessage(String message) {
  try {
    final map = asMap(jsonDecode(message));
    return map['do'] is String ? map : null;
  } catch (_) {
    return null;
  }
}

/// A web feature page with the app bridge connected.
class WebFeatureView extends StatefulWidget {
  const WebFeatureView({
    super.key,
    required this.url,
    this.inline = false,
    this.initialHeight = 200,
    this.onClose,
  });

  final String url;

  /// Inline blocks are transparent and size themselves via `resize`.
  final bool inline;
  final double initialHeight;
  final VoidCallback? onClose;

  @override
  State<WebFeatureView> createState() => _WebFeatureViewState();
}

class _WebFeatureViewState extends State<WebFeatureView> {
  late final Uri _start = webFeatureUri(
    widget.url,
    appVersion: FeatureRuntime.instance?.appVersion ?? '',
    platform: defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
  );
  late final WebViewController _controller;
  late double _height = widget.initialHeight;
  bool _loaded = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(widget.inline ? Colors.transparent : AppTheme.cream)
      ..addJavaScriptChannel(kBridgeChannel, onMessageReceived: _onMessage)
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) {
          if (mounted) setState(() => _loaded = true);
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame ?? false) {
            if (mounted) setState(() => _failed = true);
          }
        },
        onNavigationRequest: _onNavigation,
      ))
      ..loadRequest(_start);
  }

  NavigationDecision _onNavigation(NavigationRequest request) {
    if (!request.isMainFrame) return NavigationDecision.navigate;
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.prevent;
    // The feature's own page, and other web features, load here.
    final samePage = uri.host == _start.host && uri.path == _start.path;
    if (samePage || (bridgeAllowed(request.url) && uri.path.startsWith('/app-features/'))) {
      return NavigationDecision.navigate;
    }
    // Any other link goes through the app: a native screen, a web page or the browser.
    if (!widget.inline) widget.onClose?.call();
    final runtime = FeatureRuntime.instance;
    if (runtime != null) {
      runtime.open(request.url);
    } else {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return NavigationDecision.prevent;
  }

  Future<void> _onMessage(JavaScriptMessage message) async {
    if (!bridgeAllowed(await _controller.currentUrl())) return;
    final action = parseBridgeMessage(message.message);
    if (action == null || !mounted) return;
    if (action['do'] == 'resize') {
      final height = action['height'];
      if (widget.inline && height is num) {
        setState(() => _height = height.toDouble().clamp(40, 1200));
      }
      return;
    }
    await FeatureRuntime.instance?.run([action], close: widget.onClose);
  }

  @override
  Widget build(BuildContext context) {
    if (_failed) {
      return SizedBox(
        height: widget.inline ? 0 : null,
        child: widget.inline
            ? null
            : const Center(child: Text('Couldn’t load this right now. Please try again later.')),
      );
    }
    final view = WebViewWidget(controller: _controller);
    if (widget.inline) {
      return AnimatedSize(
        duration: const Duration(milliseconds: 200),
        child: SizedBox(height: _height, child: view),
      );
    }
    return Stack(
      children: [
        Positioned.fill(child: view),
        if (!_loaded) Center(child: CircularProgressIndicator(color: AppTheme.wine)),
      ],
    );
  }
}

/// An inline web feature inside a slot.
class WebFeatureBlock extends StatelessWidget {
  const WebFeatureBlock({super.key, required this.feature});

  final AppFeature feature;

  @override
  Widget build(BuildContext context) {
    final url = feature.config['url']?.toString();
    if (url == null || url.isEmpty) return const SizedBox.shrink();
    final height = feature.config['height'] is num ? (feature.config['height'] as num).toDouble() : 200.0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: WebFeatureView(key: ValueKey(feature.id), url: url, inline: true, initialHeight: height),
      ),
    );
  }
}

/// Opens a web feature as a bottom sheet.
Future<void> showWebFeatureSheet(String url, {String? title, String? featureKey}) async {
  final context = appNavigatorKey.currentContext;
  if (context == null || !context.mounted) return;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    // The page scrolls itself; dragging would fight it.
    enableDrag: false,
    backgroundColor: AppTheme.cream,
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    builder: (sheetContext) => SizedBox(
      height: MediaQuery.sizeOf(sheetContext).height * 0.82,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 10, 8, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    title ?? '',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.ink),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.of(sheetContext).pop(),
                ),
              ],
            ),
          ),
          Expanded(
            child: WebFeatureView(url: url, onClose: () => Navigator.of(sheetContext).maybePop()),
          ),
        ],
      ),
    ),
  );
}

/// Opens a web feature (or any page on our site) full screen.
Future<void> pushWebFeaturePage(String url, {String? title, String? featureKey}) async {
  final navigator = appNavigatorKey.currentState;
  await navigator?.push(MaterialPageRoute<void>(
    builder: (pageContext) => Scaffold(
      backgroundColor: AppTheme.cream,
      appBar: AppBar(title: Text(title ?? '')),
      body: WebFeatureView(url: url, onClose: () => Navigator.of(pageContext).maybePop()),
    ),
  ));
}
