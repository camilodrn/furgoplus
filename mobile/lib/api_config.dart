import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig(
    String rawUrl, {
    bool allowHttpForDevelopment = false,
    bool demoMode = false,
  }) : baseUri = _parse(rawUrl, allowHttpForDevelopment),
       _demoMode = demoMode;

  final Uri baseUri;
  final bool _demoMode;
  bool get demoMode => _demoMode || baseUri.host == 'demo.furgoplus.cl';

  static final ApiConfig fromEnvironment = ApiConfig(
    const String.fromEnvironment('API_BASE_URL'),
    allowHttpForDevelopment: const bool.fromEnvironment('ALLOW_HTTP_API'),
    demoMode: const bool.fromEnvironment('FURGOPLUS_DEMO_MODE'),
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

const demoRegistrationNotice =
    'Registro ilustrativo: esta demostración no crea cuentas. Los datos del formulario no se envían ni se guardan en la aplicación. Las cuentas ficticias las prepara el equipo.';
