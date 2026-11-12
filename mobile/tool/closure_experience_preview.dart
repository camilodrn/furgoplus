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
import 'package:furgoplus/furgo_theme.dart';
import '../test/driver_home_test.dart' as daily;
import '../test/plan_help_test.dart' as help;

const fontDirectory = String.fromEnvironment('PREVIEW_FONT_DIR');
const output = String.fromEnvironment(
  'PREVIEW_OUTPUT',
  defaultValue: '/tmp/t12-closure-native',
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

    for (final (width, scale) in [(390.0, 1.0), (320.0, 2.0)]) {
      tester.view.physicalSize = Size(width, 844);
      tester.platformDispatcher.textScaleFactorTestValue = scale;
      final suffix = '${width.toInt()}-text-${(scale * 100).toInt()}';
      final driver = help.Transport();
      driver.handler = (call) async => call.uri.path.endsWith('/driver/today/')
          ? help.json(daily.today('planned'))
          : driver.respond(call);
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: LegalScope(child: DriverHome(auth: help.authFor(driver))),
        ),
      );
      await capture('hoy-$suffix');
      await daily.showDetails(tester);
      await capture('recorrido-$suffix');
      await daily.showPassengers(tester);
      await capture('pasajeros-$suffix');
      await tester.ensureVisible(find.byKey(const ValueKey('passenger-9-0')));
      await tester.tap(find.byKey(const ValueKey('passenger-9-0')));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Contacto del apoderado'));
      await capture('pasajero-detalle-$suffix');
      expect(driver.calls.where((call) => call.method != 'GET'), isEmpty);
      final parent = family.fixture();
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: LegalScope(child: ParentHome(auth: family.parent(parent))),
        ),
      );
      await family.tapVisible(tester, const ValueKey('compare-driver-1'));
      await family.tapVisible(tester, const ValueKey('compare-driver-2'));
      await family.tapVisible(tester, const Key('compare-selected'));
      await capture('comparar-2-$suffix');
      await family.tapControl(tester, find.byKey(const Key('comparison-back')));
      await family.tapVisible(tester, const ValueKey('compare-driver-3'));
      await family.tapVisible(tester, const Key('compare-selected'));
      await capture('comparar-3-$suffix');
    }
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
