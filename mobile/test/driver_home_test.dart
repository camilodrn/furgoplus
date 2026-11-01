import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
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
  final FutureOr<AuthHttpResponse> Function(Uri, String) reply;
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
  testWidgets(
    'Today opens native details and passenger destinations with persistent navigation',
    (tester) async {
      final transport = FakeTransport((uri, method) => ok(today('planned')));
      await mountDriver(tester, transport);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('Recorrido seleccionado'), findsOneWidget);
      expect(find.text('Colegio demo'), findsNothing);
      expect(find.text('Estudiante ficticio'), findsNothing);
      expect(find.byKey(const Key('start-9')).hitTestable(), findsOneWidget);
      await showDetails(tester);
      expect(find.text('Colegio demo'), findsOneWidget);
      expect(find.text('Estudiante ficticio'), findsNothing);
      await tapKey(tester, const Key('detail-passengers'));
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      expect(find.text('912345678'), findsNothing);
      await tapKey(tester, const Key('passenger-9-0'));
      expect(find.text('912345678'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Tu recorrido'), findsOneWidget);
      expect(find.text('912345678'), findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      expect(transport.calls.where((call) => call.startsWith('POST')), isEmpty);
    },
  );

  for (final (width, height, scale) in [
    (844.0, 390.0, 1.0),
    (844.0, 390.0, 2.0),
    (320.0, 480.0, 2.0),
  ]) {
    testWidgets(
      'journey destinations reflow at $width x $height and text $scale',
      (tester) async {
        tester.view.physicalSize = Size(width, height);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.view.resetViewInsets();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });
        await mountDriver(
          tester,
          FakeTransport((uri, method) => ok(today('planned'))),
        );
        await showDetails(tester);
        await tester.ensureVisible(find.byKey(const Key('maps-9')));
        expect(tester.takeException(), isNull);
        await showPassengers(tester);
        await tester.enterText(find.byType(TextField), 'ficticio');
        await tester.pumpAndSettle();
        await tapKey(tester, const Key('passenger-9-0'));
        expect(find.text('912345678'), findsOneWidget);
        await tester.ensureVisible(find.text('912345678'));
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(tester.takeException(), isNull);
        await showToday(tester);
        expect(find.text('912345678'), findsNothing);
        await showPassengers(tester);
        expect(find.text('912345678'), findsNothing);
      },
    );
  }

  for (final state in ['completed', 'unconfirmed']) {
    testWidgets(
      '$state does not offer a run mutation and long data remain readable',
      (tester) async {
        tester.view.physicalSize = const Size(320, 844);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });
        final payload = today(state);
        final route = (payload['routes'] as List).first;
        route['label'] =
            'Recorrido de transporte con un nombre extenso para revisión';
        route['destination_address'] =
            'Una dirección extensa de prueba para comprobar lectura completa en Android';
        final transport = FakeTransport((uri, method) => ok(payload));
        await mountDriver(tester, transport);
        expect(
          find.text(
            state == 'completed' ? 'Completada' : 'Estado por confirmar',
          ),
          findsOneWidget,
        );
        expect(find.byKey(const Key('start-9')), findsNothing);
        expect(find.byKey(const Key('end-14')), findsNothing);
        await showDetails(tester);
        await tester.ensureVisible(find.byKey(const Key('maps-9')));
        await tester.pumpAndSettle();
        expect(
          tester.getSize(find.byKey(const Key('maps-9'))).height,
          greaterThanOrEqualTo(48),
        );
        await tapKey(tester, const Key('passenger-9-0'));
        await tester.ensureVisible(find.text('912345678'));
        expect(tester.takeException(), isNull);
        expect(
          transport.calls.where((call) => call.startsWith('POST')),
          isEmpty,
        );
      },
    );
  }

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
          return ok({'id': 14, 'route_id': 9, 'state': state});
        }
        if (uri.path.endsWith('/runs/14/end/')) {
          state = 'completed';
          return ok({'id': 14, 'route_id': 9, 'state': state});
        }
        throw StateError('Unexpected $method ${uri.path}');
      });
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(
            auth: controller(transport, AuthState.driver),
            launcher: launcher,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Lunes, 28 de septiembre'), findsOneWidget);
      await showPassengers(tester);
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('passenger-9-0')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('passenger-9-0')));
      await tester.pumpAndSettle();
      expect(find.text('912345678'), findsOneWidget);
      expect(
        find.text('1 de 3 cupos ocupados · 2 disponibles'),
        findsOneWidget,
      );
      await showToday(tester);
      await tester.ensureVisible(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsNothing);
      expect(find.byKey(const Key('driver-error')), findsOneWidget);
      expect(find.text('Estado por confirmar'), findsOneWidget);

      launcher.succeeds = false;
      await showDetails(tester);
      await tester.ensureVisible(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      expect(find.textContaining('No se pudo abrir mapas'), findsOneWidget);
      await showToday(tester);
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      launcher.succeeds = true;
      await showDetails(tester);
      await tester.ensureVisible(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      expect(launcher.addresses, [
        'Av. Chile 123, Concepción',
        'Av. Chile 123, Concepción',
      ]);

      expect(transport.calls.where((c) => c.endsWith('/start/')).length, 1);
      failStart = false;
      await showToday(tester);
      await tester.ensureVisible(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      await showToday(tester);
      await tester.ensureVisible(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      expect(transport.calls.where((c) => c.endsWith('/start/')).length, 1);
      await showToday(tester);
      await tester.ensureVisible(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('start-9')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('end-14')), findsOneWidget);
      await tester.ensureVisible(find.byKey(const Key('end-14')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('end-14')));
      await tester.pumpAndSettle();
      expect(transport.calls.where((c) => c.endsWith('/end/')), isEmpty);
      await tester.tap(find.byKey(const Key('confirm-end')));
      await tester.pumpAndSettle();
      expect(find.textContaining('Completada'), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsNothing);
      expect(transport.calls.where((c) => c.endsWith('/end/')).length, 1);
    },
  );

  for (final (date, label) in [
    ('2026-10-07', 'Miércoles, 7 de octubre'),
    ('2024-02-29', 'Jueves, 29 de febrero'),
    ('2026-12-31', 'Jueves, 31 de diciembre'),
    ('2027-01-01', 'Viernes, 1 de enero'),
  ]) {
    testWidgets('daily date uses server calendar date $date in Spanish', (
      tester,
    ) async {
      final payload = today('planned')..['service_date'] = date;
      await mountDriver(tester, FakeTransport((uri, method) => ok(payload)));
      expect(find.text(label), findsOneWidget);
      expect(find.textContaining('Hoy en Chile'), findsNothing);
    });
  }

  testWidgets('maps stays accessible and functional without helper copy', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final launcher = FakeLauncher();
    await mountDriver(
      tester,
      FakeTransport((uri, method) => ok(today('planned'))),
      launcher: launcher,
    );
    expect(
      find.text('El destino se compartirá con la aplicación de mapas.'),
      findsNothing,
    );
    await showDetails(tester);
    final maps = find.byKey(const Key('maps-9'));
    await tester.ensureVisible(maps);
    await tester.pumpAndSettle();
    expect(
      tester.getSemantics(maps),
      isSemantics(
        label: 'Abrir en mapas',
        isButton: true,
        isEnabled: true,
        hasTapAction: true,
      ),
    );
    await tester.tap(maps);
    await tester.pumpAndSettle();
    expect(launcher.addresses, ['Av. Chile 123, Concepción']);
    expect(find.textContaining('No se pudo abrir mapas'), findsNothing);
    semantics.dispose();
  });

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
      if (uri.path.endsWith('/discovery/drivers/')) return ok({'results': []});
      if (uri.path.endsWith('/parent/profile/'))
        return ok({'display_name': 'parent', 'email': 'parent@example.test'});
      throw StateError('Unexpected $method ${uri.path}');
    });
    await tester.pumpWidget(
      AuthApp(controller: controller(transport, AuthState.restoring)),
    );
    await tester.pumpAndSettle();
    await showPassengers(tester);
    expect(find.text('Estudiante ficticio'), findsOneWidget);
    await tester.tap(find.byKey(const Key('open-driver-account')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cerrar sesión'));
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
    await tester.pumpAndSettle();
    await tester.tap(find.text('Iniciar sesión'));
    await tester.pumpAndSettle();
    expect(
      find.widgetWithText(NavigationDestination, 'Buscar'),
      findsOneWidget,
    );
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      0,
    );
    expect(find.text('Estudiante ficticio'), findsNothing);
    expect(find.byType(DriverHome), findsNothing);
    await tester.tap(find.byKey(const Key('open-parent-account')));
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      0,
    );
    expect(find.text('parent@example.test'), findsOneWidget);
    expect(find.text('Estudiante ficticio'), findsNothing);
    expect(find.byType(DriverHome), findsNothing);
  });

  for (final state in ['planned', 'in_progress', 'completed']) {
    testWidgets('daily hero and valid primary action: $state', (tester) async {
      final transport = FakeTransport((uri, method) => ok(today(state)));
      await mountDriver(tester, transport);
      expect(find.widgetWithText(NavigationDestination, 'Hoy'), findsOneWidget);
      expect(
        find.text(switch (state) {
          'planned' => 'Planificada',
          'in_progress' => 'En curso',
          _ => 'Completada',
        }),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('start-9')),
        state == 'planned' ? findsOneWidget : findsNothing,
      );
      expect(
        find.byKey(const Key('end-14')),
        state == 'in_progress' ? findsOneWidget : findsNothing,
      );
      expect(find.text('1 pasajero asignado'), findsOneWidget);
      await showPassengers(tester);
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      expect(find.text('Parada sintética'), findsOneWidget);
      expect(find.text('912345678'), findsNothing);
    });
  }

  testWidgets('no service is calm and distinct from loading and read failure', (
    tester,
  ) async {
    final firstRead = Completer<AuthHttpResponse>();
    var read = 0;
    final transport = FakeTransport((uri, method) {
      read++;
      if (read == 1) return firstRead.future;
      if (read == 2) throw const SocketException('private raw error');
      return ok({
        'service_date': '2026-09-28',
        'routes': [],
        'unfinished_runs': [],
      });
    });
    await tester.pumpWidget(
      MaterialApp(
        theme: furgoTheme(),
        home: DriverHome(auth: controller(transport, AuthState.driver)),
      ),
    );
    await tester.pump();
    expect(find.text('Consultando tus servicios…'), findsOneWidget);
    expect(find.text('Sin servicio para hoy'), findsNothing);
    firstRead.complete(ok({}, 503));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('driver-error')), findsOneWidget);
    expect(find.text('Sin servicio para hoy'), findsNothing);
    await tapKey(tester, const Key('reload-today'));
    expect(find.textContaining('Revisa tu conexión'), findsOneWidget);
    expect(find.textContaining('private raw error'), findsNothing);
    await tapKey(tester, const Key('reload-today'));
    expect(find.text('Sin servicio para hoy'), findsOneWidget);
    expect(find.byKey(const Key('driver-error')), findsNothing);
    expect(find.text('Consultar guías'), findsOneWidget);
    expect(find.text('¿Esperabas un recorrido?'), findsOneWidget);
    expect(transport.calls.every((c) => c.startsWith('GET ')), isTrue);
  });

  testWidgets(
    'capacity has human readable semantics without textual progress value',
    (tester) async {
      final semantics = tester.ensureSemantics();
      await mountDriver(
        tester,
        FakeTransport((uri, method) => ok(today('planned'))),
      );
      await tester.ensureVisible(find.byKey(const Key('driver-capacity')));
      await tester.pump();
      final node = tester.getSemantics(
        find.byKey(const Key('driver-capacity')),
      );
      expect(node.label, 'Capacidad: 1 ocupado · 2 disponibles · 3 total');
      expect(node.value, isEmpty);
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets(
    'pending start is single flight and success follows server state',
    (tester) async {
      final write = Completer<AuthHttpResponse>();
      var state = 'planned';
      final transport = FakeTransport((uri, method) {
        if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
        if (method == 'POST') return write.future;
        return ok(today(state));
      });
      await mountDriver(tester, transport);
      final action = tester
          .widget<FilledButton>(find.byKey(const Key('start-9')))
          .onPressed!;
      action();
      action();
      await tester.pump();
      expect(transport.calls.where((c) => c.endsWith('/start/')).length, 1);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('start-9'))).onPressed,
        isNull,
      );
      expect(find.byKey(const Key('end-14')), findsNothing);
      state = 'in_progress';
      write.complete(ok({'id': 14, 'route_id': 9, 'state': state}));
      await tester.pumpAndSettle();
      expect(find.text('En curso'), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsOneWidget);
      expect(transport.calls.where((c) => c.endsWith('/start/')).length, 1);
    },
  );

  testWidgets(
    'confirmed write remains authoritative when follow-up read fails',
    (tester) async {
      var reads = 0;
      final transport = FakeTransport((uri, method) {
        if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
        if (method == 'POST')
          return ok({'id': 14, 'route_id': 9, 'state': 'in_progress'});
        if (++reads > 1) throw const SocketException('offline');
        return ok(today('planned'));
      });
      await mountDriver(tester, transport);
      await tapKey(tester, const Key('start-9'));
      expect(find.text('En curso'), findsOneWidget);
      expect(find.textContaining('El cambio se confirmó'), findsOneWidget);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('end-14'))).onPressed,
        isNull,
      );
      await showToday(tester);
      await tester.ensureVisible(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      expect(transport.calls.where((c) => c.startsWith('POST ')).length, 1);
    },
  );

  testWidgets(
    'end cancellation is harmless and failed end requires safe read',
    (tester) async {
      final transport = FakeTransport((uri, method) {
        if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
        if (method == 'POST')
          return ok({
            'code': 'run_conflict',
            'message': 'raw backend detail',
          }, 409);
        return ok(today('in_progress'));
      });
      await mountDriver(tester, transport);
      await tapKey(tester, const Key('end-14'));
      await tester.tap(find.text('Seguir en curso'));
      await tester.pumpAndSettle();
      expect(transport.calls.where((c) => c.startsWith('POST ')), isEmpty);
      await tapKey(tester, const Key('end-14'));
      await tester.tap(find.byKey(const Key('confirm-end')));
      await tester.pumpAndSettle();
      expect(find.text('Estado por confirmar'), findsOneWidget);
      expect(find.textContaining('raw backend detail'), findsNothing);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('end-14'))).onPressed,
        isNull,
      );
      await showToday(tester);
      await tester.ensureVisible(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Actualizar estado'));
      await tester.pumpAndSettle();
      expect(find.text('En curso'), findsOneWidget);
      expect(transport.calls.where((c) => c.endsWith('/end/')).length, 1);
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('end-14'))).onPressed,
        isNotNull,
      );
    },
  );

  testWidgets('empty destination has no map action', (tester) async {
    final payload = today('planned');
    (payload['routes'] as List).first['destination_address'] = '   ';
    await mountDriver(tester, FakeTransport((uri, method) => ok(payload)));
    await showDetails(tester);
    expect(find.byKey(const Key('maps-9')), findsNothing);
  });

  testWidgets(
    'in progress route leads and other routes retain separate rosters',
    (tester) async {
      final payload = today('planned');
      final second = {
        ...(today('in_progress')['routes'] as List).first
            as Map<String, dynamic>,
        'route_id': 10,
        'label': 'Ruta en curso',
        'roster': <Map<String, dynamic>>[],
      };
      (payload['routes'] as List).add(second);
      await mountDriver(tester, FakeTransport((uri, method) => ok(payload)));
      expect(find.text('Ruta en curso'), findsOneWidget);
      expect(find.byKey(const Key('end-14')), findsOneWidget);
      expect(find.text('Estudiante ficticio'), findsNothing);
      await tapKey(tester, const Key('other-routes'));
      await tapKey(tester, const Key('select-route-9'));
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      await showPassengers(tester);
      expect(find.text('Estudiante ficticio'), findsOneWidget);
    },
  );

  testWidgets(
    'previous unfinished service stays recoverable on no-service day',
    (tester) async {
      var done = false;
      final transport = FakeTransport((uri, method) {
        if (uri.path.endsWith('/auth/csrf/')) return ok({'csrf_token': 'test'});
        if (method == 'POST') {
          done = true;
          return ok({'id': 20, 'route_id': 9, 'state': 'completed'});
        }
        return ok({
          'service_date': '2026-09-28',
          'routes': [],
          'unfinished_runs': [
            if (!done)
              {
                'id': 20,
                'label': 'Ruta pendiente',
                'service_date': '2026-09-25',
                'start_time': '07:00',
                'end_time': '08:00',
                'state': 'in_progress',
              },
          ],
        });
      });
      await mountDriver(tester, transport);
      expect(find.text('Sin servicio para hoy'), findsOneWidget);
      await tapKey(tester, const Key('unfinished-runs'));
      await tapKey(tester, const Key('recover-20'));
      await tester.tap(find.byKey(const Key('confirm-end')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('unfinished-runs')), findsNothing);
      expect(
        transport.calls.where((c) => c.endsWith('/runs/20/end/')).length,
        1,
      );
    },
  );

  for (final mutation in [false, true]) {
    testWidgets(
      'auth failure clears roster and central session (mutation: $mutation)',
      (tester) async {
        var expired = false;
        final transport = FakeTransport((uri, method) {
          if (uri.path.endsWith('/auth/csrf/'))
            return ok({'csrf_token': 'test'});
          if (expired)
            return ok({
              'code': 'not_authenticated',
              'message': 'private raw message',
            }, 403);
          return ok(today('planned'));
        });
        final auth = await mountDriver(tester, transport);
        expired = true;
        await tapKey(tester, Key(mutation ? 'start-9' : 'reload-today'));
        expect(auth.state, AuthState.signedOut);
        expect(find.text('Estudiante ficticio'), findsNothing);
        expect(find.byKey(const Key('today-route-9')), findsNothing);
        expect(find.textContaining('private raw message'), findsNothing);
      },
    );
  }

  for (final lateKind in [
    'read',
    'write',
    'auth failure',
    'maps',
    'confirmation',
  ]) {
    testWidgets(
      'same-role replacement rejects old $lateKind and clears disclosures',
      (tester) async {
        final late = Completer<AuthHttpResponse>();
        final map = DeferredLauncher();
        var account = 'A';
        var defer = false;
        final transport = FakeTransport((uri, method) {
          if (uri.path.endsWith('/auth/csrf/'))
            return ok({'csrf_token': 'test'});
          if (uri.path.endsWith('/auth/login/')) {
            account = 'B';
            return ok({'csrf_token': 'b-token'});
          }
          if (uri.path.endsWith('/auth/me/'))
            return ok({
              'id': 2,
              'email': 'b@example.test',
              'role': 'driver',
              'display_name': 'Driver B',
            });
          if (defer && account == 'A') return late.future;
          final payload = today(
            lateKind == 'confirmation' && account == 'A'
                ? 'in_progress'
                : 'planned',
          );
          final route = (payload['routes'] as List).first;
          route['label'] = 'Ruta $account';
          route['roster'][0]['student_display_name'] = 'Pasajero $account';
          return ok(payload);
        });
        final auth = await mountDriver(tester, transport, launcher: map);
        await tapKey(tester, const Key('passenger-9-0'));
        expect(find.text('912345678'), findsOneWidget);
        await auth.api.csrf();
        defer = true;
        if (lateKind == 'maps') {
          await showDetails(tester);
          await tester.ensureVisible(find.byKey(const Key('maps-9')));
          await tester.pumpAndSettle();
          await tester.tap(find.byKey(const Key('maps-9')));
          await tester.pump();
        } else if (lateKind == 'confirmation') {
          await tapKey(tester, const Key('end-14'));
          expect(find.textContaining('Ruta A quedará'), findsOneWidget);
        } else {
          await showToday(tester);
          await tester.ensureVisible(
            find.byKey(Key(lateKind == 'write' ? 'start-9' : 'reload-today')),
          );
          await tester.pumpAndSettle();
          await tester.tap(
            find.byKey(Key(lateKind == 'write' ? 'start-9' : 'reload-today')),
          );
          await tester.pump();
        }
        await auth.login('b@example.test', 'synthetic');
        await tester.pumpAndSettle();
        expect(find.text('Pasajero A'), findsNothing);
        expect(find.text('Ruta A'), findsNothing);
        expect(find.textContaining('Ruta A quedará'), findsNothing);
        expect(find.text('912345678'), findsNothing);
        expect(find.text('Pasajero B'), findsNothing);
        expect(find.text('Ruta B'), findsOneWidget);
        final readCount = transport.calls
            .where((c) => c.endsWith('/driver/today/'))
            .length;
        if (lateKind == 'maps') {
          map.completion.complete(false);
        } else if (lateKind != 'confirmation') {
          late.complete(
            lateKind == 'auth failure'
                ? ok({
                    'code': 'not_authenticated',
                    'message': 'old expiry',
                  }, 403)
                : lateKind == 'write'
                ? ok({'id': 14, 'route_id': 9, 'state': 'in_progress'})
                : ok(today('completed')),
          );
        }
        await tester.pumpAndSettle();
        expect(auth.state, AuthState.driver);
        expect(auth.email, 'b@example.test');
        expect(find.text('Pasajero B'), findsNothing);
        expect(find.text('Ruta B'), findsOneWidget);
        expect(find.text('Pasajero A'), findsNothing);
        expect(find.byKey(const Key('start-9')), findsOneWidget);
        expect(find.byKey(const Key('driver-error')), findsNothing);
        expect(find.textContaining('No se pudo abrir mapas'), findsNothing);
        expect(
          transport.calls.where((c) => c.endsWith('/driver/today/')).length,
          readCount,
        );
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'controller replacement clears old roster and rejects late map feedback',
    (tester) async {
      final map = DeferredLauncher();
      final first = FakeTransport((uri, method) => ok(today('planned')));
      await mountDriver(tester, first, launcher: map);
      await showDetails(tester);
      await tester.ensureVisible(find.byKey(const Key('maps-9')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('maps-9')));
      await tester.pump();
      final payload = today('completed');
      (payload['routes'] as List).first['roster'] = <Map<String, dynamic>>[];
      final replacement = controller(
        FakeTransport((uri, method) => ok(payload)),
        AuthState.driver,
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: replacement, launcher: map),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Estudiante ficticio'), findsNothing);
      expect(find.text('Completada'), findsOneWidget);
      map.completion.complete(false);
      await tester.pumpAndSettle();
      expect(find.textContaining('No se pudo abrir mapas'), findsNothing);
      expect(find.text('Completada'), findsOneWidget);
    },
  );

  for (final mutation in [false, true]) {
    testWidgets(
      'logout rejects pending driver response (mutation: $mutation)',
      (tester) async {
        final late = Completer<AuthHttpResponse>();
        var defer = false;
        final transport = FakeTransport((uri, method) {
          if (uri.path.endsWith('/auth/csrf/'))
            return ok({'csrf_token': 'test'});
          if (uri.path.endsWith('/auth/logout/')) return ok({'ok': true});
          if (defer) return late.future;
          return ok(today('planned'));
        });
        final auth = await mountDriver(tester, transport);
        await auth.api.csrf();
        defer = true;
        await tester.tap(
          find.byKey(Key(mutation ? 'start-9' : 'reload-today')),
        );
        await tester.pump();
        await auth.logout();
        await tester.pumpAndSettle();
        expect(find.text('Estudiante ficticio'), findsNothing);
        expect(find.byKey(const Key('today-route-9')), findsNothing);
        final reads = transport.calls
            .where((c) => c.endsWith('/driver/today/'))
            .length;
        late.complete(
          ok(
            mutation
                ? {'id': 14, 'route_id': 9, 'state': 'in_progress'}
                : today('in_progress'),
          ),
        );
        await tester.pumpAndSettle();
        expect(auth.state, AuthState.signedOut);
        expect(find.text('Estudiante ficticio'), findsNothing);
        expect(find.byKey(const Key('driver-error')), findsNothing);
        expect(
          transport.calls.where((c) => c.endsWith('/driver/today/')).length,
          reads,
        );
      },
    );
  }

  for (final (width, scale) in [(390.0, 1.0), (390.0, 2.0), (320.0, 2.0)]) {
    testWidgets(
      '${width}x844 actions and roster stay reachable at text scale $scale',
      (tester) async {
        tester.view.physicalSize = Size(width, 844);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = scale;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });
        await mountDriver(
          tester,
          FakeTransport((uri, method) => ok(today('in_progress'))),
        );
        expect(
          tester.getSize(find.byKey(const Key('open-driver-account'))).height,
          greaterThanOrEqualTo(48),
        );
        await tester.ensureVisible(find.byKey(const Key('end-14')));
        expect(
          tester.getSize(find.byKey(const Key('end-14'))).height,
          greaterThanOrEqualTo(56),
        );
        await tapKey(tester, const Key('end-14'));
        await tester.ensureVisible(find.byKey(const Key('confirm-end')));
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Seguir en curso'));
        await tester.pumpAndSettle();
        await tapKey(tester, const Key('passenger-9-0'));
        await tester.ensureVisible(find.text('912345678'));
        expect(tester.takeException(), isNull);
        expect(
          find.byWidgetPredicate(
            (widget) =>
                widget is Scrollable &&
                widget.axisDirection == AxisDirection.down,
          ),
          findsOneWidget,
        );
      },
    );
  }
}

class DeferredLauncher implements DestinationLauncher {
  final completion = Completer<bool>();
  @override
  Future<bool> open(String address) => completion.future;
}

Future<AuthController> mountDriver(
  WidgetTester tester,
  FakeTransport transport, {
  DestinationLauncher? launcher,
}) async {
  final auth = controller(transport, AuthState.driver);
  await tester.pumpWidget(
    MaterialApp(
      theme: furgoTheme(),
      home: DriverHome(auth: auth, launcher: launcher),
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

Future<void> showToday(WidgetTester tester) async {
  if (find.byKey(const Key('journey-back')).evaluate().isNotEmpty) {
    await tester.tap(find.byKey(const Key('journey-back')));
    await tester.pumpAndSettle();
  }
}

Future<void> showDetails(WidgetTester tester) async {
  if (find.byKey(const Key('maps-9')).evaluate().isNotEmpty ||
      find.text('Tu recorrido').evaluate().isNotEmpty)
    return;
  await showToday(tester);
  await tapKey(tester, const Key('journey-details'));
}

Future<void> showPassengers(WidgetTester tester) async {
  if (find.byType(DriverTodayPassengers).evaluate().isNotEmpty) return;
  await showToday(tester);
  await tapKey(tester, const Key('journey-passengers'));
}

Future<void> tapKey(WidgetTester tester, Key key) async {
  if (key.toString().contains('passenger-') &&
      find.byKey(key).evaluate().isEmpty)
    await showPassengers(tester);
  if ((key.toString().contains('start-') ||
          key.toString().contains('end-') ||
          key.toString().contains('reload-today')) &&
      find.byKey(key).evaluate().isEmpty)
    await showToday(tester);
  await tester.ensureVisible(find.byKey(key));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(key));
  await tester.pumpAndSettle();
}
