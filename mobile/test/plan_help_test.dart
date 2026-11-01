import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/parent_home.dart';
import 'package:furgoplus/plan_help_screen.dart';
import 'package:furgoplus/plan_help_service.dart';
import 'package:furgoplus/session_api.dart';
import 'driver_home_test.dart' as driver_fixtures;

class MemoryStorage implements AuthStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String value) async => this.value = value;
  @override
  Future<void> clear() async => value = null;
}

class Call {
  Call(this.uri, this.method, this.headers, this.body);
  final Uri uri;
  final String method;
  final Map<String, String> headers;
  final Map<String, dynamic>? body;
}

AuthHttpResponse json(Object data, [int status = 200]) =>
    AuthHttpResponse(status, jsonEncode(data), []);

Map<String, dynamic> capabilityData({
  String plan = 'elite',
  bool suspended = false,
}) => {
  'plan': {
    'label': plan == 'basic'
        ? 'Básico'
        : plan == 'pro'
        ? 'Pro'
        : 'Elite',
    'support_priority': 'priority',
  },
  'evaluated_at': '2026-10-20T12:00:00Z',
  'subscription': {
    'status': suspended ? 'suspended' : 'active',
    'effective': !suspended,
    'starts_at': '2026-10-01T00:00:00Z',
    'ends_at': '2026-11-01T00:00:00Z',
  },
  'blockers': [if (suspended) 'subscription_suspended'],
  'capabilities': {
    for (final code in [
      'operations.core',
      'dashboard.basic',
      'help.center',
      'support.requests',
      'assistant.faq',
      'assistant.contextual',
      'reports.monthly.read',
      'reports.detail.read',
      'analytics.period_comparison',
      'reports.xlsx.export',
    ])
      code: {
        'implemented': true,
        'enabled':
            !code.startsWith('assistant.') &&
                !code.startsWith('reports.') &&
                !code.startsWith('analytics.') ||
            !suspended &&
                plan != 'basic' &&
                (plan == 'elite' ||
                    ['assistant.faq', 'reports.monthly.read'].contains(code)),
        'blockers': [
          suspended ? 'subscription_suspended' : 'plan_not_included',
        ],
      },
  },
};

Map<String, dynamic> helpData({bool parent = false}) => {
  'version': 'synthetic-v1',
  'service_notice':
      'La recepción automática no garantiza atención humana 24/7.',
  'privacy_notice': 'No incluyas datos de menores, contactos ni contraseñas.',
  'assistant_modes': parent ? [] : ['faq', 'contextual'],
  'articles': [
    {
      'id': 'start',
      'role': parent ? 'parent' : 'driver',
      'title': parent ? 'Buscar transporte' : 'Configurar rutas',
      'category': 'Primeros pasos',
      'body': 'Guía sintética revisada.',
    },
    {
      'id': 'support',
      'role': 'all',
      'title': 'Privacidad del soporte',
      'category': 'Soporte',
      'body': 'Contenido sintético de privacidad.',
    },
    // Defensive client filtering must not expose wrong-role content.
    {
      'id': 'other',
      'role': parent ? 'driver' : 'parent',
      'title': 'Guía de otro rol',
      'category': 'Otro rol',
      'body': 'No mostrar.',
    },
  ],
};

Map<String, dynamic> ticketData({
  String state = 'waiting_user',
  int version = 2,
}) => {
  'id': 17,
  'subject': 'Problema sintético',
  'severity': 3,
  'state': state,
  'priority': 'standard',
  'version': version,
  'created_at': '2026-10-20T12:00:00Z',
  'updated_at': '2026-10-20T13:00:00Z',
  'events': [
    {
      'id': 1,
      'author_role': 'parent',
      'body': 'Texto sintético inicial.',
      'reason': '',
      'to_state': 'open',
      'occurred_at': '2026-10-20T12:00:00Z',
    },
    {
      'id': 2,
      'author_role': 'admin',
      'body': 'Respuesta sintética del equipo.',
      'reason': 'Necesitamos más antecedentes.',
      'to_state': state,
      'occurred_at': '2026-10-20T13:00:00Z',
    },
  ],
};

class Transport implements AuthTransport {
  final calls = <Call>[];
  Map<String, dynamic> caps = capabilityData();
  bool parent = false, offline = false, denied = false, expired = false;
  int assistantStatus = 200, replyStatus = 200;
  List<Map<String, dynamic>> rows = [];
  Future<AuthHttpResponse> Function(Call)? handler;
  @override
  Future<AuthHttpResponse> send(
    Uri uri,
    String method, {
    Map<String, String> headers = const {},
    String? body,
  }) async {
    final call = Call(
      uri,
      method,
      headers,
      body == null ? null : jsonDecode(body),
    );
    calls.add(call);
    if (handler != null) return handler!(call);
    return respond(call);
  }

  AuthHttpResponse respond(Call call) {
    if (offline) throw const SocketException('Synthetic offline');
    if (expired) return json({'code': 'not_authenticated'}, 403);
    final path = call.uri.path;
    if (path.endsWith('auth/me/'))
      return json({
        'id': 2,
        'role': parent ? 'parent' : 'driver',
        'email': 'b@example.test',
        'display_name': 'Cuenta B sintética',
      });
    if (path.endsWith('auth/csrf/'))
      return json({'csrf_token': 'synthetic-token'});
    if (path.endsWith('auth/login/'))
      return json({'csrf_token': 'synthetic-login-token'});
    if (path.endsWith('driver/capabilities/')) return json(caps);
    if (path.endsWith('help/')) return json(helpData(parent: parent));
    if (path.endsWith('assistant/'))
      return assistantStatus == 200
          ? json({
              'answer': 'Respuesta automática sintética.',
              'context': [
                {'label': 'Plan', 'value': 'Elite'},
              ],
              'article_id': 'start',
              'content_version': 'synthetic-v1',
            })
          : json({'code': 'capability_unavailable'}, assistantStatus);
    if (path.contains('support/tickets/')) {
      if (denied) return json({'code': 'permission_denied'}, 403);
      if (call.method == 'POST') {
        if (path.endsWith('/17/') && replyStatus != 200)
          return json({'code': 'conflict'}, replyStatus);
        return json(
          ticketData(
            state: path.endsWith('/17/') ? 'in_progress' : 'open',
            version: 3,
          ),
          path.endsWith('/17/') ? 200 : 201,
        );
      }
      if (path.endsWith('/17/')) return json(ticketData());
      final offset = int.parse(call.uri.queryParameters['offset'] ?? '0');
      return json({
        'results': rows.skip(offset).take(10).toList(),
        'count': rows.length,
      });
    }
    if (path.endsWith('driver/today/'))
      return json({
        'service_date': '2026-10-20',
        'routes': [],
        'unfinished_runs': [],
      });
    if (path.endsWith('communes/')) return json({'communes': []});
    return json({'results': []});
  }

  @override
  void close() {}
}

AuthController authFor(Transport transport) => AuthController(
  NativeSessionApi(
    ApiConfig('https://api.example.test/'),
    MemoryStorage(),
    transport: transport,
  ),
)..state = transport.parent ? AuthState.parent : AuthState.driver;

Future<AuthController> open(
  WidgetTester tester,
  Transport t, {
  bool plan = false,
}) async {
  final auth = authFor(t);
  await tester.pumpWidget(
    MaterialApp(
      theme: furgoTheme(),
      home: PlanHelpScreen(auth: auth, close: () {}, showPlan: plan),
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

Future<void> reveal(WidgetTester tester, Finder finder) async {
  final list = find.byType(ListView);
  if (finder.evaluate().isEmpty && list.evaluate().isNotEmpty) {
    final controller = tester.widget<ListView>(list.first).controller!;
    controller.jumpTo(0);
    await tester.pump();
    for (var i = 0; i < 100 && finder.evaluate().isEmpty; i++) {
      controller.jumpTo(
        (controller.offset + 150).clamp(0, controller.position.maxScrollExtent),
      );
      await tester.pump();
    }
  }
  await Scrollable.ensureVisible(tester.element(finder.last), alignment: 0.5);
  await tester.pumpAndSettle();
}

Future<void> tap(WidgetTester tester, String label) async {
  final finder = find.text(label);
  await reveal(tester, finder);
  await tester.tap(finder.last);
  await tester.pumpAndSettle();
}

Future<void> enter(WidgetTester tester, Finder finder, String value) async {
  await reveal(tester, finder);
  await tester.enterText(finder, value);
  await tester.pump();
}

Future<void> createForm(WidgetTester tester) async {
  await tap(tester, 'Consultas de soporte');
  await tap(tester, 'Crear consulta');
}

Future<void> fill(WidgetTester tester) async {
  await enter(
    tester,
    find.widgetWithText(TextField, 'Asunto'),
    'Problema sintético',
  );
  await reveal(tester, find.widgetWithText(TextField, 'Describe el problema'));
  await enter(
    tester,
    find.widgetWithText(TextField, 'Describe el problema'),
    'No puedo consultar la guía sintética.',
  );
  await tap(tester, 'Revisé el texto y no contiene información privada.');
}

void main() {
  test('strict effective capabilities never grant from plan inclusion', () {
    expect(
      capabilityEnabled({
        'capabilities': {
          'x': {
            'included_in_plan': true,
            'implemented': false,
            'enabled': true,
          },
        },
      }, 'x'),
      isFalse,
    );
    expect(capabilityEnabled(null, 'assistant.faq'), isFalse);
    expect(planRestriction('subscription_expired'), contains('venció'));
    expect(
      helpDate('2026-10-20T09:00:00-03:00'),
      contains('hora del dispositivo'),
    );
    expect(helpDate(null), 'Sin fecha confirmada');
  });

  for (final plan in ['basic', 'pro', 'elite']) {
    testWidgets(
      '$plan separates plan benefits from effective assistant modes in help',
      (tester) async {
        final t = Transport()..caps = capabilityData(plan: plan);
        await open(tester, t, plan: true);
        expect(
          find.text(
            plan == 'basic'
                ? 'Plan Básico'
                : plan == 'pro'
                ? 'Plan Pro'
                : 'Plan Elite',
          ),
          findsOneWidget,
        );
        expect(find.text('Disponible con tu cuenta'), findsOneWidget);
        if (plan != 'basic') await tap(tester, 'Más beneficios');
        expect(
          find.text('Comparación mensual y Excel en la web'),
          plan == 'elite' ? findsOneWidget : findsNothing,
        );
        expect(find.text('reports.xlsx.export'), findsNothing);
        expect(find.text('Consultas de soporte'), findsNothing);
        expect(find.text('Asistente automático'), findsNothing);
        expect(t.calls.any((c) => c.uri.path.endsWith('/help/')), isFalse);
        // Help remains a separate destination with the same effective permissions.
        await tester.pumpWidget(const SizedBox.shrink());
        await open(tester, t);
        if (plan == 'basic') {
          expect(find.text('Asistente automático'), findsNothing);
        } else {
          await tap(tester, 'Asistente automático');
          expect(
            find.text('Incluir estados de mi cuenta'),
            plan == 'elite' ? findsOneWidget : findsNothing,
          );
        }
        expect(
          t.calls.any((c) => c.uri.path.endsWith('/driver/capabilities/')),
          isTrue,
        );
      },
    );
  }

  testWidgets(
    'suspended subscription preserves help, support and no assistant',
    (tester) async {
      final t = Transport()..caps = capabilityData(suspended: true);
      await open(tester, t, plan: true);
      expect(find.text('Tu suscripción está suspendida.'), findsOneWidget);
      expect(find.text('Asistente automático'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      await open(tester, t);
      await tap(tester, 'Consultas de soporte');
      expect(find.text('Crear consulta'), findsOneWidget);
    },
  );

  testWidgets(
    'parent gets own guides and authorized support without driver API',
    (tester) async {
      final t = Transport()..parent = true;
      await open(tester, t);
      expect(find.text('Ayuda para apoderados'), findsOneWidget);
      expect(find.text('Asistente automático'), findsNothing);
      await tap(tester, 'Guías por tema');
      expect(find.text('Buscar transporte'), findsOneWidget);
      expect(find.text('Guía de otro rol'), findsNothing);
      await tap(tester, 'Soporte');
      expect(find.text('Buscar transporte'), findsNothing);
      await tap(tester, 'Privacidad del soporte');
      expect(find.text('Contenido sintético de privacidad.'), findsOneWidget);
      expect(t.calls.any((c) => c.uri.path.contains('driver/')), isFalse);
    },
  );

  testWidgets('backend denial never offers parent a support form', (
    tester,
  ) async {
    final t = Transport()
      ..parent = true
      ..denied = true;
    await open(tester, t);
    await tap(tester, 'Consultas de soporte');
    expect(find.textContaining('no tiene permiso'), findsOneWidget);
    expect(find.text('Crear consulta'), findsNothing);
    expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
  });

  testWidgets(
    'creation requires review, resets consent on editing and sends CSRF',
    (tester) async {
      final t = Transport()..parent = true;
      await open(tester, t);
      await createForm(tester);
      await reveal(tester, find.text('Enviar consulta'));
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Enviar consulta'),
            )
            .onPressed,
        isNull,
      );
      await fill(tester);
      await enter(
        tester,
        find.widgetWithText(TextField, 'Asunto'),
        'Otra consulta sintética',
      );
      await reveal(tester, find.byType(CheckboxListTile));
      expect(
        tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        isFalse,
      );
      await tap(tester, 'Revisé el texto y no contiene información privada.');
      await tap(tester, 'Enviar consulta');
      final call = t.calls.singleWhere(
        (c) => c.method == 'POST' && c.uri.path.endsWith('/tickets/'),
      );
      expect(call.body, {
        'subject': 'Otra consulta sintética',
        'body': 'No puedo consultar la guía sintética.',
        'severity': 3,
        'privacy_confirmed': true,
      });
      expect(call.headers['X-CSRFToken'], 'synthetic-token');
      expect(call.headers['Origin'], 'https://api.example.test');
      expect(find.text('Consulta enviada.'), findsOneWidget);
      expect(find.text('Abierta'), findsWidgets);
    },
  );

  testWidgets('cancel creates no request', (tester) async {
    final t = Transport();
    await open(tester, t);
    await createForm(tester);
    await fill(tester);
    await tap(tester, 'Cancelar');
    expect(find.text('Consultas de soporte'), findsOneWidget);
    expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
  });

  testWidgets('uncertain send is blocked until checking requests', (
    tester,
  ) async {
    final t = Transport();
    await open(tester, t);
    await createForm(tester);
    await fill(tester);
    t.handler = (call) async {
      if (call.method == 'POST')
        throw const SocketException('Synthetic lost response');
      return t.respond(call);
    };
    await tap(tester, 'Enviar consulta');
    expect(
      find.textContaining('no pudimos confirmar el envío'),
      findsOneWidget,
    );
    await reveal(tester, find.text('Enviar consulta'));
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Enviar consulta'),
          )
          .onPressed,
      isNull,
    );
    await tap(tester, 'Consultar consultas antes de reenviar');
    expect(find.text('Consultas de soporte'), findsOneWidget);
  });

  testWidgets('history labels, optimistic reply and conflict recovery', (
    tester,
  ) async {
    final t = Transport()..rows = [ticketData()];
    await open(tester, t);
    await tap(tester, 'Consultas de soporte');
    await tap(tester, 'Problema sintético');
    expect(find.text('Equipo de soporte'), findsOneWidget);
    expect(find.text('Esperando tu respuesta'), findsWidgets);
    await enter(
      tester,
      find.widgetWithText(TextField, 'Tu respuesta'),
      'Respuesta sintética revisada.',
    );
    await tap(tester, 'Revisé el texto y no contiene información privada.');
    t.replyStatus = 409;
    await tap(tester, 'Enviar respuesta');
    await reveal(tester, find.textContaining('La consulta cambió'));
    expect(
      find.textContaining('La consulta cambió').hitTestable(),
      findsOneWidget,
    );
    final call = t.calls.last;
    expect(call.body, {
      'body': 'Respuesta sintética revisada.',
      'expected_version': 2,
    });
    await tap(tester, 'Actualizar historial');
    await reveal(tester, find.widgetWithText(TextField, 'Tu respuesta'));
    expect(find.widgetWithText(TextField, 'Tu respuesta'), findsOneWidget);
    expect(
      tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
      isFalse,
    );
  });

  testWidgets('closed ticket is read only', (tester) async {
    final t = Transport()..rows = [ticketData(state: 'closed')];
    t.handler = (call) async => call.uri.path.endsWith('/17/')
        ? json(ticketData(state: 'closed'))
        : t.respond(call);
    await open(tester, t);
    await tap(tester, 'Consultas de soporte');
    await tap(tester, 'Problema sintético');
    await reveal(tester, find.textContaining('consulta está cerrada'));
    expect(find.textContaining('consulta está cerrada'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('assistant FAQ versus contextual payload and explicit referral', (
    tester,
  ) async {
    final t = Transport();
    await open(tester, t);
    await tap(tester, 'Asistente automático');
    await tap(tester, 'Incluir estados de mi cuenta');
    await enter(
      tester,
      find.widgetWithText(TextField, 'Tu pregunta'),
      '¿Cómo reviso mi plan?',
    );
    await tap(tester, 'Consultar asistente');
    final call = t.calls.last;
    expect(call.body, {
      'question': '¿Cómo reviso mi plan?',
      'mode': 'contextual',
    });
    await reveal(tester, find.text('Plan: Elite'));
    expect(find.text('Plan: Elite'), findsOneWidget);
    expect(find.text('Leer guía de origen'), findsOneWidget);
    await tap(tester, 'Preparar consulta de soporte');
    expect(
      tester
          .widget<TextField>(
            find.widgetWithText(TextField, 'Describe el problema'),
          )
          .controller!
          .text,
      isEmpty,
    );
    expect(
      t.calls.where(
        (c) => c.method == 'POST' && c.uri.path.contains('tickets'),
      ),
      isEmpty,
    );
  });

  testWidgets(
    'plan downgrade refresh removes previous automatic response and modes',
    (tester) async {
      final t = Transport();
      await open(tester, t);
      await tap(tester, 'Asistente automático');
      await enter(
        tester,
        find.widgetWithText(TextField, 'Tu pregunta'),
        'Plan',
      );
      await tap(tester, 'Consultar asistente');
      await reveal(tester, find.text('Respuesta automática sintética.'));
      expect(find.text('Respuesta automática sintética.'), findsOneWidget);
      t.caps = capabilityData(plan: 'pro');
      await tester.tap(find.byTooltip('Actualizar información'));
      await tester.pumpAndSettle();
      expect(find.text('Respuesta automática sintética.'), findsNothing);
      expect(find.text('Incluir estados de mi cuenta'), findsNothing);
      t.caps = capabilityData(plan: 'basic');
      await tester.pump(const Duration(seconds: 31));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('asistente no está habilitado'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'server revocation during assistant action clears private state',
    (tester) async {
      final t = Transport();
      await open(tester, t);
      await tap(tester, 'Asistente automático');
      await enter(
        tester,
        find.widgetWithText(TextField, 'Tu pregunta'),
        'Plan',
      );
      t.assistantStatus = 403;
      await tap(tester, 'Consultar asistente');
      expect(find.textContaining('no tiene permiso'), findsOneWidget);
      expect(find.text('Respuesta automática sintética.'), findsNothing);
      expect(find.byType(TextField), findsNothing);
    },
  );

  testWidgets('offline load hides permissions and retries successfully', (
    tester,
  ) async {
    final t = Transport()..offline = true;
    await open(tester, t);
    expect(find.textContaining('Revisa tu conexión'), findsOneWidget);
    expect(find.text('Asistente automático'), findsNothing);
    t.offline = false;
    await tester.tap(find.byTooltip('Actualizar información'));
    await tester.pumpAndSettle();
    expect(find.text('Asistente automático'), findsOneWidget);
  });

  testWidgets('session expiry clears all feature content', (tester) async {
    final t = Transport();
    final auth = await open(tester, t);
    t.expired = true;
    await tester.tap(find.byTooltip('Actualizar información'));
    await tester.pumpAndSettle();
    expect(auth.state, AuthState.signedOut);
    expect(find.text('Ayuda para conductores'), findsNothing);
    expect(find.byType(TextField), findsNothing);
  });

  testWidgets('role/account replacement rejects delayed support history', (
    tester,
  ) async {
    final t = Transport()..rows = [ticketData()];
    final auth = await open(tester, t);
    final pending = Completer<AuthHttpResponse>();
    t.handler = (call) => call.uri.path.endsWith('/tickets/')
        ? pending.future
        : Future.value(t.respond(call));
    await tester.ensureVisible(find.text('Consultas de soporte'));
    await tester.tap(find.text('Consultas de soporte'));
    await tester.pump();
    t.parent = true;
    await auth
        .restore(); // Invalidates the old native requests and screen state.
    pending.complete(
      json({
        'results': [ticketData()],
        'count': 1,
      }),
    );
    await tester.pumpAndSettle();
    expect(auth.state, AuthState.parent);
    expect(auth.displayName, 'Cuenta B sintética');
    expect(find.text('Problema sintético'), findsNothing);
    expect(find.text('Crear consulta'), findsNothing);
  });

  testWidgets(
    'pause invalidates delayed assistant and resumes with fresh permission',
    (tester) async {
      final t = Transport();
      await open(tester, t);
      await tap(tester, 'Asistente automático');
      await enter(
        tester,
        find.widgetWithText(TextField, 'Tu pregunta'),
        'Plan',
      );
      final pending = Completer<AuthHttpResponse>();
      t.handler = (call) => call.uri.path.endsWith('/assistant/')
          ? pending.future
          : Future.value(t.respond(call));
      await reveal(tester, find.text('Consultar asistente'));
      await tester.tap(find.text('Consultar asistente'));
      await tester.pump();
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();
      t.caps = capabilityData(suspended: true);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      pending.complete(
        json({
          'answer': 'Contexto anterior privado',
          'context': [],
          'content_version': 'old',
        }),
      );
      await tester.pumpAndSettle();
      expect(find.text('Contexto anterior privado'), findsNothing);
      expect(
        find.textContaining('asistente no está habilitado'),
        findsOneWidget,
      );
    },
  );

  testWidgets('small viewport, large text and keyboard keep form reachable', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    tester.platformDispatcher.textScaleFactorTestValue = 2;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.view.resetViewInsets();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    await open(tester, Transport());
    await createForm(tester);
    tester.view.viewInsets = const FakeViewPadding(bottom: 280);
    await fill(tester);
    await reveal(tester, find.text('Enviar consulta'));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'pending creation blocks duplicate taps and timeout requires reconciliation',
    (tester) async {
      final t = Transport();
      await open(tester, t);
      await createForm(tester);
      await fill(tester);
      await reveal(tester, find.text('Enviar consulta'));
      final pending = Completer<AuthHttpResponse>();
      t.handler = (call) =>
          call.method == 'POST' && call.uri.path.endsWith('/tickets/')
          ? pending.future
          : Future.value(t.respond(call));
      final send = tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Enviar consulta'),
          )
          .onPressed!;
      send();
      send();
      await tester.pump();
      expect(
        t.calls
            .where(
              (c) => c.method == 'POST' && c.uri.path.endsWith('/tickets/'),
            )
            .length,
        1,
      );
      await tester.pump(const Duration(seconds: 21));
      await tester.pumpAndSettle();
      expect(
        find.textContaining('no pudimos confirmar el envío'),
        findsOneWidget,
      );
      await reveal(tester, find.text('Enviar consulta'));
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Enviar consulta'),
            )
            .onPressed,
        isNull,
      );
      pending.complete(json(ticketData()));
      await tester.pumpAndSettle();
      expect(find.text('Consulta enviada.'), findsNothing);
    },
  );

  testWidgets('pagination stays in own endpoint and advances by ten', (
    tester,
  ) async {
    final t = Transport()
      ..rows = [
        for (var i = 0; i < 12; i++)
          {...ticketData(), 'subject': 'Consulta sintética $i'},
      ];
    await open(tester, t);
    await tap(tester, 'Consultas de soporte');
    await tap(tester, 'Siguiente');
    expect(t.calls.last.uri.queryParameters, {'limit': '10', 'offset': '10'});
    expect(find.text('Consulta sintética 10'), findsOneWidget);
    await tap(tester, 'Anterior');
    expect(t.calls.last.uri.queryParameters['offset'], '0');
  });

  testWidgets(
    'resolved ticket reply reopens using the current server version',
    (tester) async {
      final t = Transport()..rows = [ticketData(state: 'resolved')];
      t.handler = (call) async =>
          call.method == 'GET' && call.uri.path.endsWith('/17/')
          ? json(ticketData(state: 'resolved'))
          : t.respond(call);
      await open(tester, t);
      await tap(tester, 'Consultas de soporte');
      await tap(tester, 'Problema sintético');
      await enter(
        tester,
        find.widgetWithText(TextField, 'Tu respuesta'),
        'Consulta sintética adicional.',
      );
      await tap(tester, 'Revisé el texto y no contiene información privada.');
      await tap(tester, 'Enviar respuesta');
      expect(t.calls.last.body!['expected_version'], 2);
      expect(find.text('En revisión'), findsWidgets);
    },
  );

  testWidgets('server expiry boundary refreshes effective permissions', (
    tester,
  ) async {
    final t = Transport();
    t.caps['subscription']['ends_at'] = '2026-10-20T12:00:01Z';
    await open(tester, t);
    t.caps = capabilityData(suspended: true);
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.text('Asistente automático'), findsNothing);
  });

  testWidgets(
    'CSRF timeout never sends a late support write or accepts late cookies',
    (tester) async {
      final t = Transport();
      final auth = authFor(t);
      final pending = Completer<AuthHttpResponse>();
      t.handler = (call) => pending.future;
      final future = PlanHelpService(
        auth.api,
      ).create('Consulta sintética', 'Texto sintético', 3);
      final rejected = expectLater(future, throwsA(isA<TimeoutException>()));
      await tester.pump(const Duration(seconds: 21));
      await rejected;
      pending.complete(
        AuthHttpResponse(200, jsonEncode({'csrf_token': 'late-token'}), [
          'sessionid=late; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax',
        ]),
      );
      await tester.pumpAndSettle();
      expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
      expect((auth.api.storage as MemoryStorage).value, isNull);
    },
  );

  testWidgets('expired session removes the old account page before logout', (
    tester,
  ) async {
    final t = Transport();
    final auth = authFor(t);
    await tester.pumpWidget(AuthApp(controller: auth));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('open-driver-account')));
    await tester.pumpAndSettle();
    auth.expire();
    await tester.pumpAndSettle();
    if (find.text('Cerrar sesión').evaluate().isNotEmpty) {
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
    }
    expect(auth.state, AuthState.signedOut);
    expect(find.text('Inicia sesión'), findsOneWidget);
    expect(t.calls.any((c) => c.uri.path.endsWith('/help/')), isFalse);
    expect(t.calls.any((c) => c.uri.path.endsWith('/logout/')), isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'bottom destinations stay visible through guides and support forms',
    (tester) async {
      final t = Transport();
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: authFor(t)),
        ),
      );
      await tester.pumpAndSettle();
      void expectNavigation(int selected) {
        final bar = tester.widget<NavigationBar>(find.byType(NavigationBar));
        expect(bar.selectedIndex, selected);
        expect(
          bar.labelBehavior,
          NavigationDestinationLabelBehavior.alwaysShow,
        );
        for (final key in ['today', 'plan', 'help']) {
          expect(
            find.byKey(Key('driver-nav-$key')).hitTestable(),
            findsOneWidget,
          );
        }
      }

      expectNavigation(0);
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      expectNavigation(1);
      expect(find.text('Plan Elite'), findsOneWidget);
      expect(find.text('Consultas de soporte'), findsNothing);
      expect(t.calls.any((c) => c.uri.path.endsWith('/help/')), isFalse);
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      expectNavigation(2);
      expect(find.text('Plan Elite'), findsNothing);
      await tap(tester, 'Guías por tema');
      await tap(tester, 'Configurar rutas');
      expectNavigation(2);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Guías por tema'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await createForm(tester);
      await fill(tester);
      expectNavigation(2);
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      expectNavigation(1);
      expect(find.byType(TextField), findsNothing);
      expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expectNavigation(0);
    },
  );

  testWidgets(
    'today keeps the selected service and contacts close after visiting plan',
    (tester) async {
      final t = Transport();
      final day = driver_fixtures.today('planned');
      day['routes'] = [
        ...(day['routes'] as List),
        {
          ...(day['routes'] as List).first as Map,
          'route_id': 10,
          'label': 'Otro recorrido sintético',
        },
      ];
      t.handler = (call) async => call.uri.path.endsWith('/driver/today/')
          ? json(day)
          : t.respond(call);
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: authFor(t)),
        ),
      );
      await tester.pumpAndSettle();
      await tap(tester, 'Otras rutas de hoy · 1');
      await tap(tester, 'Otro recorrido sintético');
      expect(find.byKey(const Key('today-route-10')), findsOneWidget);
      final reads = t.calls
          .where((c) => c.uri.path.endsWith('/driver/today/'))
          .length;
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-today')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('today-route-10')), findsOneWidget);
      expect(find.text('912345678'), findsNothing);
      expect(
        t.calls.where((c) => c.uri.path.endsWith('/driver/today/')).length,
        reads,
      );
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'navigation works during a pending today read and a failed plan read',
    (tester) async {
      final t = Transport();
      final pending = Completer<AuthHttpResponse>();
      t.handler = (call) async {
        if (call.uri.path.endsWith('/driver/today/')) return pending.future;
        if (call.uri.path.endsWith('/driver/capabilities/'))
          throw const SocketException('synthetic');
        return t.respond(call);
      };
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: authFor(t)),
        ),
      );
      await tester.pump();
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      expect(find.textContaining('conexión'), findsWidgets);
      await tester.tap(find.byKey(const Key('driver-nav-today')));
      await tester.pump();
      pending.complete(json(driver_fixtures.today('planned')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('start-9')), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'account page keeps navigation and clears when the session expires',
    (tester) async {
      final t = Transport();
      final auth = authFor(t);
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('b@example.test'), findsOneWidget);
      auth.expire();
      await tester.pumpAndSettle();
      expect(find.text('b@example.test'), findsNothing);
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Inicia sesión'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'logout from help clears draft before a different driver and parent session',
    (tester) async {
      final t = Transport();
      final auth = authFor(t);
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await createForm(tester);
      await fill(tester);
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cerrar sesión'));
      await tester.pumpAndSettle();
      expect(find.text('Inicia sesión'), findsOneWidget);
      t.caps = capabilityData(plan: 'basic');
      await auth.login('another-driver@example.test', 'synthetic-password');
      await tester.pumpAndSettle();
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        0,
      );
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      expect(find.text('No puedo consultar la guía sintética.'), findsNothing);
      expect(find.text('Asistente automático'), findsNothing);
      await createForm(tester);
      expect(
        tester
            .widget<TextField>(find.widgetWithText(TextField, 'Asunto'))
            .controller!
            .text,
        isEmpty,
      );
      t.parent = true;
      await auth.login('parent@example.test', 'synthetic-password');
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('driver-nav-plan')), findsNothing);
      expect(
        find.widgetWithText(NavigationDestination, 'Buscar'),
        findsOneWidget,
      );
      expect(find.text('No puedo consultar la guía sintética.'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('late help response cannot repopulate a new driver session', (
    tester,
  ) async {
    final t = Transport();
    final auth = authFor(t);
    final pending = Completer<AuthHttpResponse>();
    t.handler = (call) async =>
        call.uri.path.endsWith('/help/') ? pending.future : t.respond(call);
    await tester.pumpWidget(AuthApp(controller: auth));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('driver-nav-help')));
    await tester.pump();
    auth.expire();
    await tester.pumpAndSettle();
    t.handler = null;
    t.caps = capabilityData(plan: 'basic');
    await auth.login('new-driver@example.test', 'synthetic-password');
    await tester.pumpAndSettle();
    pending.complete(json(helpData()));
    await tester.pumpAndSettle();
    expect(auth.state, AuthState.driver);
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      0,
    );
    expect(find.text('Ayuda para conductores'), findsNothing);
    await tester.tap(find.byKey(const Key('driver-nav-plan')));
    await tester.pumpAndSettle();
    expect(find.text('Plan Básico'), findsOneWidget);
    expect(find.text('Plan Elite'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  for (final width in [320.0, 360.0, 390.0]) {
    testWidgets(
      'three labelled destinations remain usable at width $width and double text',
      (tester) async {
        tester.view.physicalSize = Size(width, 844);
        tester.view.devicePixelRatio = 1;
        tester.platformDispatcher.textScaleFactorTestValue = 2;
        addTearDown(() {
          tester.view.resetPhysicalSize();
          tester.view.resetDevicePixelRatio();
          tester.view.resetViewInsets();
          tester.platformDispatcher.clearTextScaleFactorTestValue();
        });
        await tester.pumpWidget(
          MaterialApp(
            theme: furgoTheme(),
            home: DriverHome(auth: authFor(Transport())),
          ),
        );
        await tester.pumpAndSettle();
        for (final key in ['plan', 'help', 'today']) {
          await tester.tap(find.byKey(Key('driver-nav-$key')));
          await tester.pumpAndSettle();
          for (final label in ['Hoy', 'Mi plan', 'Ayuda']) {
            expect(
              find.widgetWithText(NavigationDestination, label).hitTestable(),
              findsOneWidget,
            );
          }
          expect(
            find.byKey(const Key('open-driver-account')).hitTestable(),
            findsOneWidget,
          );
          expect(tester.takeException(), isNull);
        }
        await tester.tap(find.byKey(const Key('driver-nav-help')));
        await tester.pumpAndSettle();
        await createForm(tester);
        await reveal(tester, find.widgetWithText(TextField, 'Asunto'));
        await tester.showKeyboard(find.widgetWithText(TextField, 'Asunto'));
        tester.view.viewInsets = const FakeViewPadding(bottom: 300);
        await tester.pumpAndSettle();
        expect(
          tester.getBottomRight(find.byType(NavigationBar)).dy,
          lessThanOrEqualTo(544),
        );
        await tester.tap(find.byKey(const Key('driver-nav-today')));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<NavigationBar>(find.byType(NavigationBar))
              .selectedIndex,
          0,
        );
        expect(tester.testTextInput.isVisible, isFalse);
        expect(tester.takeException(), isNull);
      },
    );
  }

  for (final parent in [false, true]) {
    testWidgets(
      'existing ${parent ? 'parent' : 'driver'} home opens help and returns intact',
      (tester) async {
        final t = Transport()..parent = parent;
        final auth = authFor(t);
        await tester.pumpWidget(
          MaterialApp(
            theme: furgoTheme(),
            home: parent ? ParentHome(auth: auth) : DriverHome(auth: auth),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(
          parent
              ? find.byKey(const Key('parent-nav-help'))
              : find.byKey(const Key('driver-nav-help')),
        );
        await tester.pumpAndSettle();
        expect(
          find.text(
            parent ? 'Ayuda para apoderados' : 'Ayuda para conductores',
          ),
          findsOneWidget,
        );
        if (parent) {
          expect(find.byTooltip('Volver'), findsNothing);
          await tap(tester, 'Consultas de soporte');
          expect(find.text('Volver'), findsOneWidget);
          expect(find.byTooltip('Volver'), findsNothing);
          await tap(tester, 'Volver');
          expect(find.text('Ayuda para apoderados'), findsOneWidget);
          await tester.binding.handlePopRoute();
        } else {
          await tester.tap(find.byKey(const Key('driver-nav-today')));
        }
        await tester.pumpAndSettle();
        expect(
          find.text(parent ? 'Buscar' : 'Hoy'),
          parent ? findsOneWidget : findsNWidgets(2),
        );
      },
    );
  }
  testWidgets(
    'visible destination owns app bar and Back while Hoy retains passenger context',
    (tester) async {
      final t = Transport();
      t.handler = (call) async => call.uri.path.endsWith('/driver/today/')
          ? json(driver_fixtures.today('planned'))
          : t.respond(call);
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: authFor(t)),
        ),
      );
      await tester.pumpAndSettle();
      await driver_fixtures.showPassengers(tester);
      expect(find.byKey(const Key('journey-back')), findsOneWidget);
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('journey-back')), findsNothing);
      expect(find.byType(AppBar), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(AppBar),
          matching: find.text('Pasajeros'),
        ),
        findsNothing,
      );
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await tap(tester, 'Consultas de soporte');
      expect(find.byKey(const Key('journey-back')), findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Ayuda para conductores'), findsOneWidget);
      await tester.tap(find.byKey(const Key('driver-nav-today')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('journey-back')), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(AppBar),
          matching: find.text('Pasajeros'),
        ),
        findsOneWidget,
      );
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'integral support draft survives Hoy and Mi plan, Account and Android Back',
    (tester) async {
      final t = Transport();
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: authFor(t)),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await tap(tester, 'Consultas de soporte');
      await tap(tester, 'Crear consulta');
      await tester.enterText(
        find.widgetWithText(TextField, 'Asunto'),
        'Borrador integral sintético',
      );
      await tester.tap(find.byKey(const Key('driver-nav-today')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      expect(find.text('Borrador integral sintético'), findsOneWidget);
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Borrador integral sintético'), findsOneWidget);
      expect(t.calls.where((c) => c.method == 'POST'), isEmpty);
      expect(tester.takeException(), isNull);
    },
  );
}
