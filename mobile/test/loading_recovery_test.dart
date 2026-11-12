import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/session_api.dart';

import 'driver_home_test.dart' as fixture;
import 'session_test.dart' as session;

class HangingStorage extends session.MemoryStorage {
  final pending = Completer<String?>();
  @override
  Future<String?> read() => pending.future;
}

void main() {
  for (final login in [false, true]) {
    testWidgets(
      'malformed identity exits loading before session generation changes (login: $login)',
      (tester) async {
        final transport = session.FakeTransport()
          ..responses.addAll([
            session.reply(200, {'csrf_token': 'token'}),
            if (login) session.reply(200, {'csrf_token': 'rotated'}),
            session.reply(200, {'email': 42, 'role': 'driver'}),
          ]);
        final auth = AuthController(
          NativeSessionApi(
            ApiConfig('https://api.example.test'),
            session.MemoryStorage(),
            transport: transport,
          ),
        );
        final pending = login
            ? auth.login('driver@example.test', 'fictional')
            : auth.restore();
        await tester.pump();
        await pending;
        expect(auth.state, AuthState.error);
        expect(auth.error, contains('respuesta no válida'));
        transport.responses.addAll([
          session.reply(200, {'csrf_token': 'fresh'}),
          session.reply(200, {
            'email': 'driver@example.test',
            'role': 'driver',
          }),
        ]);
        await auth.restore();
        expect(auth.state, AuthState.driver);
      },
    );
  }

  for (final path in ['csrf', 'me', 'login']) {
    testWidgets(
      '$path timeout leaves loading, retry succeeds, late response is ignored',
      (tester) async {
        final transport =
            session.DeferredTransport(
                '/api/v1/auth/$path/',
                path == 'login' ? 'POST' : 'GET',
              )
              ..responses.addAll([
                session.reply(200, {'csrf_token': 'token'}),
                session.reply(200, {
                  'email': 'driver@example.test',
                  'role': 'driver',
                }),
                session.reply(200, fixture.today('planned')),
              ]);
        final storage = session.MemoryStorage()..value = 'unchanged sentinel';
        final auth = AuthController(
          NativeSessionApi(
            ApiConfig('https://api.example.test'),
            storage,
            transport: transport,
          ),
        );
        if (path == 'login') {
          final pending = auth.login('driver@example.test', 'fictional-secret');
          await tester.pump();
          await tester.pump(const Duration(seconds: 16));
          await pending;
        } else {
          // Keep a valid cookie so timeout recovery does not clear stored session.
          storage.value =
              '{"value":"existing","host":"api.example.test","secure":true,"expires_at":"2099-01-01T00:00:00Z"}';
          await tester.pumpWidget(AuthApp(controller: auth));
          await tester.pump();
          await tester.pump(const Duration(seconds: 16));
        }
        expect(auth.state, AuthState.error);
        expect(auth.error, contains('tiempo de espera'));
        expect(storage.value, isNotNull);
        // Supply a fresh, complete sequence for a manual retry.
        transport.responses
          ..clear()
          ..addAll([
            session.reply(200, {'csrf_token': 'fresh-token'}),
            session.reply(200, {
              'email': 'driver@example.test',
              'role': 'driver',
            }),
            session.reply(200, fixture.today('planned')),
          ]);
        if (path == 'login') {
          await auth.restore();
        } else {
          await tester.pumpAndSettle();
          expect(find.byType(LinearProgressIndicator), findsNothing);
          await tester.tap(find.text('Reintentar'));
          await tester.pumpAndSettle();
        }
        expect(auth.state, AuthState.driver);
        transport.completion.complete(
          session.reply(
            200,
            {'role': 'parent', 'csrf_token': 'obsolete'},
            [
              'sessionid=obsolete; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax',
            ],
          ),
        );
        await tester.pumpAndSettle();
        expect(auth.state, AuthState.driver);
        expect(storage.value, isNot(contains('obsolete')));
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }

  testWidgets(
    'secure storage timeout is bounded and does not delete stored session',
    (tester) async {
      final storage = HangingStorage()..value = 'preserved';
      final transport = session.FakeTransport();
      final auth = AuthController(
        NativeSessionApi(
          ApiConfig('https://api.example.test'),
          storage,
          transport: transport,
        ),
      );
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pump();
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      expect(auth.state, AuthState.error);
      expect(find.textContaining('tiempo de espera'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      expect(transport.calls, isEmpty);
      expect(storage.value, 'preserved');
      storage.pending.complete(null);
      await tester.pumpAndSettle();
      expect(auth.state, AuthState.error);
      expect(storage.value, 'preserved');
    },
  );

  testWidgets(
    'Today timeout releases loading, manual retry wins over late result',
    (tester) async {
      final late = Completer<AuthHttpResponse>();
      var reads = 0;
      final transport = fixture.FakeTransport(
        (uri, method) =>
            ++reads == 1 ? late.future : fixture.ok(fixture.today('planned')),
      );
      final auth = fixture.controller(transport, AuthState.driver);
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: auth),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(seconds: 16));
      await tester.pumpAndSettle();
      expect(find.textContaining('tiempo de espera'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsNothing);
      await fixture.tapKey(tester, const Key('reload-today'));
      expect(find.text('Ruta demo'), findsOneWidget);
      late.complete(
        fixture.ok({
          'service_date': '2026-09-28',
          'routes': [],
          'unfinished_runs': [],
        }),
      );
      await tester.pumpAndSettle();
      expect(find.text('Ruta demo'), findsOneWidget);
      expect(transport.calls, hasLength(2));
    },
  );

  for (final cause in ['invalid', 'http', 'socket', 'application']) {
    testWidgets(
      'Today distinguishes $cause error and recovers without inventing empty data',
      (tester) async {
        var reads = 0;
        final transport = fixture.FakeTransport((uri, method) {
          if (++reads > 1) return fixture.ok(fixture.today('planned'));
          if (cause == 'invalid') return fixture.ok({'routes': []});
          if (cause == 'http') return fixture.ok({'code': 'unavailable'}, 503);
          if (cause == 'socket')
            throw const SocketException('sensitive raw message');
          throw StateError('private application failure');
        });
        await fixture.mountDriver(tester, transport);
        final expected = switch (cause) {
          'invalid' => 'respuesta no válida',
          'http' => 'El servicio no pudo',
          'socket' => 'No se pudo comunicar',
          _ => 'error de aplicación',
        };
        expect(find.textContaining(expected), findsOneWidget);
        expect(find.text('Sin servicio para hoy'), findsNothing);
        expect(find.textContaining('private'), findsNothing);
        expect(find.textContaining('sensitive'), findsNothing);
        await fixture.tapKey(tester, const Key('reload-today'));
        expect(find.text('Ruta demo'), findsOneWidget);
      },
    );
  }

  testWidgets(
    'uncertain run write times out and requires a read before any repeat',
    (tester) async {
      final pending = Completer<AuthHttpResponse>();
      final transport = fixture.FakeTransport(
        (uri, method) => method == 'POST'
            ? pending.future
            : fixture.ok(
                uri.path.endsWith('csrf/')
                    ? {'csrf_token': 'token'}
                    : fixture.today('planned'),
              ),
      );
      await fixture.mountDriver(tester, transport);
      await tester.tap(find.byKey(const Key('start-9')));
      await tester.pump();
      await tester.pump(const Duration(seconds: 16));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Actualiza el estado antes de volver a actuar'),
        findsOneWidget,
      );
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('start-9'))).onPressed,
        isNull,
      );
      await fixture.tapKey(tester, const Key('reload-today'));
      expect(
        tester.widget<FilledButton>(find.byKey(const Key('start-9'))).onPressed,
        isNotNull,
      );
      pending.complete(
        fixture.ok({'id': 99, 'route_id': 9, 'state': 'in_progress'}),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      expect(
        transport.calls.where((call) => call.startsWith('POST ')),
        hasLength(1),
      );
    },
  );

  testWidgets(
    'native roster searches all received rows, pages ten, hides contact until opened',
    (tester) async {
      final data = fixture.today('planned');
      final route = (data['routes'] as List).first as Map<String, dynamic>;
      route['roster'] = List.generate(
        23,
        (index) => {
          'student_display_name': 'Pasajero $index',
          'pickup_instruction': 'Parada $index',
          'guardian_display_name': index == 22 ? 'Ángela' : 'Apoderado $index',
          'guardian_contact': '912345678',
        },
      );
      route['seat_capacity'] = 30;
      route['used_seats'] = 23;
      route['available_seats'] = 7;
      await fixture.mountDriver(
        tester,
        fixture.FakeTransport((uri, method) => fixture.ok(data)),
      );
      await fixture.showPassengers(tester);
      expect(find.text('Pasajero 0'), findsOneWidget);
      expect(find.text('Pasajero 10'), findsNothing);
      await tester.ensureVisible(find.text('Siguiente'));
      await tester.tap(find.text('Siguiente'));
      await tester.pumpAndSettle();
      expect(find.text('Pasajero 10'), findsOneWidget);
      final search = find.byType(TextField);
      await tester.ensureVisible(search);
      await tester.enterText(search, 'angela');
      await tester.pumpAndSettle();
      expect(find.text('Pasajero 22'), findsOneWidget);
      expect(find.text('Pasajero 10'), findsNothing);
      expect(find.text('912345678'), findsNothing);
      expect(find.textContaining('Página 1 de 1'), findsNothing);
      expect(find.text('1 resultado'), findsOneWidget);
      expect(find.text('1 pasajero'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
