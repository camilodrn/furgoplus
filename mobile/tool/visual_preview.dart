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
import 'package:furgoplus/auth_app.dart';
import 'package:furgoplus/driver_home.dart';
import 'package:furgoplus/furgo_theme.dart';
import '../test/driver_home_test.dart' as daily;
import '../test/plan_help_test.dart' as help;
import '../test/visual_experience_test.dart' as ux;

const fontDirectory = String.fromEnvironment('PREVIEW_FONT_DIR');
const output = String.fromEnvironment(
  'PREVIEW_OUTPUT',
  defaultValue: 'build/ux-previews',
);

void previews() {
  testWidgets('synthetic mobile previews with real fonts', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
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

    for (final scale in [1.0, 2.0]) {
      tester.platformDispatcher.textScaleFactorTestValue = scale;
      final suffix = scale == 1 ? '' : '-text-200';
      await mount(AuthApp(controller: help.authFor(ux.signedOutTransport())));
      await capture('01-login$suffix');
      final transport = help.Transport();
      final auth = help.authFor(transport)
        ..displayName = 'Conductor de prueba'
        ..email = 'conductor@example.test';
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: DriverHome(auth: auth),
        ),
      );
      await capture('02-today-empty$suffix');
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      await capture('03-plan-elite$suffix');
      await tester.tap(find.byKey(const Key('driver-nav-help')));
      await tester.pumpAndSettle();
      await capture('04-help$suffix');
      await tester.tap(find.byKey(const Key('open-driver-account')));
      await tester.pumpAndSettle();
      await capture('05-account$suffix');
    }
    tester.platformDispatcher.textScaleFactorTestValue = 1;
    for (final state in ['planned', 'in_progress', 'completed']) {
      final transport = help.Transport();
      transport.handler = (call) async =>
          call.uri.path.endsWith('/driver/today/')
          ? help.json(daily.today(state))
          : transport.respond(call);
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: DriverHome(auth: help.authFor(transport)),
        ),
      );
      await capture('today-$state');
    }
    for (final plan in ['basic', 'pro', 'none']) {
      final transport = help.Transport()
        ..caps = help.capabilityData(plan: plan == 'none' ? 'basic' : plan);
      if (plan == 'none') {
        transport.caps['plan'] = null;
        transport.caps['subscription'] = null;
        transport.caps['blockers'] = ['subscription_missing'];
      }
      await mount(
        MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: furgoTheme(),
          home: DriverHome(auth: help.authFor(transport)),
        ),
      );
      await tester.tap(find.byKey(const Key('driver-nav-plan')));
      await tester.pumpAndSettle();
      await capture('plan-$plan');
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
