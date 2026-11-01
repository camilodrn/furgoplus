import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:furgoplus/api_config.dart';
import 'package:furgoplus/session_api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/auth_controller.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/parent_home.dart';

import 'driver_home_test.dart' as daily;
import 'plan_help_test.dart' as help;

void viewport(WidgetTester tester, double width, double scale) {
  tester.view.physicalSize = Size(width, 844);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.textScaleFactorTestValue = scale;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.view.resetViewInsets();
    tester.platformDispatcher.clearTextScaleFactorTestValue();
  });
}

help.Transport signedOutTransport() =>
    help.Transport()
      ..handler = (call) async => call.uri.path.endsWith('/auth/me/')
          ? help.json({'code': 'not_authenticated'}, 403)
          : help.json({'csrf_token': 'synthetic'});

void main() {
  test('text and semantic colours meet WCAG AA contrast', () {
    double contrast(Color first, Color second) {
      final a = first.computeLuminance();
      final b = second.computeLuminance();
      return ((a > b ? a : b) + .05) / ((a < b ? a : b) + .05);
    }

    for (final (foreground, background) in [
      (FurgoColors.ink, Colors.white),
      (FurgoColors.muted, FurgoColors.canvas),
      (Colors.white, FurgoColors.blue),
      (FurgoColors.blue, FurgoColors.blueSoft),
      (FurgoColors.success, FurgoColors.successSoft),
      (FurgoColors.warning, FurgoColors.warningSoft),
      (FurgoColors.error, FurgoColors.errorSoft),
    ]) {
      expect(contrast(foreground, background), greaterThanOrEqualTo(4.5));
    }
  });

  testWidgets(
    'login prioritizes fields, validates and distinguishes family signup',
    (tester) async {
      viewport(tester, 390, 1);
      final transport = signedOutTransport();
      await tester.pumpWidget(AuthApp(controller: help.authFor(transport)));
      await tester.pumpAndSettle();
      final login = find.widgetWithText(FilledButton, 'Iniciar sesión');
      expect(login.hitTestable(), findsOneWidget);
      expect(tester.getBottomRight(login).dy, lessThan(700));
      expect(find.textContaining('Los conductores crean'), findsNothing);
      final reads = transport.calls.length;
      await tester.tap(login);
      await tester.pumpAndSettle();
      expect(find.text('Escribe tu correo electrónico.'), findsOneWidget);
      expect(find.text('Escribe tu contraseña.'), findsOneWidget);
      expect(transport.calls.length, reads);
      await tester.ensureVisible(find.text('Crear cuenta de familia'));
      await tester.tap(find.text('Crear cuenta de familia'));
      await tester.pumpAndSettle();
      expect(find.text('Crea tu cuenta de familia'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Cómo te llamas'), findsOneWidget);
    },
  );

  testWidgets(
    'empty today is compact and offers one primary action to real help',
    (tester) async {
      viewport(tester, 390, 1);
      final transport = help.Transport();
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: help.authFor(transport)),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Sin servicio para hoy'), findsOneWidget);
      expect(find.byType(FilledButton), findsOneWidget);
      expect(find.text('Privacidad'), findsNothing);
      expect(
        tester.getBottomRight(find.text('Consultar guías')).dy,
        lessThan(500),
      );
      await tester.tap(find.text('Consultar guías'));
      await tester.pumpAndSettle();
      expect(find.text('Guías por tema'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
    },
  );

  testWidgets('no plan keeps real core access without a permission inventory', (
    tester,
  ) async {
    final transport = help.Transport()
      ..caps = {
        ...help.capabilityData(plan: 'basic'),
        'plan': null,
        'subscription': null,
        'blockers': ['subscription_missing'],
      };
    await help.open(tester, transport, plan: true);
    expect(find.text('Sin plan asignado'), findsOneWidget);
    expect(find.text('Gestión de tus servicios y recorridos'), findsOneWidget);
    expect(find.text('Guías y consultas de soporte'), findsOneWidget);
    expect(find.textContaining('restringidos'), findsNothing);
    expect(find.textContaining('Habilitado'), findsNothing);
    expect(find.textContaining('Asistente para'), findsNothing);
  });

  for (final (reason, label) in [
    ('subscription_not_started', 'Aún no comienza'),
    ('subscription_expired', 'Vencido'),
    ('subscription_suspended', 'Suspendido'),
  ]) {
    testWidgets('plan state $label does not advertise unavailable extras', (
      tester,
    ) async {
      final transport = help.Transport()
        ..caps = {
          ...help.capabilityData(suspended: true),
          'blockers': [reason],
        };
      await help.open(tester, transport, plan: true);
      expect(find.text(label), findsOneWidget);
      expect(
        find.text('Gestión de tus servicios y recorridos'),
        findsOneWidget,
      );
      expect(find.textContaining('Excel en la web'), findsNothing);
      expect(find.textContaining('Asistente con información'), findsNothing);
    });
  }

  testWidgets(
    'help places privacy under demand while support still requires explicit review',
    (tester) async {
      await help.open(tester, help.Transport());
      expect(find.text(help.helpData()['privacy_notice']), findsNothing);
      await help.tap(tester, 'Disponibilidad y privacidad');
      expect(find.text(help.helpData()['privacy_notice']), findsOneWidget);
      await help.createForm(tester);
      expect(find.text(help.helpData()['privacy_notice']), findsNothing);
      await help.tap(tester, 'Cómo cuidar tu información');
      expect(find.text(help.helpData()['privacy_notice']), findsOneWidget);
      await help.reveal(tester, find.text('Enviar consulta'));
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Enviar consulta'),
            )
            .onPressed,
        isNull,
      );
    },
  );

  testWidgets(
    'account keeps selected route and bottom navigation without a modal',
    (tester) async {
      final transport = help.Transport()
        ..handler = (call) async => call.uri.path.endsWith('/driver/today/')
            ? help.json(daily.today('in_progress'))
            : help.Transport().respond(call);
      final auth = help.authFor(transport)
        ..displayName = 'Conductor de prueba'
        ..email = 'conductor@example.test';
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: auth),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(find.text('Conductor de prueba'), findsOneWidget);
      expect(find.text('Conductor'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('En curso'), findsOneWidget);
      expect(find.text('Conductor de prueba'), findsNothing);
    },
  );

  testWidgets('parent help and keyboard retain all principal destinations', (
    tester,
  ) async {
    viewport(tester, 390, 2);
    final transport = help.Transport()..parent = true;
    transport.handler = (call) async =>
        call.uri.path.endsWith('/parent/profile/')
        ? help.json({
            'display_name': 'Familia de prueba',
            'email': 'familia@example.test',
          })
        : transport.respond(call);
    await tester.pumpWidget(
      MaterialApp(
        theme: furgoTheme(),
        home: ParentHome(auth: help.authFor(transport)),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('parent-nav-help')));
    await tester.pumpAndSettle();
    await help.createForm(tester);
    await help.reveal(tester, find.widgetWithText(TextField, 'Asunto'));
    await tester.showKeyboard(find.widgetWithText(TextField, 'Asunto'));
    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pumpAndSettle();
    expect(
      tester.getBottomRight(find.byType(NavigationBar)).dy,
      lessThanOrEqualTo(544),
    );
    await tester.tap(find.byKey(const Key('open-parent-account')));
    await tester.pumpAndSettle();
    expect(find.byType(ParentHome), findsOneWidget);
    expect(find.text('Mi cuenta'), findsOneWidget);
    expect(tester.testTextInput.isVisible, isFalse);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'account disclosure preserves the support draft and Android Back only closes account',
    (tester) async {
      final transport = help.Transport();
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: DriverHome(auth: help.authFor(transport)),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await help.createForm(tester);
      await help.fill(tester);
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextField, 'Asunto'), findsNothing);
      expect(find.text('Mi cuenta'), findsOneWidget);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      await help.reveal(tester, find.text('Nueva consulta de soporte'));
      expect(find.text('Nueva consulta de soporte').hitTestable(), findsOneWidget);
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
      expect(transport.calls.where((call) => call.method == 'POST'), isEmpty);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'restart restores the native session but no help draft or selected destination',
    (tester) async {
      final storage = help.MemoryStorage();
      final transport = help.Transport();
      transport.handler = (call) async => call.uri.path.endsWith('/auth/login/')
          ? AuthHttpResponse(200, jsonEncode({'csrf_token': 'rotated'}), [
              'sessionid=synthetic-session; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=Lax',
            ])
          : transport.respond(call);
      final auth = AuthController(
        NativeSessionApi(
          ApiConfig('https://api.example.test'),
          storage,
          transport: transport,
        ),
      );
      await auth.login('conductor@example.test', 'synthetic-password');
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await help.createForm(tester);
      await help.fill(tester);
      await tester.pumpWidget(const SizedBox.shrink());
      final restoredTransport = help.Transport();
      final restored = AuthController(
        NativeSessionApi(
          ApiConfig('https://api.example.test'),
          storage,
          transport: restoredTransport,
        ),
      );
      await tester.pumpWidget(AuthApp(controller: restored));
      await tester.pumpAndSettle();
      expect(restored.state, AuthState.driver);
      expect(
        restoredTransport.calls
            .firstWhere((call) => call.uri.path.endsWith('/auth/me/'))
            .headers['Cookie'],
        contains('sessionid=synthetic-session'),
      );
      expect(
        tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
        0,
      );
      expect(storage.value, isNot(contains('No puedo consultar')));
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await help.createForm(tester);
      expect(
        tester
            .widget<TextField>(find.widgetWithText(TextField, 'Asunto'))
            .controller!
            .text,
        isEmpty,
      );
      await help.reveal(tester, find.byType(CheckboxListTile));
      expect(
        tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        isFalse,
      );
      expect(tester.takeException(), isNull);
    },
  );

  for (final width in [320.0, 390.0]) {
    testWidgets(
      'login, plan, help and account scroll at width $width and double text',
      (tester) async {
        viewport(tester, width, 2);
        final auth = help.authFor(signedOutTransport());
        await tester.pumpWidget(AuthApp(controller: auth));
        await tester.pumpAndSettle();
        await tester.ensureVisible(find.text('Iniciar sesión'));
        expect(find.text('Iniciar sesión').hitTestable(), findsOneWidget);
        await tester.ensureVisible(find.text('Crear cuenta de familia'));
        expect(
          find.text('Crear cuenta de familia').hitTestable(),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        final transport = help.Transport();
        await tester.pumpWidget(
          MaterialApp(
            theme: furgoTheme(),
            home: DriverHome(auth: help.authFor(transport)),
          ),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('driver-nav-plan')));
        await tester.pumpAndSettle();
        await help.tap(tester, 'Detalles del plan');
        await help.reveal(tester, find.textContaining('Última consulta:'));
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const Key('driver-nav-help')));
        await tester.pumpAndSettle();
        await help.tap(tester, 'Asistente automático');
        await help.reveal(
          tester,
          find.widgetWithText(TextField, 'Tu pregunta'),
        );
        expect(tester.takeException(), isNull);
        await tester.tap(find.byKey(const Key('open-driver-account')));
        await tester.pumpAndSettle();
        await help.reveal(tester, find.text('Cerrar sesión'));
        expect(find.text('Cerrar sesión').hitTestable(), findsOneWidget);
        expect(
          tester
              .getSize(find.widgetWithText(OutlinedButton, 'Cerrar sesión'))
              .height,
          greaterThanOrEqualTo(48),
        );
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
