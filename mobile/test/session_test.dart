import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/session_api.dart';

class MemoryStorage implements AuthStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async {
    this.value = value;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

class Call {
  Call(this.uri, this.method, this.headers, this.body);
  final Uri uri;
  final String method;
  final Map<String, String> headers;
  final String? body;
}

class FakeTransport implements AuthTransport {
  final responses = <AuthHttpResponse>[];
  final calls = <Call>[];
  @override
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    calls.add(Call(uri, method, headers, body));
    if (responses.isEmpty) throw const SocketException('offline');
    return responses.removeAt(0);
  }

  @override
  void close() {}
}

class ProbeStop implements Exception {}

class ProbeHeaders implements HttpHeaders {
  final values = <String, Object>{};
  @override
  int contentLength = -1;
  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {
    values[name.toLowerCase()] = value;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class ProbeRequest implements HttpClientRequest {
  @override
  final HttpHeaders headers = ProbeHeaders();
  final bytes = <int>[];
  @override
  bool followRedirects = true;

  @override
  void add(List<int> data) => bytes.addAll(data);

  @override
  void write(Object? object) => bytes.addAll(utf8.encode('$object'));

  @override
  Future<HttpClientResponse> close() async => throw ProbeStop();

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class ProbeClient implements HttpClient {
  final request = ProbeRequest();

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async => request;

  @override
  void close({bool force = false}) {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

AuthHttpResponse reply(
  int status,
  Map<String, Object?> body, [
  List<String> cookies = const [],
]) => AuthHttpResponse(status, jsonEncode(body), cookies);

void main() {
  final config = ApiConfig('https://api.example.test');
  const csrf = 'masked-csrf-token';
  const csrfCookie = 'csrftoken=secret; Path=/; Secure; HttpOnly; SameSite=Lax';
  const sessionCookie =
      'sessionid=opaque-session; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax';
  final identity = <String, Object?>{
    'id': 9,
    'email': 'sample@example.test',
    'role': 'driver',
    'display_name': 'Sample',
  };

  test('native POST sends complete UTF-8 JSON with a content length', () async {
    final client = ProbeClient();
    final body = jsonEncode({
      'email': 'parent@example.test',
      'password': 'Synthetic-Password',
      'display_name': 'Apoderado Ñuñoa',
    });
    final transport = IoAuthTransport(client: client);
    try {
      await expectLater(
        transport.send(
          Uri.parse('https://api.example.test/api/v1/auth/register/'),
          'POST',
          headers: {'Content-Type': 'application/json'},
          body: body,
        ),
        throwsA(isA<ProbeStop>()),
      );
      expect(client.request.followRedirects, isFalse);
      expect(
        (client.request.headers as ProbeHeaders).values['content-type'],
        'application/json',
      );
      expect(client.request.headers.contentLength, utf8.encode(body).length);
      expect(client.request.bytes, utf8.encode(body));
    } finally {
      transport.close();
    }
  });

  test('parent domain writes reuse session CSRF adapter and origin', () async {
    final transport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(201, {'id': 7, 'status': 'pending'}),
      ]);
    final api = NativeSessionApi(config, MemoryStorage(), transport: transport);
    final result = await api.write('parent/contact-requests/', {
      'driver_id': 1,
      'message': 'Consulta sintética',
      'consent_share_email': true,
    });
    expect(result['status'], 'pending');
    final call = transport.calls.last;
    expect(
      call.uri.toString(),
      'https://api.example.test/api/v1/parent/contact-requests/',
    );
    expect(call.headers['X-CSRFToken'], csrf);
    expect(call.headers['Origin'], 'https://api.example.test');
  });

  test('main Android manifest permits network access and disables backup', () {
    final manifest = File(
      'android/app/src/main/AndroidManifest.xml',
    ).readAsStringSync();
    expect(manifest, contains('android.permission.INTERNET'));
    expect(manifest, contains('android:allowBackup="false"'));
  });

  test('bootstrap, login rotation, persistence, restore and logout', () async {
    final storage = MemoryStorage();
    final transport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(
          200,
          {...identity, 'csrf_token': 'rotated'},
          [sessionCookie, csrfCookie],
        ),
        reply(200, identity),
      ]);
    final api = NativeSessionApi(config, storage, transport: transport);
    await api.csrf();
    await api.login('sample@example.test', 'Synthetic-Password');
    expect((await api.me())['role'], 'driver');
    expect(transport.calls[1].headers['Origin'], config.baseUri.origin);
    expect(transport.calls[1].headers['X-CSRFToken'], csrf);
    expect(transport.calls[1].headers['Cookie'], 'csrftoken=secret');
    expect(
      transport.calls[2].headers['Cookie'],
      contains('sessionid=opaque-session'),
    );
    expect(storage.value, contains('opaque-session'));
    expect(storage.value, isNot(contains('secret')));
    expect(storage.value, isNot(contains('rotated')));

    final restarted = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': 'fresh'}, [csrfCookie]),
        reply(200, identity),
        reply(200, {'ok': true}, ['sessionid=; Path=/; Max-Age=0']),
        reply(403, {
          'code': 'not_authenticated',
          'message': 'Authentication credentials were not provided.',
        }),
      ]);
    final restored = NativeSessionApi(config, storage, transport: restarted);
    await restored.restoreCookies();
    await restored.csrf();
    expect((await restored.me())['id'], 9);
    expect(
      restarted.calls[0].headers['Cookie'],
      contains('sessionid=opaque-session'),
    );
    expect(await restored.logout(), isTrue);
    expect(storage.value, isNull);
    try {
      await restored.me();
      fail('session must be invalid');
    } on AuthFailure catch (error) {
      expect(error.code, 'not_authenticated');
    }
    expect(
      restarted.calls.last.headers['Cookie'],
      isNot(contains('sessionid=')),
    );
  });

  test(
    'rejects cross-origin redirects, alien cookies and expired persisted state',
    () async {
      final storage = MemoryStorage();
      final transport = FakeTransport()
        ..responses.add(
          reply(302, {}, [
            'sessionid=alien; Domain=evil.example; Path=/; Secure',
            'sessionid=wrong-path; Path=/other; Secure',
            sessionCookie,
          ]),
        );
      final api = NativeSessionApi(config, storage, transport: transport);
      await expectLater(api.csrf(), throwsA(isA<HttpException>()));
      expect(storage.value, isNull);
      expect(transport.calls.single.uri.host, 'api.example.test');
      storage.value = jsonEncode(
        SessionCookie(
          'stale',
          'api.example.test',
          DateTime.now().toUtc().subtract(const Duration(seconds: 1)),
          true,
        ).toJson(),
      );
      await api.restoreCookies();
      expect(storage.value, isNull);
      storage.value = jsonEncode(
        SessionCookie(
          'insecure',
          'api.example.test',
          DateTime.now().toUtc().add(const Duration(hours: 1)),
          false,
        ).toJson(),
      );
      await api.restoreCookies();
      expect(storage.value, isNull);
    },
  );

  test('confirmed expiry and unreachable logout clear local cookie', () async {
    final storage = MemoryStorage();
    storage.value = jsonEncode(
      SessionCookie(
        'opaque',
        'api.example.test',
        DateTime.now().toUtc().add(const Duration(hours: 1)),
        true,
      ).toJson(),
    );
    final transport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(403, {'code': 'not_authenticated', 'message': 'Expired'}),
      ]);
    final controller = AuthController(
      NativeSessionApi(config, storage, transport: transport),
    );
    await controller.restore();
    expect(controller.state, AuthState.signedOut);
    expect(storage.value, isNull);

    storage.value = jsonEncode(
      SessionCookie(
        'opaque',
        'api.example.test',
        DateTime.now().toUtc().add(const Duration(hours: 1)),
        true,
      ).toJson(),
    );
    final unreachable = NativeSessionApi(
      config,
      storage,
      transport: FakeTransport(),
    );
    await unreachable.restoreCookies();
    expect(await unreachable.logout(), isFalse);
    expect(storage.value, isNull);
  });

  testWidgets('admin role has unsupported mobile shell', (tester) async {
    final transport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(200, {...identity, 'role': 'admin'}),
      ]);
    final controller = AuthController(
      NativeSessionApi(config, MemoryStorage(), transport: transport),
    );
    await tester.pumpWidget(AuthApp(controller: controller));
    await tester.pumpAndSettle();
    expect(
      find.text('Esta cuenta no está disponible en móvil'),
      findsOneWidget,
    );
    expect(find.text('Inicio para conductores'), findsNothing);
  });

  testWidgets('parent role lands on discovery while driver keeps driver home', (
    tester,
  ) async {
    final parentTransport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(200, {...identity, 'role': 'parent'}),
        reply(200, {'communes': []}),
      ]);
    final parentController = AuthController(
      NativeSessionApi(config, MemoryStorage(), transport: parentTransport),
    );
    await tester.pumpWidget(
      AuthApp(key: const ValueKey('parent-app'), controller: parentController),
    );
    await tester.pumpAndSettle();
    expect(find.text('Buscar'), findsOneWidget);
    expect(find.text('Solicitudes'), findsOneWidget);
    final driverTransport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(200, identity),
        reply(200, {
          'service_date': '2026-09-28',
          'routes': [],
          'unfinished_runs': [],
        }),
      ]);
    await tester.pumpWidget(
      AuthApp(
        key: const ValueKey('driver-app'),
        controller: AuthController(
          NativeSessionApi(config, MemoryStorage(), transport: driverTransport),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('FurgoPlus · Conductor'), findsOneWidget);
    expect(find.text('Hoy en Chile: 28-09-2026'), findsOneWidget);
    expect(find.text('No hay rutas programadas para hoy.'), findsOneWidget);
  });

  testWidgets('login sends entered password unchanged before clearing field', (
    tester,
  ) async {
    final transport = FakeTransport()
      ..responses.addAll([
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(403, {'code': 'not_authenticated', 'message': 'Signed out'}),
        reply(200, {'csrf_token': csrf}, [csrfCookie]),
        reply(
          200,
          {...identity, 'csrf_token': 'rotated'},
          [sessionCookie, csrfCookie],
        ),
        reply(200, identity),
      ]);
    final controller = AuthController(
      NativeSessionApi(config, MemoryStorage(), transport: transport),
    );
    await tester.pumpWidget(AuthApp(controller: controller));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Correo'),
      'sample@example.test',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Contraseña'),
      'Synthetic-Password-781!',
    );
    final passwordField = tester.widget<TextField>(
      find.widgetWithText(TextField, 'Contraseña'),
    );
    await tester.tap(find.text('Entrar'));
    expect(passwordField.controller!.text, isEmpty);
    await tester.pumpAndSettle();
    final login = transport.calls.singleWhere(
      (call) => call.uri.path.endsWith('/login/'),
    );
    expect(jsonDecode(login.body!)['password'], 'Synthetic-Password-781!');
    expect(controller.state, AuthState.driver);
  });
}
