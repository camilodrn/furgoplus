import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/furgo_theme.dart';
import 'package:furgoplus/furgo_widgets.dart';
import 'package:furgoplus/parent_presentation.dart';
import 'package:furgoplus/parent_service.dart';
import 'parent_home_test.dart' as family;

void main() {
  testWidgets('shared surfaces keep native target sizes, labels and contrast', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    try {
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: Scaffold(
            body: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FurgoOperationalPanel(
                  child: FilledButton(
                    onPressed: () {},
                    child: const Text('Iniciar servicio'),
                  ),
                ),
                const SizedBox(height: 12),
                ParentPanel(
                  child: OutlinedButton(
                    onPressed: () {},
                    child: const Text('Ver servicio'),
                  ),
                ),
                const ParentDisclosure(
                  title: 'Cobertura y horario',
                  icon: Icons.route_outlined,
                  children: [Text('Lunes · 07:00–08:00')],
                ),
                const FurgoMessage(
                  'No pudimos confirmar el resultado.',
                  error: true,
                ),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
      await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
      await expectLater(tester, meetsGuideline(textContrastGuideline));
      expect(tester.takeException(), isNull);
    } finally {
      semantics.dispose();
    }
  });

  for (final count in [2, 3]) {
    for (final (width, height, scale) in [
      (390.0, 844.0, 1.0),
      (320.0, 844.0, 2.0),
      (844.0, 390.0, 2.0),
    ]) {
      testWidgets(
        'comparison $count services groups truthful attributes at $width/$scale',
        (tester) async {
          tester.view.physicalSize = Size(width, height);
          tester.view.devicePixelRatio = 1;
          tester.platformDispatcher.textScaleFactorTestValue = scale;
          addTearDown(() {
            tester.view.resetPhysicalSize();
            tester.view.resetDevicePixelRatio();
            tester.platformDispatcher.clearTextScaleFactorTestValue();
          });
          final drivers = List.generate(count, (index) {
            final driver = family.driver(index + 1);
            driver['display_name'] =
                'Servicio ${index + 1} con nombre largo de transporte escolar';
            driver['private_email'] = 'PRIVATE@example.test';
            final route = Map<String, dynamic>.from(
              (driver['routes'] as List).first as Map,
            );
            route['label'] = 'Ruta pertinente ${index + 1}';
            route['start_time'] = '0${index + 7}:00';
            route['next_service_date'] = '2026-11-0${index + 1}';
            route['available_seats'] = 3 - index;
            route['used_seats'] = index;
            driver['routes'] = [
              {
                ...route,
                'label': 'Ruta de otra comuna',
                'coverage': [
                  {'code': 'other', 'display_name': 'Otra comuna'},
                ],
              },
              route,
            ];
            return driver;
          });
          int? opened, removed;
          await tester.pumpWidget(
            MaterialApp(
              theme: furgoTheme(),
              home: Scaffold(
                body: SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: ParentServiceComparison(
                    drivers: drivers,
                    commune: 'demo-norte',
                    onOpen: (id) => opened = id,
                    onRemove: (id) => removed = id,
                  ),
                ),
              ),
            ),
          );
          await tester.pumpAndSettle();
          expect(find.byType(ParentServiceCard), findsNothing);
          expect(find.text('Ruta de otra comuna'), findsNothing);
          expect(find.textContaining('PRIVATE'), findsNothing);
          for (final (attribute, expected) in [
            ('route', 'Ruta pertinente 1'),
            ('schedule', 'Lun · 07:00–08:00'),
            ('coverage', 'Comuna Demo Norte'),
            ('capacity', 'Para el 01-11-2026'),
            ('reviews', 'Sin reseñas'),
          ]) {
            final group = find.byKey(ValueKey('comparison-$attribute'));
            await tester.ensureVisible(group);
            await tester.pumpAndSettle();
            expect(
              find.descendant(of: group, matching: find.text(expected)),
              findsWidgets,
            );
            for (final driver in drivers) {
              expect(
                find.descendant(
                  of: group,
                  matching: find.text(driver['display_name'] as String),
                ),
                findsOneWidget,
              );
            }
            expect(tester.takeException(), isNull);
          }
          expect(find.text('Para el 02-11-2026'), findsOneWidget);
          expect(
            find.text('0 de 3 cupos ocupados · 3 disponibles'),
            findsOneWidget,
          );
          expect(
            find.text('1 de 3 cupos ocupados · 2 disponibles'),
            findsOneWidget,
          );
          if (count == 3)
            expect(find.text('Para el 03-11-2026'), findsOneWidget);
          final identity = find.byKey(const ValueKey('driver-card-1'));
          final open = find.descendant(
            of: identity,
            matching: find.widgetWithText(OutlinedButton, 'Ver servicio'),
          );
          await tester.ensureVisible(open);
          await tester.pumpAndSettle();
          await tester.tap(open);
          expect(opened, 1);
          final remove = find.descendant(
            of: identity,
            matching: find.widgetWithText(TextButton, 'Quitar'),
          );
          await tester.ensureVisible(remove);
          await tester.pumpAndSettle();
          await tester.tap(remove);
          expect(removed, 1);
          expect(tester.takeException(), isNull);
        },
      );
    }
  }

  testWidgets(
    'missing public route stays unconfirmed without a capacity meter',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: furgoTheme(),
          home: Scaffold(
            body: SingleChildScrollView(
              child: ParentServiceComparison(
                drivers: [
                  family.driver(1)..['routes'] = [],
                  family.driver(2)..['routes'] = [],
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(FurgoCapacity), findsNothing);
      expect(find.text('Información por confirmar'), findsNWidgets(8));
      expect(find.text('Sin reseñas'), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    },
  );
}
