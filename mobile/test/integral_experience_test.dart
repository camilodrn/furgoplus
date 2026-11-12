import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/legal_access.dart';
import 'package:furgoplus/parent_home.dart';
import 'package:furgoplus/session_api.dart';
import 'driver_home_test.dart' as daily;
import 'parent_home_test.dart' as family;
import 'plan_help_test.dart' as help;
import 'legal_access_test.dart' as legal;

void viewport(WidgetTester tester, double width, double height, double scale) {
  tester.view.physicalSize = Size(width, height);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.view.resetViewInsets();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
}

Future<void> mountParent(
  WidgetTester tester,
  family.FakeTransport transport,
) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: furgoTheme(),
      home: LegalScope(child: ParentHome(auth: family.parent(transport))),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  test(
    'synthetic boundary uses explicit demo configuration or reserved identity',
    () {
      final transport = help.Transport();
      final auth = help.authFor(transport);
      expect(auth.usesSyntheticData, isFalse);
      auth.email = 'T12-PARENT@EXAMPLE.TEST';
      expect(auth.usesSyntheticData, isTrue);
      auth.email = 'persona@servicio.cl';
      expect(auth.usesSyntheticData, isFalse);
      final demo = AuthController(
        NativeSessionApi(
          ApiConfig('https://demo.furgoplus.cl'),
          help.MemoryStorage(),
          transport: transport,
        ),
      );
      expect(demo.usesSyntheticData, isTrue);
    },
  );

  testWidgets('synthetic destination cannot launch maps or mutate a service', (
    tester,
  ) async {
    final transport = daily.FakeTransport(
      (uri, method) => daily.ok(daily.today('planned')),
    );
    final auth = daily.controller(transport, AuthState.driver)
      ..email = 't12-elite@example.test';
    final launcher = daily.FakeLauncher();
    await tester.pumpWidget(
      MaterialApp(
        theme: furgoTheme(),
        home: DriverHome(auth: auth, launcher: launcher),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('Datos de ensayo'), findsOneWidget);
    await daily.showDetails(tester);
    final maps = find.byKey(const Key('maps-9'));
    await tester.ensureVisible(maps);
    expect(tester.widget<OutlinedButton>(maps).onPressed, isNull);
    expect(find.textContaining('Mapas no está disponible'), findsOneWidget);
    expect(launcher.addresses, isEmpty);
    expect(transport.calls.where((call) => call.startsWith('POST')), isEmpty);
  });

  testWidgets(
    'small roster has no pagination, singular capacity and clears empty search',
    (tester) async {
      final data = daily.today('planned');
      data['routes'][0]['available_seats'] = 1;
      data['routes'][0]['seat_capacity'] = 2;
      await daily.mountDriver(
        tester,
        daily.FakeTransport((uri, method) => daily.ok(data)),
      );
      await daily.showPassengers(tester);
      expect(find.text('1 de 2 cupos ocupados · 1 disponible'), findsOneWidget);
      expect(find.text('1 pasajero'), findsNothing);
      expect(find.textContaining('Página'), findsNothing);
      await tester.enterText(find.byType(TextField), 'sin coincidencia');
      await tester.pumpAndSettle();
      expect(find.text('Sin coincidencias en esta ruta.'), findsOneWidget);
      expect(find.text('0 resultados'), findsOneWidget);
      await tester.tap(find.byTooltip('Limpiar búsqueda'));
      await tester.pumpAndSettle();
      expect(find.text('Estudiante ficticio'), findsOneWidget);
      expect(find.text('912345678'), findsNothing);
    },
  );

  testWidgets('plan shows expiry once and extra benefits only on demand', (
    tester,
  ) async {
    await help.open(tester, help.Transport(), plan: true);
    expect(find.text('Vencimiento'), findsOneWidget);
    expect(find.text('Gestión de tus servicios y recorridos'), findsOneWidget);
    expect(find.text('Comparación mensual y Excel en la web'), findsNothing);
    await help.tap(tester, 'Más beneficios');
    expect(find.text('Comparación mensual y Excel en la web'), findsOneWidget);
    await help.tap(tester, 'Detalles del plan');
    expect(find.textContaining('Término:'), findsNothing);
    expect(find.textContaining('Hasta el'), findsNothing);
  });

  testWidgets(
    'guide search finds accented content and restores after an empty search',
    (tester) async {
      await help.open(tester, help.Transport());
      await help.tap(tester, 'Guías por tema');
      expect(find.byType(ChoiceChip), findsNothing);
      await tester.enterText(
        find.byKey(const Key('guide-search')),
        'sintetica',
      );
      await tester.pumpAndSettle();
      expect(find.text('Configurar rutas'), findsOneWidget);
      expect(find.text('Guía de otro rol'), findsNothing);
      await tester.enterText(
        find.byKey(const Key('guide-search')),
        'sin resultados',
      );
      await tester.pumpAndSettle();
      expect(
        find.text('No encontramos guías con esta búsqueda.'),
        findsOneWidget,
      );
      await help.tap(tester, 'Limpiar filtros de guías');
      await help.tap(tester, 'Configurar rutas');
      expect(find.text('Guía sintética revisada.'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('guide-search')), findsOneWidget);
    },
  );

  testWidgets('one support ticket has no page indicator', (tester) async {
    final transport = help.Transport()..rows = [help.ticketData()];
    await help.open(tester, transport);
    await help.tap(tester, 'Consultas de soporte');
    expect(find.text('1 consulta'), findsOneWidget);
    expect(find.textContaining('Página'), findsNothing);
    expect(find.text('Problema sintético'), findsOneWidget);
  });

  testWidgets('empty filtered search offers a full catalog recovery', (
    tester,
  ) async {
    final transport = family.fixture(
      override: (uri, method, body) =>
          uri.path.endsWith('/drivers/') && uri.hasQuery
          ? family.ok({'results': []})
          : null,
    );
    await mountParent(tester, transport);
    await family.search(tester);
    await family.tapControl(tester, find.text('Buscar en todas las comunas'));
    expect(transport.calls.last, 'GET /api/v1/discovery/drivers/');
    expect(find.text('3 servicios encontrados'), findsOneWidget);
  });

  testWidgets(
    'parent account returns to the help draft and Back closes only the active view',
    (tester) async {
      final transport = family.fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/help/'))
            return help.json(help.helpData(parent: true));
          if (uri.path.contains('/support/tickets/'))
            return help.json({'results': [], 'count': 0});
          return null;
        },
      );
      await mountParent(tester, transport);
      await tester.tap(find.byKey(const Key('parent-nav-help')));
      await tester.pumpAndSettle();
      await help.createForm(tester);
      await help.fill(tester);
      await tester.tap(find.byKey(const Key('open-parent-account')));
      await tester.pumpAndSettle();
      expect(find.text('Mi cuenta'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Asunto'), findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await help.reveal(tester, find.widgetWithText(TextField, 'Asunto'));
      expect(
        tester
            .widget<TextField>(find.widgetWithText(TextField, 'Asunto'))
            .controller!
            .text,
        'Problema sintético',
      );
      await help.reveal(tester, find.byType(CheckboxListTile));
      expect(
        tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        isTrue,
      );
      expect(transport.calls.where((call) => !call.startsWith('GET')), isEmpty);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  for (final (width, height, scale) in [
    (320.0, 844.0, 2.0),
    (360.0, 800.0, 2.0),
    (390.0, 844.0, 1.0),
    (412.0, 915.0, 2.0),
    (844.0, 390.0, 2.0),
  ]) {
    testWidgets(
      'parent complete read-only journey $width x $height text $scale',
      (tester) async {
        viewport(tester, width, height, scale);
        final transport = family.fixture(
          override: (uri, method, body) {
            if (uri.path.endsWith('/help/'))
              return help.json(help.helpData(parent: true));
            if (uri.path.contains('/support/tickets/'))
              return help.json({'results': [], 'count': 0});
            return null;
          },
        );
        await mountParent(tester, transport);
        await family.reveal(tester, const Key('synthetic-data-notice'));
        expect(find.textContaining('Datos de ensayo'), findsOneWidget);
        await family.openService(tester);
        await family.tapControl(tester, find.byKey(const Key('start-contact')));
        await family.tapControl(
          tester,
          find.byKey(const Key('contact-consent')),
        );
        await family.reveal(tester, const Key('send-contact-request'));
        expect(
          tester
              .widget<FilledButton>(
                find.byKey(const Key('send-contact-request')),
              )
              .onPressed,
          isNotNull,
        );
        expect(tester.takeException(), isNull);
        // Leave the reviewed form without sending anything.
        await tester.tap(find.byKey(const Key('parent-nav-help')));
        await tester.pumpAndSettle();
        expect(
          tester
              .widget<NavigationBar>(find.byType(NavigationBar))
              .selectedIndex,
          2,
        );
        await help.tap(tester, 'Guías por tema');
        await tester.enterText(find.byKey(const Key('guide-search')), 'buscar');
        await help.tap(tester, 'Buscar transporte');
        expect(find.text('Guía sintética revisada.'), findsOneWidget);
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('guide-search')), findsOneWidget);
        await tester.tap(find.byKey(const Key('open-parent-account')));
        await tester.pumpAndSettle();
        await family.tapControl(tester, find.text('Actualizar Mi cuenta'));
        await tester.scrollUntilVisible(
          find.text('Privacidad'),
          200,
          scrollable: family.pageScroll(),
        );
        await legal.open(tester, 'Privacidad');
        expect(find.byTooltip('Cerrar documento'), findsOneWidget);
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        tester.state<ScrollableState>(family.pageScroll()).position.jumpTo(0);
        await tester.pumpAndSettle();
        expect(find.text('Mi cuenta'), findsOneWidget);
        await tester.tap(
          find.widgetWithText(NavigationDestination, 'Solicitudes'),
        );
        await tester.pumpAndSettle();
        await family.tapControl(tester, find.text('Ver solicitud'));
        expect(
          find.text(
            'El servicio aún no responde. Puedes consultar el estado aquí.',
          ),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        expect(
          transport.calls.where((call) => !call.startsWith('GET')),
          isEmpty,
        );
        await tester.pumpWidget(const SizedBox.shrink());
      },
    );
  }
}
