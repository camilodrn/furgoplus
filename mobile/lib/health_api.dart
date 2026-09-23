import 'dart:convert';
import 'dart:io';

import 'api_config.dart';

abstract interface class HealthApi {
  Future<void> check();
}

abstract interface class HealthTransport {
  Future<HealthHttpResponse> get(Uri uri);
  void close();
}

class HealthHttpResponse {
  HealthHttpResponse(this.statusCode, this.body);

  final int statusCode;
  final Stream<List<int>> body;
}

class IoHealthTransport implements HealthTransport {
  IoHealthTransport() : _client = HttpClient();

  final HttpClient _client;

  @override
  Future<HealthHttpResponse> get(Uri uri) async {
    final request = await _client.getUrl(uri);
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    request.followRedirects = false;
    final response = await request.close();
    return HealthHttpResponse(response.statusCode, response);
  }

  @override
  void close() => _client.close();
}

class HttpHealthApi implements HealthApi {
  HttpHealthApi(this.config, {HealthTransport? transport})
    : _transport = transport ?? IoHealthTransport();

  final ApiConfig config;
  final HealthTransport _transport;

  @override
  Future<void> check() async {
    final response = await _transport.get(config.endpoint('api/v1/health/'));
    if (response.statusCode != HttpStatus.ok) {
      await response.body.drain<void>();
      throw HttpException('Health request failed: ${response.statusCode}');
    }
    final body = jsonDecode(await utf8.decoder.bind(response.body).join());
    if (body is! Map<String, dynamic> || body['status'] != 'ok') {
      throw const FormatException('Invalid health response');
    }
  }

  void close() => _transport.close();
}
