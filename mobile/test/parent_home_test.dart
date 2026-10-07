import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:ui' show Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/parent_home.dart';
import 'package:furgoplus/parent_presentation.dart';
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
  final FutureOr<AuthHttpResponse> Function(Uri, String, String?) reply;
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
      'used_seats': 0,
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
  controller.email = 'parent@example.test';
  return controller;
}

final catalog = {
  'communes': [
    {'code': 'demo-norte', 'display_name': 'Comuna Demo Norte'},
  ],
};

Future<void> search(WidgetTester tester) async {
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('open-filters')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('commune-filter')));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Comuna Demo Norte'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Buscar servicios'));
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
  tester.state<ScrollableState>(pageScroll()).position.jumpTo(0);
  await tester.pump();
  await tester.scrollUntilVisible(
    find.byKey(key),
    delta.abs(),
    scrollable: pageScroll(),
  );
  await tester.pumpAndSettle();
}

Future<void> tapControl(WidgetTester tester, Finder target) async {
  await tester.scrollUntilVisible(target, 200, scrollable: pageScroll());
  await tester.pumpAndSettle();
  await Scrollable.ensureVisible(tester.element(target), alignment: 0.5);
  await tester.pumpAndSettle();
  expect(target.hitTestable(), findsOneWidget);
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Future<void> tapVisible(
  WidgetTester tester,
  Key key, {
  double delta = 200,
}) async {
  await reveal(tester, key, delta: delta);
  final target = find.byKey(key);
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

Map<String, dynamic> request(
  int id, {
  String status = 'pending',
  int driverId = 1,
}) => {
  'id': id,
  'driver_id': driverId,
  'driver_display_name': 'Conductor Demo $driverId',
  'message': 'Consulta privada $id',
  'status': status,
  'created_at': '2026-09-23T12:00:00Z',
  'updated_at': '2026-09-23T12:00:00Z',
  'resolved_at': status == 'pending' ? null : '2026-09-24T12:00:00Z',
  'driver_service_email': status == 'accepted' ? 'service@example.test' : null,
};

FakeTransport fixture({
  FutureOr<AuthHttpResponse>? Function(Uri, String, String?)? override,
  List<Map<String, dynamic>>? services,
  List<Map<String, dynamic>>? requests,
}) => FakeTransport((uri, method, body) {
  final custom = override?.call(uri, method, body);
  if (custom != null) return custom;
  if (uri.path.endsWith('/communes/')) return ok(catalog);
  if (uri.path.endsWith('/drivers/'))
    return ok({
      'results': services ?? [driver(1), driver(2), driver(3)],
    });
  if (RegExp(r'/drivers/[0-9]+/$').hasMatch(uri.path)) {
    final id = int.parse(uri.path.split('/').reversed.elementAt(1));
    return ok({...driver(id), 'reviews': []});
  }
  if (uri.path.endsWith('/compare/'))
    return ok({
      'results': uri.queryParameters['ids']!
          .split(',')
          .map((id) => driver(int.parse(id)))
          .toList(),
    });
  if (uri.path.endsWith('/csrf/')) return ok({'csrf_token': 'test-token'});
  if (uri.path.endsWith('/profile/'))
    return ok({'display_name': 'Familia Demo', 'email': 'parent@example.test'});
  if (uri.path.endsWith('/contact-requests/')) {
    if (method == 'POST') return ok(request(7), 201);
    return ok({
      'results': requests ?? [request(7)],
    });
  }
  if (uri.path.endsWith('/cancel/')) return ok(request(7, status: 'cancelled'));
  if (RegExp(r'/contact-requests/[0-9]+/$').hasMatch(uri.path)) {
    final id = int.parse(uri.path.split('/').reversed.elementAt(1));
    return ok((requests ?? [request(7)]).firstWhere((row) => row['id'] == id));
  }
  throw StateError('Unexpected $method $uri');
});

Future<AuthController> mount(
  WidgetTester tester,
  FakeTransport transport,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  final auth = parent(transport);
  await tester.pumpWidget(
    MaterialApp(
      theme: furgoTheme(),
      home: ParentHome(auth: auth),
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

Future<void> openService(WidgetTester tester, [int id = 1]) async {
  await reveal(tester, ValueKey('driver-card-$id'));
  final target = find.descendant(
    of: find.byKey(ValueKey('driver-card-$id')),
    matching: find.widgetWithText(FilledButton, 'Ver servicio'),
  );
  await tapControl(tester, target);
}

Future<void> beginContact(WidgetTester tester) async {
  await openService(tester);
  await tapVisible(tester, const Key('start-contact'));
  await reveal(tester, const Key('contact-message'));
  await tester.enterText(
    find.byKey(const Key('contact-message')),
    'Consulta sintética',
  );
}

Future<void> consentAndSend(WidgetTester tester) async {
  await tapVisible(tester, const Key('contact-consent'));
  await tapVisible(tester, const Key('send-contact-request'));
}

void main() {
  setUp(() => WidgetController.hitTestWarningShouldBeFatal = true);
  tearDown(() => WidgetController.hitTestWarningShouldBeFatal = false);

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
      expect(find.textContaining('Lun · 07:00–08:00'), findsWidgets);
      await openService(tester);
      await reveal(tester, const Key('service-reviews'));
      expect(
        find.descendant(
          of: find.byKey(const Key('service-reviews')),
          matching: find.text('Sin reseñas'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('service-reviews')),
          matching: find.byType(ExpansionTile),
        ),
        findsNothing,
      );
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
      'GET /api/v1/discovery/drivers/',
      'GET /api/v1/discovery/communes/',
      'GET /api/v1/discovery/drivers/?commune=demo-norte',
    ]);
    for (final id in [1, 2]) {
      final key = ValueKey('compare-driver-$id');
      await tapVisible(tester, key);
      expect(
        tester.widget<ParentCompareAction>(find.byKey(key)).selected,
        isTrue,
      );
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
          .widget<ParentCompareAction>(
            find.byKey(const ValueKey('compare-driver-3')),
          )
          .selected,
      isTrue,
    );
    await tapVisible(tester, const ValueKey('compare-driver-4'));
    await reveal(tester, const ValueKey('compare-driver-4'));
    expect(
      tester
          .widget<ParentCompareAction>(
            find.byKey(const ValueKey('compare-driver-4')),
          )
          .selected,
      isFalse,
    );
    await reveal(tester, const ValueKey('compare-driver-3'), delta: -200);
    expect(
      tester
          .widget<ParentCompareAction>(
            find.byKey(const ValueKey('compare-driver-3')),
          )
          .selected,
      isTrue,
    );
    await reveal(tester, const Key('parent-error'));
    expect(
      tester.widget<Text>(find.byKey(const Key('parent-error'))).data,
      'Selecciona como máximo 3 servicios.',
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
    await reveal(tester, const Key('parent-error'));
    expect(
      tester.widget<Text>(find.byKey(const Key('parent-error'))).data,
      'Este servicio ya no está disponible.',
    );
    expect(find.byTooltip('Actualizar búsqueda'), findsOneWidget);
    expect(
      find.text(
        'No hay servicios disponibles en esta comuna. Prueba otra comuna.',
      ),
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
          return ok(request(7), 201);
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
      await openService(tester);
      await tapVisible(tester, const Key('start-contact'));
      expect(find.text('parent@example.test'), findsOneWidget);
      expect(find.text('Para: Conductor Demo 1'), findsOneWidget);
      await reveal(tester, const Key('contact-message'));
      await tester.enterText(
        find.byKey(const Key('contact-message')),
        'Consulta',
      );
      await reveal(tester, const Key('send-contact-request'));
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('send-contact-request')))
            .onPressed,
        isNull,
      );
      await tester.tap(find.byKey(const Key('send-contact-request')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('contact-error')), findsNothing);
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
      await tester.tap(find.text('Actualizar Solicitudes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ver solicitud'));
      await tester.pumpAndSettle();
      expect(find.textContaining('service@example.test'), findsOneWidget);
    },
  );
  testWidgets(
    'search-first navigation, compact supported filters and account',
    (tester) async {
      final transport = fixture();
      final auth = await mount(tester, transport);
      expect(transport.calls.take(2), [
        'GET /api/v1/discovery/drivers/',
        'GET /api/v1/discovery/communes/',
      ]);
      expect(find.text('Encuentra transporte'), findsOneWidget);
      expect(find.text('Buscar'), findsOneWidget);
      expect(find.text('Solicitudes'), findsOneWidget);
      expect(find.text('Mi cuenta'), findsOneWidget);
      expect(find.byKey(const Key('commune-filter')), findsNothing);
      await search(tester);
      expect(
        transport.calls.last,
        'GET /api/v1/discovery/drivers/?commune=demo-norte',
      );
      expect(
        find.descendant(
          of: find.byKey(const Key('open-filters')),
          matching: find.text('1'),
        ),
        findsOneWidget,
      );
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      expect(find.text('Pendiente'), findsOneWidget);
      expect(find.text('Consulta privada 7'), findsNothing);
      expect(find.textContaining('service@example.test'), findsNothing);
      await tester.tap(find.text('Mi cuenta'));
      await tester.pumpAndSettle();
      expect(find.text('parent@example.test'), findsOneWidget);
      expect(find.text('Apoderado/a'), findsOneWidget);
      expect(find.text('Cerrar sesión'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(auth.email, isNull);
      expect(find.textContaining('parent@example.test'), findsNothing);
      expect(find.byKey(const ValueKey('request-card-7')), findsNothing);
    },
  );

  testWidgets('read loading, empty search and contextual network retry', (
    tester,
  ) async {
    final pending = Completer<AuthHttpResponse>();
    var reads = 0;
    final transport = fixture(
      override: (uri, method, body) {
        if (uri.path.endsWith('/drivers/')) {
          reads++;
          if (reads == 1) return pending.future;
          return ok({'results': []});
        }
        return null;
      },
    );
    await tester.pumpWidget(
      MaterialApp(home: ParentHome(auth: parent(transport))),
    );
    await tester.pump();
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text('No hay servicios disponibles por ahora.'), findsNothing);
    pending.completeError(const SocketException('offline'));
    await tester.pumpAndSettle();
    expect(find.text('Reintentar'), findsOneWidget);
    await tester.tap(find.text('Reintentar'));
    await tester.pumpAndSettle();
    expect(reads, 2);
    expect(
      find.text('No hay servicios disponibles por ahora.'),
      findsOneWidget,
    );
    expect(find.text('Reintentar'), findsNothing);
  });

  testWidgets(
    'summary first, date-specific availability, truthful trust and public allowlist',
    (tester) async {
      final public = {
        ...driver(1),
        'reviews': [],
        'driver_service_email': 'private-driver@example.test',
        'student_display_name': 'Private child',
        'guardian_email': 'guardian@example.test',
        'pickup_instructions': 'Private pickup',
        'documents': [
          {'url': 'secret-document'},
        ],
        'admin_history': 'Private admin',
      };
      await mount(
        tester,
        fixture(
          services: [public],
          override: (uri, method, body) =>
              uri.path.endsWith('/drivers/1/') ? ok(public) : null,
        ),
      );
      expect(find.text('Conductor validado'), findsOneWidget);
      expect(find.text('3 de 3 disponibles'), findsOneWidget);
      expect(find.text('Cupos para el 28-09-2026'), findsOneWidget);
      await openService(tester);
      expect(find.text('Solicitar contacto'), findsOneWidget);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.text('Servicio demo'), findsNothing);
      expect(find.textContaining('garantía de seguridad'), findsNothing);
      for (final privateText in [
        'Private child',
        'guardian@example.test',
        'private-driver@example.test',
        'Private pickup',
        'secret-document',
        'Private admin',
      ]) {
        expect(find.textContaining(privateText), findsNothing);
      }
      final children =
          (tester.widget<ListView>(find.byType(ListView)).childrenDelegate
                  as SliverChildListDelegate)
              .children;
      final heroIndex = children.indexWhere(
        (child) => child.key == const Key('service-hero'),
      );
      final trustIndex = children.indexWhere(
        (child) => child.key == const Key('service-trust'),
      );
      expect(heroIndex, greaterThanOrEqualTo(0));
      expect(heroIndex, lessThan(trustIndex));
      expect(
        find.descendant(
          of: find.byKey(const Key('service-hero')),
          matching: find.byKey(const Key('start-contact')),
        ),
        findsOneWidget,
      );
      await reveal(tester, const Key('service-trust'));
      await tapControl(
        tester,
        find.descendant(
          of: find.byKey(const Key('service-trust')),
          matching: find.byType(ListTile),
        ),
      );
      expect(
        find.textContaining('según su proceso de validación'),
        findsOneWidget,
      );
      expect(
        find.textContaining(
          'No es una certificación estatal ni una garantía de seguridad',
        ),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'only actual published reviews; demo marker disclosed with review',
    (tester) async {
      final public = {
        ...driver(1, demo: true),
        'reviews': [
          {
            'score': 5,
            'text': 'Reseña sintética',
            'created_on': '2026-09-23',
            'created_at': '2026-09-23T12:00:00Z',
            'is_demo': true,
          },
        ],
      };
      await mount(
        tester,
        fixture(
          services: [public],
          override: (uri, method, body) =>
              uri.path.endsWith('/drivers/1/') ? ok(public) : null,
        ),
      );
      await openService(tester);
      expect(find.text('Reseña sintética'), findsNothing);
      await reveal(tester, const Key('service-reviews'));
      await tapControl(
        tester,
        find.descendant(
          of: find.byKey(const Key('service-reviews')),
          matching: find.byType(ListTile),
        ),
      );
      expect(find.text('Datos de demostración'), findsOneWidget);
      expect(find.text('Reseña sintética'), findsOneWidget);
    },
  );

  testWidgets(
    'comparison removal retains 2 then returns to search with 1; no table',
    (tester) async {
      final transport = fixture();
      await mount(tester, transport);
      for (final id in [1, 2, 3]) {
        await tapVisible(tester, ValueKey('compare-driver-$id'));
      }
      await tapVisible(tester, const Key('compare-selected'));
      expect(transport.calls.last, 'GET /api/v1/discovery/compare/?ids=1,2,3');
      expect(find.byType(DataTable), findsNothing);
      expect(
        tester.widget<ListView>(find.byType(ListView)).scrollDirection,
        Axis.vertical,
      );
      await reveal(tester, const ValueKey('driver-card-3'));
      final thirdRemove = find.descendant(
        of: find.byKey(const ValueKey('driver-card-3')),
        matching: find.widgetWithText(TextButton, 'Quitar de comparación'),
      );
      await tapControl(tester, thirdRemove);
      await reveal(tester, const Key('comparison-back'));
      expect(find.text('Comparar servicios'), findsOneWidget);
      expect(find.byKey(const ValueKey('driver-card-3')), findsNothing);
      await reveal(tester, const ValueKey('driver-card-2'));
      final secondRemove = find.descendant(
        of: find.byKey(const ValueKey('driver-card-2')),
        matching: find.widgetWithText(TextButton, 'Quitar de comparación'),
      );
      await tapControl(tester, secondRemove);
      expect(find.text('Encuentra transporte'), findsOneWidget);
      expect(find.byKey(const Key('comparison-back')), findsNothing);
    },
  );

  testWidgets(
    'hidden direct detail and hidden pre-contact recheck remove stale data',
    (tester) async {
      var hidden = false;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/drivers/1/') && hidden)
            return ok({'code': 'not_found', 'message': 'Not found'}, 404);
          if (uri.path.endsWith('/drivers/') && hidden)
            return ok({
              'results': [driver(2)],
            });
          return null;
        },
      );
      await mount(tester, transport);
      await openService(tester);
      hidden = true;
      await tapVisible(tester, const Key('start-contact'));
      expect(find.text('Este servicio ya no está disponible.'), findsOneWidget);
      expect(find.text('Conductor Demo 1'), findsNothing);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.text('Reintentar'), findsNothing);
      await tester.tap(find.text('Volver a Buscar'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('driver-card-1')), findsNothing);
      expect(find.byKey(const ValueKey('driver-card-2')), findsOneWidget);
    },
  );

  testWidgets(
    'duplicate domain error links to existing participant request without retry',
    (tester) async {
      final transport = fixture(
        override: (uri, method, body) =>
            uri.path.endsWith('/contact-requests/') && method == 'POST'
            ? ok({
                'code': 'pending_request_exists',
                'message': 'Duplicate',
              }, 409)
            : null,
      );
      await mount(tester, transport);
      await beginContact(tester);
      await consentAndSend(tester);
      expect(
        find.text('Ya tienes una solicitud activa para este servicio.'),
        findsOneWidget,
      );
      expect(find.text('Reintentar'), findsNothing);
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tapControl(
        tester,
        find.widgetWithText(FilledButton, 'Ver solicitud'),
      );
      expect(find.text('Pendiente'), findsOneWidget);
      expect(find.text('Tu mensaje'), findsOneWidget);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.textContaining('service@example.test'), findsNothing);
    },
  );

  testWidgets(
    'pending write disables repeated local sends and confirms immediately',
    (tester) async {
      final pending = Completer<AuthHttpResponse>();
      var writes = 0;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/contact-requests/') && method == 'POST') {
            writes++;
            return pending.future;
          }
          return null;
        },
      );
      await mount(tester, transport);
      await beginContact(tester);
      await tapVisible(tester, const Key('contact-consent'));
      await reveal(tester, const Key('send-contact-request'));
      await tester.tap(find.byKey(const Key('send-contact-request')));
      await tester.pump();
      await tester.tap(find.byKey(const Key('send-contact-request')));
      await tester.pump();
      expect(writes, 1);
      expect(
        tester
            .widget<FilledButton>(find.byKey(const Key('send-contact-request')))
            .onPressed,
        isNull,
      );
      pending.complete(ok(request(7), 201));
      await tester.pumpAndSettle();
      expect(find.text('Solicitud enviada'), findsWidgets);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(find.byKey(const ValueKey('request-card-7')), findsOneWidget);
      expect(find.byKey(const Key('contact-message')), findsNothing);
    },
  );

  testWidgets(
    'confirmed send remains confirmed when refreshing requests fails',
    (tester) async {
      final transport = fixture(
        override: (uri, method, body) =>
            uri.path.endsWith('/contact-requests/') && method == 'GET'
            ? Future<AuthHttpResponse>.error(const SocketException('offline'))
            : null,
      );
      await mount(tester, transport);
      await beginContact(tester);
      await consentAndSend(tester);
      expect(find.textContaining('el cambio está confirmado'), findsOneWidget);
      expect(find.text('No pudimos enviar la solicitud'), findsNothing);
      expect(find.byKey(const ValueKey('request-card-7')), findsOneWidget);
      expect(find.text('Reintentar'), findsOneWidget);
    },
  );

  testWidgets(
    'uncertain write is never replayed and offers authoritative inbox read',
    (tester) async {
      var writes = 0;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/contact-requests/') && method == 'POST') {
            writes++;
            return Future<AuthHttpResponse>.error(
              const SocketException('lost response'),
            );
          }
          return null;
        },
      );
      await mount(tester, transport);
      await beginContact(tester);
      await consentAndSend(tester);
      expect(
        find.textContaining('Revisa Solicitudes antes de crear otra solicitud'),
        findsOneWidget,
      );
      expect(find.byKey(const Key('send-contact-request')), findsNothing);
      expect(find.text('Reintentar'), findsNothing);
      await tester.pump(const Duration(seconds: 6));
      await tester.pumpAndSettle();
      await tapControl(
        tester,
        find.widgetWithText(FilledButton, 'Ver Solicitudes'),
      );
      expect(writes, 1);
      expect(find.text('Tus solicitudes'), findsOneWidget);
    },
  );

  for (final status in ['pending', 'accepted', 'declined', 'cancelled']) {
    testWidgets(
      '$status inbox/detail preserves participant history and gates contact',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          final row = request(7, status: status);
          // Even an unexpected field in a pending response must never be displayed.
          if (status == 'pending')
            row['driver_service_email'] = 'forbidden@example.test';
          await mount(tester, fixture(requests: [row]));
          await tester.tap(find.text('Solicitudes'));
          await tester.pumpAndSettle();
          expect(find.textContaining('Consulta privada'), findsNothing);
          expect(find.textContaining('@example.test'), findsNothing);
          await tester.tap(find.text('Ver solicitud'));
          await tester.pumpAndSettle();
          final labels = {
            'pending': 'Pendiente',
            'accepted': 'Aceptada',
            'declined': 'Rechazada',
            'cancelled': 'Cancelada',
          };
          expect(find.text(labels[status]!), findsOneWidget);
          expect(find.bySemanticsLabel(labels[status]!), findsOneWidget);
          expect(find.textContaining('forbidden@example.test'), findsNothing);
          expect(
            find.text('service@example.test'),
            status == 'accepted' ? findsOneWidget : findsNothing,
          );
          expect(find.text('Solicitar contacto'), findsNothing);
          expect(find.text('Ver servicio'), findsNothing);
          await reveal(tester, const Key('request-message'));
          await tapControl(tester, find.text('Tu mensaje'));
          expect(find.text('Consulta privada 7'), findsOneWidget);
        } finally {
          semantics.dispose();
        }
      },
    );
  }

  testWidgets('request inbox shows small batches and no messages or contact', (
    tester,
  ) async {
    await mount(
      tester,
      fixture(
        requests: [for (var id = 8; id >= 1; id--) request(id, driverId: id)],
      ),
    );
    await tester.tap(find.text('Solicitudes'));
    await tester.pumpAndSettle();
    await reveal(tester, const ValueKey('request-card-6'));
    expect(find.byKey(const ValueKey('request-card-5')), findsNothing);
    await tapControl(
      tester,
      find.widgetWithText(OutlinedButton, 'Ver solicitudes anteriores'),
    );
    await reveal(tester, const ValueKey('request-card-3'));
    expect(find.byKey(const ValueKey('request-card-3')), findsOneWidget);
    expect(find.textContaining('Consulta privada'), findsNothing);
  });

  testWidgets(
    'narrow phone, doubled text and keyboard keep contact controls reachable',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      tester.view.viewInsets = const FakeViewPadding(bottom: 250);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      final auth = parent(fixture());
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: ParentHome(auth: auth),
        ),
      );
      await tester.pumpAndSettle();
      await beginContact(tester);
      await reveal(tester, const Key('contact-consent'));
      final tile = tester.getRect(find.byKey(const Key('contact-consent')));
      expect(tile.width, lessThanOrEqualTo(360));
      expect(tile.height, greaterThanOrEqualTo(48));
      await reveal(tester, const Key('send-contact-request'));
      expect(
        tester.getSize(find.byKey(const Key('send-contact-request'))).height,
        greaterThanOrEqualTo(56),
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    '390px phone keeps contact controls in one scroll above keyboard',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      await mount(tester, fixture());
      await beginContact(tester);
      tester.view.viewInsets = const FakeViewPadding(bottom: 300);
      await tester.pumpAndSettle();
      final message = find.byKey(const Key('contact-message'));
      final consent = find.byKey(const Key('contact-consent'));
      final submit = find.byKey(const Key('send-contact-request'));
      for (final control in [message, consent, submit]) {
        await Scrollable.ensureVisible(tester.element(control), alignment: 0.5);
        await tester.pumpAndSettle();
        final target = control == message
            ? find.descendant(of: control, matching: find.byType(EditableText))
            : control;
        expect(target.hitTestable(), findsOneWidget);
        final rect = tester.getRect(control);
        expect(
          rect.top,
          greaterThanOrEqualTo(tester.getRect(find.byType(AppBar)).bottom),
        );
        expect(rect.bottom, lessThanOrEqualTo(844 - 300));
        expect(pageScroll(), findsOneWidget);
        expect(tester.testTextInput.isVisible, isTrue);
      }
      expect(tester.getRect(consent).bottom, tester.getRect(submit).top);
      expect(
        tester.getRect(consent).top,
        greaterThanOrEqualTo(tester.getRect(find.byType(AppBar)).bottom),
      );
      await tester.tap(consent);
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'account A to B clears comparison, service, consent and private drafts',
    (tester) async {
      var account = 'parent@example.test';
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/login/')) {
            account = (jsonDecode(body!) as Map)['email'] as String;
            return ok({'csrf_token': 'rotated'});
          }
          if (uri.path.endsWith('/me/'))
            return ok({
              'role': 'parent',
              'email': account,
              'display_name': 'Familia B',
            });
          if (uri.path.endsWith('/profile/'))
            return ok({'display_name': 'Familia B', 'email': account});
          return null;
        },
      );
      final auth = await mount(tester, transport);
      for (final id in [1, 2]) {
        await tapVisible(tester, ValueKey('compare-driver-$id'));
      }
      await tapVisible(tester, const Key('compare-selected'));
      await auth.login('b@example.test', 'synthetic');
      await tester.pumpAndSettle();
      expect(find.text('Encuentra transporte'), findsOneWidget);
      expect(find.byKey(const Key('comparison-back')), findsNothing);
      expect(find.byKey(const Key('compare-selected')), findsNothing);
      await beginContact(tester);
      await tapVisible(tester, const Key('contact-consent'));
      await auth.login('c@example.test', 'synthetic');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.textContaining('b@example.test'), findsNothing);
      expect(find.textContaining('Solicitud enviada'), findsNothing);
      await openService(tester);
      await tapVisible(tester, const Key('start-contact'));
      expect(find.text('c@example.test'), findsOneWidget);
      expect(
        tester
            .widget<TextField>(find.byKey(const Key('contact-message')))
            .controller!
            .text,
        isEmpty,
      );
      await reveal(tester, const Key('contact-consent'));
      expect(
        tester
            .widget<CheckboxListTile>(find.byKey(const Key('contact-consent')))
            .value,
        isFalse,
      );
    },
  );

  testWidgets(
    'replacement and expiry remove accepted contact and participant requests',
    (tester) async {
      var accountB = false;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/login/')) {
            accountB = true;
            return ok({'csrf_token': 'rotated'});
          }
          if (uri.path.endsWith('/me/'))
            return ok({
              'role': 'parent',
              'email': 'b@example.test',
              'display_name': 'Familia B',
            });
          if (uri.path.endsWith('/contact-requests/'))
            return ok({
              'results': accountB ? [] : [request(7, status: 'accepted')],
            });
          if (uri.path.endsWith('/contact-requests/7/'))
            return ok(request(7, status: 'accepted'));
          return null;
        },
      );
      final auth = await mount(tester, transport);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ver solicitud'));
      await tester.pumpAndSettle();
      expect(find.text('service@example.test'), findsOneWidget);
      await auth.login('b@example.test', 'synthetic');
      await tester.pumpAndSettle();
      expect(find.text('service@example.test'), findsNothing);
      expect(find.text('Tu mensaje'), findsNothing);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('request-card-7')), findsNothing);
      auth.expire();
      await tester.pumpAndSettle();
      expect(find.text('Tus solicitudes'), findsNothing);
      expect(find.textContaining('b@example.test'), findsNothing);
    },
  );

  for (final mode in ['read', 'write', 'expiry-error']) {
    testWidgets('late A $mode cannot repopulate B or expire the new session', (
      tester,
    ) async {
      final pending = Completer<AuthHttpResponse>();
      var accountB = false;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/login/')) {
            accountB = true;
            return ok({'csrf_token': 'rotated'});
          }
          if (uri.path.endsWith('/me/'))
            return ok({
              'role': 'parent',
              'email': 'b@example.test',
              'display_name': 'Familia B',
            });
          if (uri.path.endsWith('/contact-requests/7/') && !accountB)
            return pending.future;
          if (uri.path.endsWith('/contact-requests/') &&
              method == 'POST' &&
              !accountB)
            return pending.future;
          if (uri.path.endsWith('/contact-requests/') && accountB)
            return ok({'results': []});
          return null;
        },
      );
      final auth = await mount(tester, transport);
      if (mode == 'write') {
        await beginContact(tester);
        await tapVisible(tester, const Key('contact-consent'));
        await reveal(tester, const Key('send-contact-request'));
        await tester.tap(find.byKey(const Key('send-contact-request')));
      } else {
        await tester.tap(find.text('Solicitudes'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Ver solicitud'));
      }
      await tester.pump();
      await auth.login('b@example.test', 'synthetic');
      await tester.pumpAndSettle();
      pending.complete(
        mode == 'expiry-error'
            ? ok({'code': 'not_authenticated', 'message': 'old expiry'}, 403)
            : ok(request(7, status: 'accepted'), mode == 'write' ? 201 : 200),
      );
      await tester.pumpAndSettle();
      expect(auth.state, AuthState.parent);
      expect(auth.email, 'b@example.test');
      expect(find.text('Encuentra transporte'), findsOneWidget);
      expect(find.textContaining('service@example.test'), findsNothing);
      expect(find.text('Solicitud enviada'), findsNothing);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.byKey(const Key('comparison-back')), findsNothing);
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('request-card-7')), findsNothing);
    });
  }

  testWidgets(
    'auth failure clears parent state; unsupported replacement exposes none',
    (tester) async {
      var expired = false;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/contact-requests/') && expired)
            return ok({'code': 'not_authenticated', 'message': 'expired'}, 403);
          if (uri.path.endsWith('/login/'))
            return ok({'csrf_token': 'rotated'});
          if (uri.path.endsWith('/me/'))
            return ok({
              'role': 'admin',
              'email': 'admin@example.test',
              'display_name': 'Admin',
            });
          return null;
        },
      );
      final auth = await mount(tester, transport);
      await beginContact(tester);
      expired = true;
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      expect(auth.state, AuthState.signedOut);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.textContaining('parent@example.test'), findsNothing);
      await auth.login('admin@example.test', 'synthetic');
      await tester.pumpAndSettle();
      expect(auth.state, AuthState.unsupported);
      expect(find.text('Encuentra transporte'), findsNothing);
      expect(find.text('Tus solicitudes'), findsNothing);
      expect(find.textContaining('parent@example.test'), findsNothing);
    },
  );
  testWidgets('cancel confirms server state independently of failed refresh', (
    tester,
  ) async {
    var cancelled = false;
    final transport = fixture(
      override: (uri, method, body) {
        if (uri.path.endsWith('/cancel/')) {
          cancelled = true;
          return ok(request(7, status: 'cancelled'));
        }
        if (cancelled &&
            uri.path.endsWith('/contact-requests/') &&
            method == 'GET')
          return Future<AuthHttpResponse>.error(
            const SocketException('offline'),
          );
        return null;
      },
    );
    await mount(tester, transport);
    await tester.tap(find.text('Solicitudes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ver solicitud'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Cancelar solicitud'));
    await tester.tap(find.text('Cancelar solicitud'));
    await tester.pumpAndSettle();
    expect(find.text('Cancelada'), findsOneWidget);
    expect(find.textContaining('el cambio está confirmado'), findsOneWidget);
    expect(
      transport.calls.where((call) => call.contains('/cancel/')).length,
      1,
    );
  });

  testWidgets(
    'cancel conflict requires fresh state rather than repeating write',
    (tester) async {
      var changed = false;
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/cancel/')) {
            changed = true;
            return ok({'code': 'contact_conflict', 'message': 'Changed'}, 409);
          }
          if (uri.path.endsWith('/contact-requests/') && changed)
            return ok({
              'results': [request(7, status: 'accepted')],
            });
          return null;
        },
      );
      await mount(tester, transport);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ver solicitud'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Cancelar solicitud'));
      await tester.tap(find.text('Cancelar solicitud'));
      await tester.pumpAndSettle();
      expect(find.textContaining('La solicitud cambió'), findsOneWidget);
      expect(find.text('Reintentar'), findsNothing);
      expect(find.text('Cancelar solicitud'), findsNothing);
      await tester.ensureVisible(find.text('Actualizar Solicitudes'));
      await tester.tap(find.text('Actualizar Solicitudes'));
      await tester.pumpAndSettle();
      expect(find.text('Aceptada'), findsOneWidget);
      expect(find.text('service@example.test'), findsNothing);
    },
  );

  testWidgets(
    'participant denial removes retained row and does not reveal contact',
    (tester) async {
      final transport = fixture(
        requests: [request(7, status: 'accepted')],
        override: (uri, method, body) =>
            uri.path.endsWith('/contact-requests/7/')
            ? ok({'code': 'not_found', 'message': 'Not found'}, 404)
            : null,
      );
      await mount(tester, transport);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Ver solicitud'));
      await tester.pumpAndSettle();
      expect(
        find.text('Esta solicitud ya no está disponible para tu cuenta.'),
        findsOneWidget,
      );
      expect(find.byKey(const ValueKey('request-card-7')), findsNothing);
      expect(find.text('service@example.test'), findsNothing);
      expect(find.text('Reintentar'), findsNothing);
    },
  );

  testWidgets(
    'send eligibility failure removes form, selected service and stale search',
    (tester) async {
      final transport = fixture(
        override: (uri, method, body) =>
            uri.path.endsWith('/contact-requests/') && method == 'POST'
            ? ok({'code': 'driver_ineligible', 'message': 'Hidden'}, 409)
            : null,
      );
      await mount(tester, transport);
      await beginContact(tester);
      await consentAndSend(tester);
      expect(find.text('Este servicio ya no está disponible.'), findsOneWidget);
      expect(find.text('Conductor Demo 1'), findsNothing);
      expect(find.byKey(const Key('contact-message')), findsNothing);
      expect(find.textContaining('parent@example.test'), findsNothing);
      expect(find.text('Reintentar'), findsNothing);
    },
  );

  testWidgets('Android back returns through focused tasks and request inbox', (
    tester,
  ) async {
    await mount(tester, fixture());
    await beginContact(tester);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('contact-message')), findsNothing);
    expect(find.byKey(const Key('start-contact')), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Encuentra transporte'), findsOneWidget);
    await tester.tap(find.text('Solicitudes'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ver solicitud'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('Tus solicitudes'), findsOneWidget);
  });

  testWidgets(
    'active commune chooses matching route context without local service filtering',
    (tester) async {
      final north = driver(1)['routes'] as List;
      final service = {
        ...driver(1),
        'routes': [
          {
            ...north.first as Map<String, dynamic>,
            'label': 'Ruta Sur',
            'available_seats': 0,
            'coverage': [
              {'code': 'demo-sur', 'display_name': 'Comuna Demo Sur'},
            ],
          },
          {
            ...north.first as Map<String, dynamic>,
            'id': 22,
            'label': 'Ruta Norte',
          },
        ],
      };
      final transport = fixture(services: [service]);
      await mount(tester, transport);
      expect(
        find.text('Sin cupos disponibles · 0 de 3 disponibles'),
        findsOneWidget,
      );
      await search(tester);
      expect(find.textContaining('Ruta Norte'), findsOneWidget);
      expect(find.text('3 de 3 disponibles'), findsOneWidget);
      expect(find.textContaining('Ruta Sur'), findsNothing);
      expect(
        transport.calls.last,
        'GET /api/v1/discovery/drivers/?commune=demo-norte',
      );
    },
  );
  testWidgets(
    'discovery card groups identity trust route and dated capacity with button comparison',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        await mount(tester, fixture());
        final card = find.byKey(const ValueKey('driver-card-1'));
        Finder inside(Finder child) =>
            find.descendant(of: card, matching: child);
        expect(inside(find.text('Conductor Demo 1')), findsOneWidget);
        expect(
          inside(find.bySemanticsLabel('Conductor validado')),
          findsOneWidget,
        );
        expect(inside(find.text('Comuna Demo Norte')), findsOneWidget);
        expect(inside(find.text('Ruta demo')), findsOneWidget);
        expect(
          inside(find.textContaining('Lun · 07:00–08:00')),
          findsOneWidget,
        );
        expect(inside(find.text('Cupos para el 28-09-2026')), findsOneWidget);
        expect(
          inside(
            find.bySemanticsLabel('Cupos disponibles, 3 de 3 disponibles'),
          ),
          findsOneWidget,
        );
        expect(find.byType(CheckboxListTile), findsNothing);
        final compare = find.byKey(const ValueKey('compare-driver-1'));
        await tapVisible(tester, const ValueKey('compare-driver-1'));
        expect(
          find.descendant(of: compare, matching: find.text('Agregado')),
          findsOneWidget,
        );
        expect(tester.widget<ParentCompareAction>(compare).selected, isTrue);
        expect(
          tester
              .getSemantics(compare)
              .getSemanticsData()
              .flagsCollection
              .isSelected,
          Tristate.isTrue,
        );
        await tapVisible(tester, const ValueKey('compare-driver-1'));
        expect(tester.widget<ParentCompareAction>(compare).selected, isFalse);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'detail leads with contact and secondary disclosures remain reachable',
    (tester) async {
      await mount(tester, fixture());
      await openService(tester);
      expect(find.text('Servicio demo'), findsNothing);
      expect(find.textContaining('certificación estatal'), findsNothing);
      final list = tester.widget<ListView>(find.byType(ListView));
      final children =
          (list.childrenDelegate as SliverChildListDelegate).children;
      expect(
        children.indexWhere((child) => child.key == const Key('service-hero')),
        lessThan(
          children.indexWhere(
            (child) => child.key == const Key('service-coverage'),
          ),
        ),
      );
      await reveal(tester, const Key('service-coverage'));
      await tapControl(tester, find.text('Cobertura y horario'));
      expect(find.textContaining('Ruta demo'), findsWidgets);
      await reveal(tester, const Key('service-about'));
      await tapControl(tester, find.text('Acerca del servicio'));
      expect(find.text('Servicio demo'), findsOneWidget);
      await reveal(tester, const Key('service-trust'));
      await tapControl(tester, find.text('¿Qué significa validado?'));
      expect(
        find.textContaining('No es una certificación estatal'),
        findsOneWidget,
      );
      expect(pageScroll(), findsOneWidget);
    },
  );

  testWidgets(
    'exact email and recipient precede unchecked consent with privacy on demand',
    (tester) async {
      tester.view.physicalSize = const Size(390, 1100);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final semantics = tester.ensureSemantics();
      try {
        final auth = await mount(tester, fixture());
        auth.email = 'parent.task03@example.test';
        await openService(tester);
        await tapVisible(tester, const Key('start-contact'));
        expect(find.text('parent.task03@example.test'), findsOneWidget);
        expect(find.text('Para: Conductor Demo 1'), findsOneWidget);
        expect(
          find.text(
            'Este correo se compartirá con Conductor Demo 1 para facilitar el contacto.',
          ),
          findsOneWidget,
        );
        expect(
          find.textContaining('No es aceptación de Términos'),
          findsNothing,
        );
        final children =
            (tester.widget<ListView>(find.byType(ListView)).childrenDelegate
                    as SliverChildListDelegate)
                .children;
        int index(String key) =>
            children.indexWhere((child) => child.key == Key(key));
        expect(index('contact-recipient'), greaterThanOrEqualTo(0));
        expect(index('contact-recipient'), lessThan(index('contact-summary')));
        expect(index('contact-summary'), lessThan(index('contact-message')));
        expect(index('contact-message'), lessThan(index('contact-consent')));
        expect(index('send-contact-request'), index('contact-consent') + 1);
        expect(
          index('send-contact-request'),
          lessThan(index('contact-privacy')),
        );
        final labels = <String>[];
        void readInOrder(SemanticsNode node) {
          final data = node.getSemanticsData();
          labels.add('${data.label} ${data.value}');
          for (final child in node.debugListChildrenInOrder(
            DebugSemanticsDumpOrder.traversalOrder,
          )) {
            readInOrder(child);
          }
        }

        readInOrder(tester.getSemantics(find.byType(ListView)));
        final order =
            [
                  'Para: Conductor Demo 1',
                  'parent.task03@example.test',
                  'Mensaje',
                  'Acepto compartir este correo',
                  'Enviar solicitud',
                  'Privacidad de este contacto',
                ]
                .map(
                  (label) =>
                      labels.indexWhere((value) => value.contains(label)),
                )
                .toList();
        expect(order, everyElement(greaterThanOrEqualTo(0)));
        expect(order, orderedEquals([...order]..sort()));
        await reveal(tester, const Key('contact-consent'));
        expect(
          tester
              .widget<CheckboxListTile>(
                find.byKey(const Key('contact-consent')),
              )
              .value,
          isFalse,
        );
        await reveal(tester, const Key('contact-privacy'));
        await tapControl(tester, find.text('Privacidad de este contacto'));
        expect(
          find.textContaining(
            'No es aceptación de Términos ni de la Política de Privacidad',
          ),
          findsOneWidget,
        );
        expect(
          find.textContaining('No es autorización sobre datos de niños'),
          findsOneWidget,
        );
        await reveal(tester, const Key('send-contact-request'));
        expect(
          find.byKey(const Key('send-contact-request')).hitTestable(),
          findsOneWidget,
        );
        expect(
          tester
              .widget<CheckboxListTile>(
                find.byKey(const Key('contact-consent')),
              )
              .value,
          isFalse,
        );
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'send has disabled styling and semantics until explicit consent',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final transport = fixture();
        await mount(tester, transport);
        await beginContact(tester);
        final submit = find.byKey(const Key('send-contact-request'));
        final consent = find.byKey(const Key('contact-consent'));
        await reveal(tester, const Key('send-contact-request'));
        expect(tester.widget<FilledButton>(submit).onPressed, isNull);
        expect(
          tester
              .getSemantics(submit)
              .getSemanticsData()
              .flagsCollection
              .isEnabled,
          Tristate.isFalse,
        );
        Color? buttonColor() => tester
            .widget<Material>(
              find
                  .descendant(of: submit, matching: find.byType(Material))
                  .first,
            )
            .color;
        final disabledColor = buttonColor();
        expect(disabledColor, const Color(0xFFE0E4EA));
        await tester.tap(submit);
        await tester.pumpAndSettle();
        expect(
          transport.calls.where((call) => call.startsWith('POST ')),
          isEmpty,
        );
        expect(find.byKey(const Key('contact-error')), findsNothing);
        await tapVisible(tester, const Key('contact-consent'));
        await reveal(tester, const Key('send-contact-request'));
        expect(tester.widget<FilledButton>(submit).onPressed, isNotNull);
        expect(
          tester
              .getSemantics(submit)
              .getSemanticsData()
              .flagsCollection
              .isEnabled,
          Tristate.isTrue,
        );
        expect(buttonColor(), parentBlue);
        expect(buttonColor(), isNot(disabledColor));
        await tapVisible(tester, const Key('contact-consent'));
        await reveal(tester, const Key('send-contact-request'));
        expect(tester.widget<CheckboxListTile>(consent).value, isFalse);
        expect(tester.widget<FilledButton>(submit).onPressed, isNull);
        expect(
          tester
              .getSemantics(submit)
              .getSemanticsData()
              .flagsCollection
              .isEnabled,
          Tristate.isFalse,
        );
        expect(
          transport.calls.where((call) => call.startsWith('POST ')),
          isEmpty,
        );
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets(
    'Buscar refresh uses a secondary text action and accessible label',
    (tester) async {
      final semantics = tester.ensureSemantics();
      try {
        final transport = fixture();
        await mount(tester, transport);
        final refresh = find.byKey(const Key('refresh-search'));
        expect(tester.widget(refresh), isA<TextButton>());
        expect(
          find.descendant(of: refresh, matching: find.text('Actualizar')),
          findsOneWidget,
        );
        expect(
          tester.getSemantics(refresh).getSemanticsData().label,
          contains('Actualizar'),
        );
        expect(find.text('Reintentar'), findsNothing);
        int reads() => transport.calls
            .where((call) => call == 'GET /api/v1/discovery/drivers/')
            .length;
        expect(reads(), 1);
        await tester.tap(refresh);
        await tester.pumpAndSettle();
        expect(reads(), 2);
      } finally {
        semantics.dispose();
      }
    },
  );

  testWidgets('service actions have clearance above navigation at 390x844', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    tester.view.padding = const FakeViewPadding(bottom: 24);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPadding);
    await mount(tester, fixture());
    Finder action(int id) => find.descendant(
      of: find.byKey(ValueKey('driver-card-$id')),
      matching: find.widgetWithText(FilledButton, 'Ver servicio'),
    );
    final navTop = tester.getTopLeft(find.byType(NavigationBar)).dy;
    expect(action(1).hitTestable(), findsOneWidget);
    expect(tester.getRect(action(1)).bottom, lessThanOrEqualTo(navTop - 16));
    final scroll = tester.state<ScrollableState>(pageScroll()).position;
    scroll.jumpTo(scroll.maxScrollExtent);
    await tester.pumpAndSettle();
    expect(action(3).hitTestable(), findsOneWidget);
    expect(tester.getRect(action(3)).bottom, lessThanOrEqualTo(navTop - 24));
    await tester.tap(action(3));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('service-hero')), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'account summary and supported name edit retain account content',
    (tester) async {
      var visibleName = 'Familia Demo';
      final transport = fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/profile/')) {
            if (method == 'PATCH')
              visibleName =
                  (jsonDecode(body!) as Map)['display_name'] as String;
            return ok({
              'display_name': visibleName,
              'email': 'parent@example.test',
            });
          }
          return null;
        },
      );
      await mount(tester, transport);
      await tester.tap(find.text('Mi cuenta'));
      await tester.pumpAndSettle();
      expect(find.text('Apoderado/a'), findsOneWidget);
      expect(find.text('Familia Demo'), findsOneWidget);
      expect(find.text('parent@example.test'), findsOneWidget);
      expect(find.text('Cerrar sesión').hitTestable(), findsOneWidget);
      await tester.tap(find.text('Editar nombre'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'Familia Sur');
      await tapControl(
        tester,
        find.widgetWithText(FilledButton, 'Guardar nombre'),
      );
      expect(find.text('Familia Sur'), findsOneWidget);
      expect(find.text('parent@example.test'), findsOneWidget);
      expect(
        transport.calls.where(
          (call) => call == 'PATCH /api/v1/parent/profile/',
        ),
        hasLength(1),
      );
    },
  );
  testWidgets(
    'narrow doubled text keeps active filters inbox and account reachable',
    (tester) async {
      tester.view.physicalSize = const Size(360, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: const TextScaler.linear(2)),
            child: child!,
          ),
          home: ParentHome(auth: parent(fixture())),
        ),
      );
      await tester.pumpAndSettle();
      await search(tester);
      expect(
        find.descendant(
          of: find.byKey(const Key('open-filters')),
          matching: find.text('1'),
        ),
        findsOneWidget,
      );
      await tapVisible(tester, const ValueKey('compare-driver-1'));
      await tapVisible(tester, const ValueKey('compare-driver-2'));
      expect(
        find.byKey(const Key('compare-selected')).hitTestable(),
        findsOneWidget,
      );
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Solicitudes'));
      await tester.pumpAndSettle();
      await reveal(tester, const ValueKey('request-card-7'));
      await tapControl(tester, find.text('Ver solicitud'));
      await reveal(tester, const Key('request-message'));
      await tapControl(tester, find.text('Tu mensaje'));
      expect(find.text('Consulta privada 7'), findsOneWidget);
      await tester.tap(find.text('Mi cuenta'));
      await tester.pumpAndSettle();
      await tapControl(tester, find.text('Editar nombre'));
      expect(find.byType(TextField), findsOneWidget);
      await tapControl(tester, find.text('Volver a Mi cuenta'));
      await tapControl(tester, find.text('Cerrar sesión'));
      expect(find.text('parent@example.test'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
