import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_config.dart';

class AuthFailure implements Exception {
  AuthFailure(this.status, this.code, this.message);
  final int status;
  final String code;
  final String message;
}

abstract interface class AuthStorage {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class SecureAuthStorage implements AuthStorage {
  SecureAuthStorage({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();
  static const _key = 'furgoplus.session.v1';
  final FlutterSecureStorage _storage;

  @override
  Future<String?> read() => _storage.read(key: _key);
  @override
  Future<void> write(String value) => _storage.write(key: _key, value: value);
  @override
  Future<void> clear() => _storage.delete(key: _key);
}

class AuthHttpResponse {
  AuthHttpResponse(this.status, this.body, this.setCookies);
  final int status;
  final String body;
  final List<String> setCookies;
}

abstract interface class AuthTransport {
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  });
  void close();
}

class IoAuthTransport implements AuthTransport {
  IoAuthTransport({HttpClient? client}) : _client = client ?? HttpClient();
  final HttpClient _client;

  @override
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    final request = await _client.openUrl(method, uri);
    request.followRedirects = false;
    headers.forEach(request.headers.set);
    if (body != null) {
      final bytes = utf8.encode(body);
      request.headers.contentLength = bytes.length;
      request.add(bytes);
    }
    final response = await request.close();
    final text = await utf8.decoder.bind(response).join();
    return AuthHttpResponse(
      response.statusCode,
      text,
      response.headers[HttpHeaders.setCookieHeader] ?? const [],
    );
  }

  @override
  void close() => _client.close();
}

class SessionCookie {
  SessionCookie(this.value, this.host, this.expiresAt, this.secure);
  final String value;
  final String host;
  final DateTime? expiresAt;
  final bool secure;

  bool validFor(Uri uri) =>
      uri.host == host &&
      (!secure || uri.scheme == 'https') &&
      (expiresAt == null || expiresAt!.isAfter(DateTime.now().toUtc()));

  Map<String, Object?> toJson() => {
    'value': value,
    'host': host,
    'expires_at': expiresAt?.toIso8601String(),
    'secure': secure,
  };

  static SessionCookie? fromJson(String? encoded, Uri origin) {
    if (encoded == null) return null;
    try {
      final data = jsonDecode(encoded) as Map<String, dynamic>;
      final value = data['value'] as String;
      final host = data['host'] as String;
      final secure = data['secure'] as bool;
      final rawExpiry = data['expires_at'];
      final expiry = rawExpiry is String ? DateTime.tryParse(rawExpiry) : null;
      final cookie = SessionCookie(value, host, expiry, secure);
      if (value.isEmpty ||
          expiry == null ||
          (origin.scheme == 'https' && !secure) ||
          !cookie.validFor(origin)) {
        return null;
      }
      return cookie;
    } catch (_) {
      return null;
    }
  }
}

class NativeSessionApi {
  NativeSessionApi(
    this.config,
    this.storage, {
    AuthTransport? transport,
    this.requestTimeout = const Duration(seconds: 15),
    this.storageTimeout = const Duration(seconds: 5),
  }) : _transport = transport ?? IoAuthTransport();

  final ApiConfig config;
  final AuthStorage storage;
  final AuthTransport _transport;
  final Duration requestTimeout;
  final Duration storageTimeout;
  SessionCookie? _session;
  String? _csrfCookie;
  String? _csrfToken;
  int _generation = 0;
  Future<void> _storageWork = Future<void>.value();

  // An obsolete response must not rotate cookies, clear a new session or replay
  // a write after CSRF bootstrap. This does not change the wire contract.
  void invalidateRequests() => _generation++;

  void _checkGeneration(int generation) {
    if (generation != _generation) {
      throw AuthFailure(0, 'stale_request', 'Obsolete session response');
    }
  }

  Future<void> _store(int? generation, Future<void> Function() action) {
    // Secure storage is asynchronous. Serialize operations so an in-progress A
    // write cannot finish after B's clear/write and become the restored session.
    final next = _storageWork.then<void>((_) async {
      if (generation != null && generation != _generation) return;
      await action();
    });
    _storageWork = next.catchError((Object _) {});
    return next.timeout(storageTimeout);
  }

  Uri get _origin => config.baseUri;

  Future<void> restoreCookies() async {
    final generation = _generation;
    await _storageWork.timeout(storageTimeout);
    _checkGeneration(generation);
    final stored = await storage.read().timeout(storageTimeout);
    _checkGeneration(generation);
    _session = SessionCookie.fromJson(stored, _origin);
    if (_session == null) await _store(generation, storage.clear);
  }

  Future<Map<String, dynamic>> _request(
    String path,
    String method, {
    Map<String, Object?>? data,
    Duration? timeout,
  }) async {
    final generation = _generation;
    final uri = config.endpoint('api/v1/$path');
    if (uri.scheme != _origin.scheme ||
        uri.host != _origin.host ||
        uri.port != _origin.port) {
      throw const FormatException('API request left the configured origin');
    }
    final unsafe = method != 'GET';
    final cookies = <String>[];
    if (_session?.validFor(uri) ?? false)
      cookies.add('sessionid=${_session!.value}');
    if (_csrfCookie != null) cookies.add('csrftoken=$_csrfCookie');
    final headers = <String, String>{'Accept': 'application/json'};
    if (cookies.isNotEmpty) headers['Cookie'] = cookies.join('; ');
    if (unsafe) {
      headers['Origin'] = _origin.origin;
      headers['Content-Type'] = 'application/json';
      if (_csrfToken != null) headers['X-CSRFToken'] = _csrfToken!;
    }
    final pendingResponse = _transport.send(
      uri,
      method,
      headers: headers,
      body: data == null ? null : jsonEncode(data),
    );
    // Time out at the transport await so late responses cannot rotate cookies
    // or continue a timed-out CSRF bootstrap into a later write.
    final response = await pendingResponse.timeout(timeout ?? requestTimeout);
    _checkGeneration(generation);
    if (response.status >= 300 && response.status < 400) {
      throw const HttpException('API redirect rejected');
    }
    for (final raw in response.setCookies) {
      Cookie cookie;
      try {
        cookie = Cookie.fromSetCookieValue(raw);
      } catch (_) {
        continue;
      }
      if (cookie.domain != null && cookie.domain!.isNotEmpty) continue;
      if (cookie.path != '/') continue;
      final expiry = cookie.maxAge != null
          ? DateTime.now().toUtc().add(Duration(seconds: cookie.maxAge!))
          : cookie.expires?.toUtc();
      final deleted =
          cookie.value.isEmpty ||
          (expiry != null && !expiry.isAfter(DateTime.now().toUtc()));
      if (!deleted && uri.scheme == 'https' && !cookie.secure) continue;
      if (cookie.name == 'sessionid') {
        if (!deleted &&
            (!cookie.httpOnly ||
                cookie.sameSite != SameSite.lax ||
                expiry == null)) {
          continue;
        }
        _session = deleted
            ? null
            : SessionCookie(cookie.value, uri.host, expiry, cookie.secure);
        if (_session == null) {
          await _store(generation, storage.clear);
        } else {
          final encoded = jsonEncode(_session!.toJson());
          await _store(generation, () => storage.write(encoded));
        }
        _checkGeneration(generation);
      } else if (cookie.name == 'csrftoken') {
        _csrfCookie = deleted ? null : cookie.value;
      }
    }
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw const FormatException('Invalid API response');
    }
    if (response.status >= 400) {
      final code = body['code'] is String ? body['code'] as String : 'error';
      if (code == 'csrf_failed' && path != 'auth/csrf/') {
        await csrf(timeout: timeout);
      }
      _checkGeneration(generation);
      if (code == 'not_authenticated') await clear();
      throw AuthFailure(
        response.status,
        code,
        body['message'] is String
            ? body['message'] as String
            : 'Request failed',
      );
    }
    return body;
  }

  Future<void> csrf({Duration? timeout}) async {
    final generation = _generation;
    final body = await _request('auth/csrf/', 'GET', timeout: timeout);
    _checkGeneration(generation);
    final token = body['csrf_token'];
    if (token is! String || token.isEmpty)
      throw const FormatException('Invalid CSRF response');
    _csrfToken = token;
  }

  Future<void> registerParent(
    String email,
    String password,
    String displayName,
  ) async {
    if (config.demoMode) {
      throw AuthFailure(403, 'registration_disabled', demoRegistrationNotice);
    }
    final generation = _generation;
    if (_csrfToken == null) await csrf();
    _checkGeneration(generation);
    await _request(
      'auth/register/',
      'POST',
      data: {
        'email': email,
        'password': password,
        'role': 'parent',
        'display_name': displayName,
      },
    );
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    final generation = _generation;
    if (_csrfToken == null) await csrf();
    _checkGeneration(generation);
    final body = await _request(
      'auth/login/',
      'POST',
      data: {'email': email, 'password': password},
    );
    _checkGeneration(generation);
    final token = body.remove('csrf_token');
    if (token is! String || token.isEmpty)
      throw const FormatException('Invalid login response');
    _csrfToken = token;
    return body;
  }

  Future<Map<String, dynamic>> me() => _request('auth/me/', 'GET');

  Future<Map<String, dynamic>> get(String path, {Duration? timeout}) =>
      _request(path, 'GET', timeout: timeout);

  Future<Map<String, dynamic>> write(
    String path,
    Map<String, Object?> data, {
    String method = 'POST',
    Duration? timeout,
  }) async {
    final generation = _generation;
    if (_csrfToken == null) await csrf(timeout: timeout);
    _checkGeneration(generation);
    return _request(path, method, data: data, timeout: timeout);
  }

  Future<void> clear() async {
    invalidateRequests();
    _session = null;
    _csrfCookie = null;
    _csrfToken = null;
    // Cleanup already authorized for the current identity stays ahead of every
    // later storage read/write, even if a new restore starts immediately.
    await _store(null, storage.clear);
  }

  Future<bool> logout() async {
    invalidateRequests();
    final generation = _generation;
    try {
      if (_csrfToken == null) await csrf();
      _checkGeneration(generation);
      await _request('auth/logout/', 'POST', data: {});
      return true;
    } catch (_) {
      return false;
    } finally {
      if (generation == _generation) await clear();
    }
  }

  void close() => _transport.close();
}

// Copy never includes raw transport errors, response bodies or private data.
String loadFailureMessage(Object cause, String subject) {
  if (cause is TimeoutException) {
    return 'La carga de $subject superó el tiempo de espera. Puedes reintentar.';
  }
  if (cause is SocketException || cause is HandshakeException) {
    return 'No se pudo comunicar con el servicio. Revisa tu conexión y vuelve a intentarlo.';
  }
  if (cause is AuthFailure) {
    return 'El servicio no pudo cargar $subject. Intenta de nuevo.';
  }
  if (cause is FormatException || cause is HttpException) {
    return 'El servicio devolvió una respuesta no válida para $subject. Intenta de nuevo.';
  }
  return 'Ocurrió un error de aplicación al cargar $subject. Intenta de nuevo.';
}
