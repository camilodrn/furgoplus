import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/session_api.dart';

class MemoryStorage implements AuthStorage {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String value) async {}
  @override
  Future<void> clear() async {}
}

class FakeTransport implements AuthTransport {
  FakeTransport(this.reply);
  final AuthHttpResponse Function(Uri, String) reply;
  final calls = <String>[];
  @override
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    calls.add('$method ${uri.path}');
    return reply(uri, method);
  }

  @override
  void close() {}
}

AuthHttpResponse ok(Object value, [int status = 200]) =>
    AuthHttpResponse(status, jsonEncode(value), []);

class FakeLauncher implements DestinationLauncher {
  bool succeeds = true;
  final addresses = <String>[];
  @override
  Future<bool> open(String address) async {
    addresses.add(address);
    return succeeds;
  }
}

Map<String, dynamic> today(String state) => {
  'service_date': '2026-09-28',
  'routes': [
    {
      'route_id': 9,
      'label': 'Ruta demo',
      'start_time': '07:00',
      'end_time': '08:00',
      'seat_capacity': 3,
      'used_seats': 1,
      'available_seats': 2,
      'destination_label': 'Colegio demo',
      'destination_address': 'Av. Chile 123, Concepción',
      'roster': [
        {
          'student_display_name': 'Estudiante ficticio',
          'pickup_instruction': 'Parada sintética',
          'guardian_display_name': 'Apoderado ficticio',
          'guardian_contact': '912345678',
        },
      ],
      'run': state == 'planned' ? null : {'id': 14, 'state': state},
    },
  ],
  'unfinished_runs': [],
};

AuthController controller(FakeTransport transport, AuthState state) {
  final auth = AuthController(
    NativeSessionApi(
      ApiConfig('https://api.example.test/'),
      MemoryStorage(),
      transport: transport,
    ),
  );
  auth.state = state;
  return auth;
}

void main() {
  test('destination URL contains only encoded destination and no GPS data', () {
    final uri = destinationUri('Av. Chile 123, Concepción');
    expect(uri.scheme, 'https');
    expect(uri.host, 'www.google.com');
    expect(uri.queryParameters['destination'], 'Av. Chile 123, Concepción');
    expect(uri.queryParameters.keys, {'api', 'destination'});
  });

  testWidgets(
    'driver sees private today and only server confirmed transitions',
    (tester) async {
      var state = 'planned';
      var failStart = true;
      final launcher = FakeLauncher();
      final transport = FakeTransport((uri, method) {
        if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
        if (uri.path.endsWith('/driver/today/')) return ok(today(state));
        if (uri.path.endsWith('/routes/9/start/')) {
          if (failStart) throw const SocketException('offline');
          state = 'in_progress';
          return ok({'id': 14, 'state': state});
        }
        if (uri.path.endsWith('/runs/14/end/')) {
          state = 'completed';
          return ok({'id': 14, 'state': state});
        }
        throw StateError('Unexpected $method ${uri.path}');
      });
      await tester.pumpWidget(
        MaterialApp(
          home: DriverHome(
            auth: controller(transport, AuthState.driver),
            launcher: launcher,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Hoy en Chile: 28-09-2026'), findsOneWidget);
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      expect(find.textContaining('912345678'), findsOneWidget);
      expect(
        find.textContaining('1 usados · 2 disponibles · 3 total'),
        findsOneWidget,
      );
      await tester.ensureVisible(find.byKey(const Key('start-9')));
      await tester.tap(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsNothing);
      expect(find.byKey(const Key('driver-error')), findsOneWidget);

      launcher.succeeds = false;
      await tester.ensureVisible(find.byKey(const Key('maps-9')));
      await tester.tap(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      expect(find.textContaining('No se pudo abrir mapas'), findsOneWidget);
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      launcher.succeeds = true;
      await tester.ensureVisible(find.byKey(const Key('maps-9')));
      await tester.tap(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      expect(launcher.addresses, [
        'Av. Chile 123, Concepción',
        'Av. Chile 123, Concepción',
      ]);

      failStart = false;
      await tester.ensureVisible(find.byKey(const Key('start-9')));
      await tester.tap(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('end-14')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('end-14')));
      await tester.tap(find.byKey(const Key('end-14')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Completada'), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsNothing);
    },
  );

  testWidgets('driver logout removes roster before parent account navigation', (
    tester,
  ) async {
    var role = 'driver';
    final transport = FakeTransport((uri, method) {
      if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
      if (uri.path.endsWith('/auth/me/'))
        return ok({
          'id': role == 'driver' ? 1 : 2,
          'email': '$role@example.test',
          'role': role,
          'display_name': role,
        });
      if (uri.path.endsWith('/driver/today/')) return ok(today('planned'));
      if (uri.path.endsWith('/auth/logout/')) return ok({'ok': true});
      if (uri.path.endsWith('/auth/login/')) {
        role = 'parent';
        return ok({'csrf_token': 'new-token'});
      }
      if (uri.path.endsWith('/discovery/communes/'))
        return ok({'communes': []});
      throw StateError('Unexpected $method ${uri.path}');
    });
    await tester.pumpWidget(
      AuthApp(controller: controller(transport, AuthState.restoring)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Estudiante ficticio'), findsOneWidget);
    await tester.tap(find.text('Salir'));
    await tester.pumpAndSettle();
    expect(find.text('Estudiante ficticio'), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextField, 'Correo electrónico'),
      'parent@example.test',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Contraseña'),
      'password',
    );
    await tester.ensureVisible(find.text('Iniciar sesión'));
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();
    expect(find.text('Buscar conductores'), findsOneWidget);
    expect(find.text('Estudiante ficticio'), findsNothing);
    expect(find.byType(DriverHome), findsNothing);
  });
}
