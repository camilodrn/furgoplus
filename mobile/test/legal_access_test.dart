import 'dart:ui' show SemanticsAction, Tristate;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/legal_access.dart';
import 'package:furgoplus/parent_home.dart';

import 'driver_home_test.dart' as driver;
import 'parent_home_test.dart' as parent;

const warning = 'Borrador — requiere revisión legal antes de producción';

Future<void> expectAccessibleLinks(WidgetTester tester) async {
  final ids = <int>{};
  for (final name in ['Privacidad', 'Términos']) {
    final link = find.widgetWithText(TextButton, name);
    expect(link, findsOneWidget);
    await tester.ensureVisible(link);
    await tester.pumpAndSettle();
    final semantics = tester.getSemantics(link);
    expect(semantics.label, name);
    expect(semantics.flagsCollection.isButton, isTrue);
    expect(semantics.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);
    ids.add(semantics.id);
    expect(tester.getSize(link).height, greaterThanOrEqualTo(48));
    expect(tester.getSize(link).width, greaterThanOrEqualTo(48));
  }
  expect(ids, hasLength(2));
}

Future<void> open(WidgetTester tester, String name) async {
  // Asset I/O must complete outside the test's fake clock before settling the
  // loading animation; this also verifies the real bundled document exists.
  await tester.runAsync(
    () => rootBundle.loadString(
      'assets/legal/${name == 'Privacidad' ? 'privacy' : 'terms'}.md',
    ),
  );
  final link = find.widgetWithText(TextButton, name);
  await tester.ensureVisible(link);
  await tester.pumpAndSettle();
  await tester.tap(link);
  await tester.pump();
  await tester.runAsync(
    () => rootBundle.loadString(
      'assets/legal/${name == 'Privacidad' ? 'privacy' : 'terms'}.md',
    ),
  );
  await tester.pumpAndSettle();
  expect(find.text(warning), findsOneWidget);
  expect(
    find.textContaining(
      name == 'Privacidad' ? 'v0.2 — 31-10-2026' : 'v0.1 — 07-10-2026',
    ),
    findsWidgets,
  );
  expect(
    find.textContaining(
      name == 'Privacidad'
          ? 'Aviso de Privacidad v0.2'
          : 'Términos de Uso v0.1',
    ),
    findsWidgets,
  );
  expect(find.byType(Checkbox), findsNothing);
  expect(find.byType(CheckboxListTile), findsNothing);
  expect(find.byType(TextField), findsNothing);
}

Future<void> androidBack(WidgetTester tester) async {
  await tester.binding.handlePopRoute();
  await tester.pumpAndSettle();
}

void main() {
  testWidgets(
    'auth login and registration expose both drafts without acceptance',
    (tester) async {
      final transport = parent.fixture(
        override: (uri, method, body) => uri.path.endsWith('/me/')
            ? parent.ok({
                'code': 'not_authenticated',
                'message': '',
                'fields': <String, dynamic>{},
              }, 403)
            : null,
      );
      final auth = parent.parent(transport);
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pumpAndSettle();
      for (final register in [false, true]) {
        if (register) {
          final button = find.text('Crear cuenta de familia');
          await tester.ensureVisible(button);
          await tester.tap(button);
          await tester.pumpAndSettle();
        }
        await expectAccessibleLinks(tester);
        for (final name in ['Privacidad', 'Términos']) {
          final calls = transport.calls.length;
          await open(tester, name);
          expect(transport.calls.length, calls);
          await tester.tap(find.byTooltip('Cerrar documento'));
          await tester.pumpAndSettle();
          expect(find.text(warning), findsNothing);
          expect(find.byType(Checkbox), findsNothing);
        }
      }
    },
  );

  for (final role in ['parent', 'driver']) {
    testWidgets('$role legal access closes on replacement and expiry', (
      tester,
    ) async {
      var account = 'A';
      final transport = parent.fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/me/') || uri.path.endsWith('/login/')) {
            return parent.ok({
              'id': account == 'A' ? 1 : 2,
              'role': role,
              'display_name': 'Cuenta $account',
              'email': '$account@example.test',
              if (uri.path.endsWith('/login/')) 'csrf_token': 'rotated',
            });
          }
          if (uri.path.endsWith('/today/'))
            return parent.ok(driver.today('planned'));
          if (uri.path.endsWith('/profile/')) {
            return parent.ok({
              'display_name': 'Cuenta $account',
              'email': '$account@example.test',
            });
          }
          return null;
        },
      );
      final auth = parent.parent(transport);
      await tester.pumpWidget(AuthApp(controller: auth));
      await tester.pumpAndSettle();
      if (role == 'driver') {
        await tester.tap(find.byKey(const Key('open-driver-account')));
        await tester.pumpAndSettle();
      }
      if (role == 'parent') {
        await tester.tap(find.byKey(const Key('open-parent-account')));
        await tester.pumpAndSettle();
      }
      await expectAccessibleLinks(tester);
      final calls = transport.calls.length;
      await open(tester, 'Privacidad');
      expect(transport.calls.length, calls);
      expect(find.text('A@example.test'), findsNothing);
      expect(find.text('Estudiante ficticio'), findsNothing);
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Mi cuenta'), findsOneWidget);
      expect(find.text('A@example.test'), findsOneWidget);
      await open(tester, 'Privacidad');
      account = 'B';
      await auth.login('B@example.test', 'Synthetic-password-781!');
      await tester.pumpAndSettle();
      expect(find.text(warning), findsNothing);
      expect(find.text('A@example.test'), findsNothing);
      if (role == 'driver') {
        await tester.tap(find.byKey(const Key('open-driver-account')));
        await tester.pumpAndSettle();
      }
      if (role == 'parent') {
        await tester.tap(find.byKey(const Key('open-parent-account')));
        await tester.pumpAndSettle();
        expect(find.text('B@example.test'), findsOneWidget);
      }
      await open(tester, 'Términos');
      auth.expire();
      await tester.pumpAndSettle();
      expect(find.text(warning), findsNothing);
      expect(find.byType(ParentHome), findsNothing);
      expect(find.text('B@example.test'), findsNothing);
      await open(tester, 'Privacidad');
      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text(warning), findsNothing);
      expect(find.text('Inicia sesión'), findsOneWidget);
    });
  }

  for (final width in [320.0, 390.0]) {
    testWidgets('legal links and both documents fit ${width}px with 2x text', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: const LegalScope(
              child: Scaffold(
                body: Padding(
                  padding: EdgeInsets.symmetric(horizontal: 24),
                  child: LegalLinks(),
                ),
              ),
            ),
          ),
        ),
      );
      await expectAccessibleLinks(tester);
      for (final name in ['Privacidad', 'Términos']) {
        final rect = tester.getRect(find.widgetWithText(TextButton, name));
        expect(rect.left, greaterThanOrEqualTo(24));
        expect(rect.right, lessThanOrEqualTo(width - 24));
      }
      final privacy = tester.getRect(
        find.widgetWithText(TextButton, 'Privacidad'),
      );
      final terms = tester.getRect(find.widgetWithText(TextButton, 'Términos'));
      expect(privacy.overlaps(terms), isFalse);
      for (final name in ['Privacidad', 'Términos']) {
        await open(tester, name);
        final scrollable = tester.state<ScrollableState>(
          find.byType(Scrollable).first,
        );
        expect(scrollable.position.axis, Axis.vertical);
        scrollable.position.jumpTo(scrollable.position.maxScrollExtent);
        await tester.pumpAndSettle();
        final lastParagraph = tester.getRect(
          find.textContaining(
            name == 'Privacidad'
                ? 'Abrir en mapas utiliza Google Maps'
                : 'Este borrador se identifica por versión',
          ),
        );
        // A scaled paragraph can be taller than the viewport; its end must
        // still be reachable, with the full text constrained horizontally.
        expect(lastParagraph.bottom, lessThanOrEqualTo(844));
        expect(lastParagraph.bottom, greaterThan(kToolbarHeight));
        expect(lastParagraph.left, greaterThanOrEqualTo(20));
        expect(lastParagraph.right, lessThanOrEqualTo(width - 20));
        expect(
          find.byTooltip('Cerrar documento').hitTestable(),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        await tester.tap(find.byTooltip('Cerrar documento'));
        await tester.pumpAndSettle();
      }
    });
  }

  testWidgets(
    'compact legal row supports keyboard activation and focus return',
    (tester) async {
      await tester.runAsync(
        () => rootBundle.loadString('assets/legal/privacy.md'),
      );
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: const LegalScope(child: Scaffold(body: LegalLinks())),
        ),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      final privacy = find.widgetWithText(TextButton, 'Privacidad');
      expect(
        tester.getSemantics(privacy).flagsCollection.isFocused,
        Tristate.isTrue,
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      await tester.runAsync(
        () => rootBundle.loadString('assets/legal/privacy.md'),
      );
      await tester.pumpAndSettle();
      expect(find.text(warning), findsOneWidget);
      await tester.tap(find.byTooltip('Cerrar documento'));
      await tester.pumpAndSettle();
      expect(
        tester.getSemantics(privacy).flagsCollection.isFocused,
        Tristate.isTrue,
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(
        tester
            .getSemantics(find.widgetWithText(TextButton, 'Términos'))
            .flagsCollection
            .isFocused,
        Tristate.isTrue,
      );
    },
  );
}
