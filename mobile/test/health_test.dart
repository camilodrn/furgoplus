import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/health_api.dart';
import 'package:furgoplus/health_controller.dart';
import 'package:furgoplus/main.dart';

class FakeHealthApi implements HealthApi {
  FakeHealthApi(this.result);
  final Future<void> Function() result;

  @override
  Future<void> check() => result();
}

class FakeHealthTransport implements HealthTransport {
  FakeHealthTransport(this.response);

  final HealthHttpResponse response;
  Uri? requestedUri;

  @override
  Future<HealthHttpResponse> get(Uri uri) async {
    requestedUri = uri;
    return response;
  }

  @override
  void close() {}
}

HealthHttpResponse fakeResponse(int statusCode, String body) =>
    HealthHttpResponse(statusCode, Stream.value(utf8.encode(body)));

void main() {
  test('configuration validates origin and builds health URL', () {
    final config = ApiConfig('https://api.example.test');
    expect(
      config.endpoint('api/v1/health/').toString(),
      'https://api.example.test/api/v1/health/',
    );
    expect(() => ApiConfig(''), throwsFormatException);
    expect(() => ApiConfig('http://api.example.test'), throwsFormatException);
    expect(
      ApiConfig(
        'http://api.example.test',
        allowHttpForDevelopment: true,
      ).baseUri.scheme,
      'http',
    );
    expect(
      () => ApiConfig('https://api.example.test/path'),
      throwsFormatException,
    );
  });

  test('health API calls the configured health endpoint', () async {
    final transport = FakeHealthTransport(
      fakeResponse(200, jsonEncode({'status': 'ok'})),
    );
    final api = HttpHealthApi(
      ApiConfig('https://api.example.test'),
      transport: transport,
    );
    await api.check();
    expect(
      transport.requestedUri.toString(),
      'https://api.example.test/api/v1/health/',
    );
    api.close();
  });

  test('health API rejects failed and invalid health responses', () async {
    final config = ApiConfig('https://api.example.test');
    final failed = HttpHealthApi(
      config,
      transport: FakeHealthTransport(fakeResponse(503, 'unavailable')),
    );
    await expectLater(failed.check(), throwsA(isA<HttpException>()));
    final invalid = HttpHealthApi(
      config,
      transport: FakeHealthTransport(fakeResponse(200, '{"status":"down"}')),
    );
    await expectLater(invalid.check(), throwsFormatException);
  });

  testWidgets('health screen shows loading and success', (tester) async {
    final completer = Completer<void>();
    final controller = HealthController(FakeHealthApi(() => completer.future));
    await tester.pumpWidget(FurgoPlusApp(controller: controller));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    completer.complete();
    await tester.pumpAndSettle();
    expect(find.text('La API responde correctamente.'), findsOneWidget);
  });

  testWidgets('health screen shows error and retry', (tester) async {
    var calls = 0;
    final controller = HealthController(
      FakeHealthApi(() async {
        calls++;
        if (calls == 1) throw const SocketException('offline');
      }),
    );
    await tester.pumpWidget(FurgoPlusApp(controller: controller));
    await tester.pumpAndSettle();
    expect(find.text('No se pudo conectar con la API.'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(find.text('La API responde correctamente.'), findsOneWidget);
  });
}
