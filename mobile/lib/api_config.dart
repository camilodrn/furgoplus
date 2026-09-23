import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig(String rawUrl, {bool allowHttpForDevelopment = false})
    : baseUri = _parse(rawUrl, allowHttpForDevelopment);

  final Uri baseUri;

  static final ApiConfig fromEnvironment = ApiConfig(
    const String.fromEnvironment('API_BASE_URL'),
    allowHttpForDevelopment: const bool.fromEnvironment('ALLOW_HTTP_API'),
  );

  static Uri _parse(String rawUrl, bool allowHttpForDevelopment) {
    final uri = Uri.tryParse(rawUrl);
    if (uri == null ||
        !uri.hasAuthority ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.path.isNotEmpty && uri.path != '/' ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.scheme != 'https' &&
            !(uri.scheme == 'http' && allowHttpForDevelopment && kDebugMode))) {
      throw const FormatException(
        'Set API_BASE_URL to an HTTPS origin; development HTTP requires ALLOW_HTTP_API=true.',
      );
    }
    return uri.replace(path: '/', query: null, fragment: null);
  }

  Uri endpoint(String path) => baseUri.resolve(path);
}
