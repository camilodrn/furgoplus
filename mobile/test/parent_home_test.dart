import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/parent_home.dart';
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
  final AuthHttpResponse Function(Uri, String, String?) reply;
  final calls = <String>[];
  @override
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    calls.add('$method ${uri.path}${uri.hasQuery ? '?${uri.query}' : ''}');
    return reply(uri, method, body);
  }

  @override
  void close() {}
}

AuthHttpResponse ok(Object body, [int status = 200]) =>
    AuthHttpResponse(status, jsonEncode(body), []);

Map<String, dynamic> driver(int id, {bool demo = false}) => {
  'id': id,
  'display_name': 'Conductor Demo $id',
  'service_summary': 'Servicio demo',
  'validation_label': 'Validado',
  'coverage': [
    {'code': 'demo-norte', 'display_name': 'Comuna Demo Norte'},
  ],
  'routes': [
    {
      'id': id + 10,
      'label': 'Ruta demo',
      'weekdays': ['monday'],
      'start_time': '07:00',
      'end_time': '08:00',
      'seat_capacity': 3,
      'available_seats': 3,
      'next_service_date': '2026-09-28',
      'coverage': [
        {'code': 'demo-norte', 'display_name': 'Comuna Demo Norte'},
      ],
    },
  ],
  'review_average': demo ? 5.0 : null,
  'review_count': demo ? 1 : 0,
};

AuthController parent(FakeTransport transport) {
  final controller = AuthController(
    NativeSessionApi(
      ApiConfig('https://api.example.test/'),
      MemoryStorage(),
      transport: transport,
    ),
  );
  controller.state = AuthState.parent;
  controller.displayName = 'Familia Demo';
  return controller;
}

final catalog = {
  'communes': [
    {'code': 'demo-norte', 'display_name': 'Comuna Demo Norte'},
  ],
};

Future<void> search(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.tap(find.text('Comuna'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Comuna Demo Norte'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Buscar conductores'));
  await tester.pumpAndSettle();
}

Finder pageScroll() => find.byElementPredicate(
  (element) =>
      element.widget is Scrollable &&
      element.findAncestorWidgetOfExactType<ListView>() != null &&
      element.findAncestorStateOfType<ScrollableState>() == null,
  description: 'outer page Scrollable',
);

Future<void> reveal(WidgetTester tester, Key key, {double delta = 250}) async {
  expect(pageScroll(), findsOneWidget);
  await tester.scrollUntilVisible(
    find.byKey(key),
    delta,
    scrollable: pageScroll(),
  );
}

Future<void> tapVisible(
  WidgetTester tester,
  Key key, {
  double delta = 200,
}) async {
  final target = find.byKey(key);
  expect(pageScroll(), findsOneWidget);
  await tester.scrollUntilVisible(target, delta, scrollable: pageScroll());
  expect(target, findsOneWidget);
  await Scrollable.ensureVisible(tester.element(target), alignment: 0.5);
  await tester.pumpAndSettle();
  final center = tester.getCenter(target);
  final renderObject = tester.renderObject(target);
  expect(
    tester
        .hitTestOnBinding(center)
        .path
        .any((entry) => entry.target == renderObject),
    isTrue,
    reason: '$key must receive a tap at its center',
  );
  await tester.tap(target);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'commune search renders normalized cards and empty review detail',
    (tester) async {
      final transport = FakeTransport((uri, method, body) {
        if (uri.path.endsWith('/communes/')) return ok(catalog);
        if (uri.path.endsWith('/drivers/'))
          return ok({
            'results': [driver(1), driver(2, demo: true)],
          });
        if (uri.path.endsWith('/drivers/1/'))
          return ok({...driver(1), 'reviews': []});
        return ok({});
      });
      await tester.pumpWidget(
        MaterialApp(home: ParentHome(auth: parent(transport))),
      );
      await search(tester);
      expect(find.text('Conductor Demo 1'), findsOneWidget);
      expect(find.text('Sin reseñas'), findsOneWidget);
      expect(
        find.textContaining('lunes · 07:00–08:00 · 28-09-2026 · 3 cupos'),
        findsWidgets,
      );
      await tester.tap(
        find.descendant(
          of: find.byKey(const ValueKey('driver-card-1')),
          matching: find.text('Ver detalle'),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Reseñas publicadas'), findsOneWidget);
      expect(find.text('Sin reseñas'), findsWidgets);
    },
  );

  testWidgets('comparison allows 2–3 and rejects stale hidden result', (
    tester,
  ) async {
    int? hiddenDriverId;
    final comparedIds = <List<int>>[];
    final transport = FakeTransport((uri, method, body) {
      if (uri.path.endsWith('/communes/')) return ok(catalog);
      if (uri.path.endsWith('/drivers/'))
        return ok({
          'results': [
            for (final id in [1, 2, 3, 4])
              if (id != hiddenDriverId) driver(id),
          ],
        });
      if (uri.path.endsWith('/compare/')) {
        final ids = uri.queryParameters['ids']!
            .split(',')
            .map(int.parse)
            .toList();
        comparedIds.add(ids);
        if (ids.contains(hiddenDriverId))
          return ok({'code': 'not_found', 'message': 'Not found'}, 404);
        return ok({'results': ids.map((id) => driver(id)).toList()});
      }
      throw StateError('Unexpected $method ${uri.path}');
    });
    await tester.pumpWidget(
      MaterialApp(home: ParentHome(auth: parent(transport))),
    );
    await search(tester);
    expect(transport.calls, [
      'GET /api/v1/discovery/communes/',
      'GET /api/v1/discovery/drivers/?commune=demo-norte',
    ]);
    for (final id in [1, 2]) {
      final key = ValueKey('compare-driver-$id');
      await tapVisible(tester, key);
      expect(tester.widget<CheckboxListTile>(find.byKey(key)).value, isTrue);
      if (id == 1) {
        expect(find.byKey(const Key('compare-selected')), findsNothing);
      }
    }
    await reveal(tester, const Key('compare-selected'));
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('compare-selected')))
          .onPressed,
      isNotNull,
    );
    await tapVisible(tester, const Key('compare-selected'));
    expect(comparedIds, [
      [1, 2],
    ]);
    await reveal(tester, const Key('comparison-back'), delta: -200);
    expect(find.byKey(const Key('comparison-back')), findsOneWidget);
    await reveal(tester, const ValueKey('driver-card-1'));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('driver-card-1')),
        matching: find.text('Conductor Demo 1'),
      ),
      findsOneWidget,
    );
    await reveal(tester, const ValueKey('driver-card-2'));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('driver-card-2')),
        matching: find.text('Conductor Demo 2'),
      ),
      findsOneWidget,
    );

    await tapVisible(tester, const Key('comparison-back'), delta: -200);
    await tapVisible(tester, const ValueKey('compare-driver-3'));
    expect(
      tester
          .widget<CheckboxListTile>(
            find.byKey(const ValueKey('compare-driver-3')),
          )
          .value,
      isTrue,
    );
    await tapVisible(tester, const ValueKey('compare-driver-4'));
    expect(
      tester
          .widget<CheckboxListTile>(
            find.byKey(const ValueKey('compare-driver-4')),
          )
          .value,
      isFalse,
    );
    await reveal(tester, const ValueKey('compare-driver-3'), delta: -200);
    expect(
      tester
          .widget<CheckboxListTile>(
            find.byKey(const ValueKey('compare-driver-3')),
          )
          .value,
      isTrue,
    );
    expect(
      tester.widget<Text>(find.byKey(const Key('parent-error'))).data,
      'Selecciona como máximo 3 conductores.',
    );
    await reveal(tester, const Key('compare-selected'));
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('compare-selected')))
          .onPressed,
      isNotNull,
    );
    await tapVisible(tester, const Key('compare-selected'));
    expect(comparedIds, [
      [1, 2],
      [1, 2, 3],
    ]);
    await reveal(tester, const Key('comparison-back'), delta: -200);
    expect(find.byKey(const Key('comparison-back')), findsOneWidget);
    await reveal(tester, const ValueKey('driver-card-1'));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('driver-card-1')),
        matching: find.text('Conductor Demo 1'),
      ),
      findsOneWidget,
    );
    await reveal(tester, const ValueKey('driver-card-2'));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('driver-card-2')),
        matching: find.text('Conductor Demo 2'),
      ),
      findsOneWidget,
    );
    await reveal(tester, const ValueKey('driver-card-3'));
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('driver-card-3')),
        matching: find.text('Conductor Demo 3'),
      ),
      findsOneWidget,
    );

    await tapVisible(tester, const Key('comparison-back'), delta: -200);
    hiddenDriverId = 2;
    await tapVisible(tester, const Key('compare-selected'));
    expect(comparedIds, [
      [1, 2],
      [1, 2, 3],
      [1, 2, 3],
    ]);
    expect(
      tester.widget<Text>(find.byKey(const Key('parent-error'))).data,
      'La selección cambió. Actualiza y vuelve a elegir.',
    );
    expect(
      find.widgetWithText(FilledButton, 'Buscar conductores'),
      findsOneWidget,
    );
    expect(
      find.text('No hay conductores disponibles en esta comuna.'),
      findsNothing,
    );
    expect(find.byKey(const Key('compare-selected')), findsNothing);
    expect(find.byKey(const Key('comparison-back')), findsNothing);
  });

  testWidgets(
    'contact requires consent; accepted snapshot appears in history',
    (tester) async {
      var status = 'pending';
      Map<String, dynamic>? submitted;
      final transport = FakeTransport((uri, method, body) {
        if (uri.path.endsWith('/communes/')) return ok(catalog);
        if (uri.path.endsWith('/drivers/'))
          return ok({
            'results': [driver(1)],
          });
        if (uri.path.endsWith('/drivers/1/'))
          return ok({...driver(1), 'reviews': []});
        if (uri.path.endsWith('/auth/csrf/'))
          return ok({'csrf_token': 'test-token'});
        if (uri.path.endsWith('/contact-requests/') && method == 'POST') {
          submitted = jsonDecode(body!) as Map<String, dynamic>;
          return ok({'id': 7}, 201);
        }
        if (uri.path.endsWith('/contact-requests/'))
          return ok({
            'results': [
              {
                'id': 7,
                'driver_id': 1,
                'driver_display_name': 'Conductor Demo 1',
                'message': 'Consulta',
                'status': status,
                'created_at': '2026-09-23T12:00:00Z',
                'updated_at': '2026-09-23T12:00:00Z',
                'resolved_at': null,
                'driver_service_email': status == 'accepted'
                    ? 'service@example.test'
                    : null,
              },
            ],
          });
        if (uri.path.endsWith('/contact-requests/7/'))
          return ok({
            'id': 7,
            'driver_id': 1,
            'driver_display_name': 'Conductor Demo 1',
            'message': 'Consulta',
            'status': status,
            'created_at': '2026-09-23T12:00:00Z',
            'updated_at': '2026-09-23T12:00:00Z',
            'resolved_at': null,
            'driver_service_email': status == 'accepted'
                ? 'service@example.test'
                : null,
          });
        return ok({});
      });
      await tester.pumpWidget(
        MaterialApp(home: ParentHome(auth: parent(transport))),
      );
      await search(tester);
      await tester.tap(find.text('Ver detalle'));
      await tester.pumpAndSettle();
      await reveal(tester, const Key('contact-message'));
      await tester.enterText(
        find.byKey(const Key('contact-message')),
        'Consulta',
      );
      await reveal(tester, const Key('send-contact-request'));
      await tester.tap(find.byKey(const Key('send-contact-request')));
      await tester.pumpAndSettle();
      expect(find.textContaining('acepta compartir'), findsOneWidget);
      expect(
        transport.calls.where(
          (call) => call == 'POST /api/v1/parent/contact-requests/',
        ),
        isEmpty,
      );
      await reveal(tester, const Key('contact-consent'), delta: -200);
      await tester.tap(find.byKey(const Key('contact-consent')));
      await tester.pumpAndSettle();
      await reveal(tester, const Key('send-contact-request'));
      await tester.tap(find.byKey(const Key('send-contact-request')));
      await tester.pumpAndSettle();
      expect(
        transport.calls
            .where((call) => call == 'POST /api/v1/parent/contact-requests/')
            .length,
        1,
      );
      expect(submitted, {
        'driver_id': 1,
        'message': 'Consulta',
        'consent_share_email': true,
      });
      status = 'accepted';
      await tester.tap(find.text('Actualizar'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Conductor Demo 1'));
      await tester.pumpAndSettle();
      expect(find.textContaining('service@example.test'), findsOneWidget);
    },
  );
}
