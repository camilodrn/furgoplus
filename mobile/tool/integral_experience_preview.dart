// Synthetic widget previews for visual review; never device acceptance.
// Build like test_without_sockets.dart, then run with flutter_tester.
// Pass --dart-define=PREVIEW_FONT_DIR=<Flutter SDK>/bin/cache/artifacts/material_fonts
// and optionally --dart-define=PREVIEW_OUTPUT=<writable directory>.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:test_api/src/backend/declarer.dart';
import 'package:test_api/src/backend/invoker.dart';
import 'package:test_api/src/backend/group.dart';
import 'package:test_api/src/backend/operating_system.dart';
import 'package:test_api/src/backend/runtime.dart';
import 'package:test_api/src/backend/state.dart';
import 'package:test_api/src/backend/suite.dart';
import 'package:test_api/src/backend/suite_platform.dart';
import 'package:test_api/src/backend/test.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/parent_home.dart';
import 'package:furgoplus/legal_access.dart';
import '../test/parent_home_test.dart' as family;
import '../test/legal_access_test.dart' as legal;
import 'package:furgoplus/furgo_theme.dart';
import '../test/driver_home_test.dart' as daily;
import '../test/plan_help_test.dart' as help;

const fontDirectory = String.fromEnvironment('PREVIEW_FONT_DIR');
const output = String.fromEnvironment(
  'PREVIEW_OUTPUT',
  defaultValue: 'build/integral-previews',
);

void previews() {
  testWidgets('integral native widgets with synthetic read-only transport', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      tester.platformDispatcher.clearTextScaleFactorTestValue();
    });
    await tester.runAsync(() async {
      if (fontDirectory.isEmpty)
        throw StateError('PREVIEW_FONT_DIR is required');
      for (final family in ['Roboto', 'MaterialIcons']) {
        final loader = FontLoader(family);
        for (final file
            in family == 'Roboto'
                ? ['Roboto-Regular.ttf', 'Roboto-Medium.ttf', 'Roboto-Bold.ttf']
                : ['MaterialIcons-Regular.otf']) {
          loader.addFont(
            File(
              '$fontDirectory/$file',
            ).readAsBytes().then((bytes) => ByteData.sublistView(bytes)),
          );
        }
        await loader.load();
      }
      await Directory(output).create(recursive: true);
    });
    final boundary = GlobalKey();
    Future<void> mount(Widget child) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(RepaintBoundary(key: boundary, child: child));
      await tester.pumpAndSettle();
      await tester.runAsync(
        () => precacheImage(
          const AssetImage('assets/furgoplus-logo.png'),
          boundary.currentContext!,
        ),
      );
      await tester.pumpAndSettle();
    }

    Future<void> capture(String name) async {
      await tester.pump();
      final render =
          boundary.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await render.toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File(
          '$output/$name.png',
        ).writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
      expect(tester.takeException(), isNull);
    }

    for (final (width, height, scale) in [
      (390.0, 844.0, 1.0),
      (320.0, 844.0, 2.0),
    ]) {
      tester.view.physicalSize = Size(width, height);
      tester.platformDispatcher.textScaleFactorTestValue = scale;
      final suffix =
          '${width.toInt()}x${height.toInt()}-text-${(scale * 100).toInt()}';
      final driver = help.Transport();
      driver.rows = [help.ticketData()];
      driver.handler = (call) async => call.uri.path.endsWith('/driver/today/')
          ? help.json(daily.today('planned'))
          : driver.respond(call);
      final driverAuth = help.authFor(driver)
        ..displayName = 'Conductor de ensayo'
        ..email = 't12-elite@example.test';
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: LegalScope(child: DriverHome(auth: driverAuth)),
        ),
      );
      await capture('conductor-hoy-$suffix');
      await daily.showDetails(tester);
      await capture('conductor-recorrido-$suffix');
      await daily.showPassengers(tester);
      await capture('conductor-pasajeros-$suffix');
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      await capture('conductor-plan-$suffix');
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await capture('conductor-ayuda-$suffix');
      await help.tap(tester, 'Guías por tema');
      await capture('conductor-guias-$suffix');
      await help.tap(tester, 'Configurar rutas');
      await capture('conductor-articulo-$suffix');
      await legal.androidBack(tester);
      await tester.pumpAndSettle();
      await legal.androidBack(tester);
      await tester.pumpAndSettle();
      await help.tap(tester, 'Consultas de soporte');
      await capture('conductor-soporte-$suffix');
      await help.tap(tester, 'Problema sintético');
      await capture('conductor-hilo-$suffix');
      await legal.androidBack(tester);
      await tester.pumpAndSettle();
      await help.tap(tester, 'Crear consulta');
      await capture('conductor-formulario-$suffix');
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      await capture('conductor-cuenta-$suffix');
      await legal.open(tester, 'Privacidad');
      await capture('conductor-privacidad-$suffix');
      await legal.androidBack(tester);
      await tester.pumpAndSettle();
      await legal.open(tester, 'Términos');
      await capture('conductor-terminos-$suffix');
      expect(driver.calls.where((call) => call.method != 'GET'), isEmpty);

      final parent = family.fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/help/'))
            return help.json(help.helpData(parent: true));
          if (uri.path.contains('/support/tickets/'))
            return help.json({'results': [], 'count': 0});
          return null;
        },
      );
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: LegalScope(child: ParentHome(auth: family.parent(parent))),
        ),
      );
      await capture('apoderado-buscar-$suffix');
      await family.tapControl(tester, find.byKey(const Key('open-filters')));
      await capture('apoderado-comuna-$suffix');
      await legal.androidBack(tester);
      await tester.pumpAndSettle();
      await family.tapVisible(tester, const ValueKey('compare-driver-1'));
      await family.tapVisible(tester, const ValueKey('compare-driver-2'));
      await family.tapVisible(tester, const Key('compare-selected'));
      await capture('apoderado-comparar-2-$suffix');
      for (final attribute in ['schedule', 'capacity', 'reviews']) {
        await tester.ensureVisible(
          find.byKey(ValueKey('comparison-$attribute')),
        );
        await tester.pumpAndSettle();
        await capture('apoderado-comparar-2-$attribute-$suffix');
      }
      await family.tapVisible(
        tester,
        const Key('comparison-back'),
        delta: -200,
      );
      await family.tapVisible(tester, const ValueKey('compare-driver-3'));
      await family.tapVisible(tester, const Key('compare-selected'));
      await capture('apoderado-comparar-3-$suffix');
      for (final attribute in ['schedule', 'capacity', 'reviews']) {
        await tester.ensureVisible(
          find.byKey(ValueKey('comparison-$attribute')),
        );
        await tester.pumpAndSettle();
        await capture('apoderado-comparar-3-$attribute-$suffix');
      }
      await tester.tap(find.widgetWithText(NavigationDestination, 'Buscar'));
      await tester.pumpAndSettle();
      await family.openService(tester);
      await capture('apoderado-servicio-$suffix');
      await family.tapControl(tester, find.byKey(const Key('start-contact')));
      await capture('apoderado-contacto-$suffix');
      await family.reveal(tester, const Key('send-contact-request'));
      await capture('apoderado-contacto-accion-$suffix');
      await tester.tap(
        find.widgetWithText(NavigationDestination, 'Solicitudes'),
      );
      await tester.pumpAndSettle();
      await capture('apoderado-solicitudes-$suffix');
      await family.tapControl(tester, find.text('Ver solicitud'));
      await capture('apoderado-solicitud-$suffix');
      await tester.tap(find.byKey(const Key('open-parent-account')));
      await tester.pumpAndSettle();
      await capture('apoderado-cuenta-$suffix');
      await family.tapControl(tester, find.text('Editar nombre'));
      await capture('apoderado-nombre-$suffix');
      await tester.tap(find.byKey(const Key('parent-nav-help')));
      await tester.pumpAndSettle();
      await capture('apoderado-ayuda-$suffix');
      await help.tap(tester, 'Consultas de soporte');
      await capture('apoderado-soporte-vacio-$suffix');
      expect(parent.calls.where((call) => !call.startsWith('GET')), isEmpty);
    }
    tester.view.physicalSize = const Size(390, 844);
    tester.platformDispatcher.textScaleFactorTestValue = 1;
    final empty = family.fixture(services: [], requests: []);
    await mount(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: furgoTheme(),
        home: LegalScope(child: ParentHome(auth: family.parent(empty))),
      ),
    );
    await capture('apoderado-buscar-vacio-390');
    await tester.tap(find.widgetWithText(NavigationDestination, 'Solicitudes'));
    await tester.pumpAndSettle();
    await capture('apoderado-solicitudes-vacias-390');
    for (final status in ['accepted', 'declined', 'cancelled']) {
      final transport = family.fixture(
        override: (uri, method, body) {
          if (uri.path.endsWith('/contact-requests/'))
            return family.ok({
              'results': [family.request(7, status: status)],
            });
          if (uri.path.endsWith('/contact-requests/7/'))
            return family.ok(family.request(7, status: status));
          return null;
        },
      );
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: LegalScope(child: ParentHome(auth: family.parent(transport))),
        ),
      );
      await tester.tap(
        find.widgetWithText(NavigationDestination, 'Solicitudes'),
      );
      await tester.pumpAndSettle();
      await family.tapControl(tester, find.text('Ver solicitud'));
      await capture('apoderado-solicitud-$status-390');
    }
    final offline = help.Transport()..offline = true;
    await mount(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: furgoTheme(),
        home: LegalScope(
          child: ParentHome(auth: help.authFor(offline..parent = true)),
        ),
      ),
    );
    await capture('apoderado-error-390');
    await tester.pumpWidget(const SizedBox.shrink());
  });
}

void main() {
  Invoker.guard(() async {
    final declarer = Declarer();
    declarer.group('visual_preview', previews);
    final suite = Suite(
      declarer.build(),
      SuitePlatform(Runtime.vm, os: OperatingSystem.linux),
    );
    var failed = false;
    for (final entry in suite.group.entries) {
      final group = entry as Group;
      for (final entry in group.entries) {
        final live = (entry as Test).load(suite, groups: [suite.group, group]);
        live.onError.listen(
          (error) => print('${error.error}\n${error.stackTrace}'),
        );
        await live.run();
        failed |= live.state.result != Result.success;
        await live.close();
      }
    }
    print('PREVIEW RESULT: ${failed ? 'failed' : 'passed'}');
    exit(failed ? 1 : 0);
  });
}
