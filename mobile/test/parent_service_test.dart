import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:furgoplus/parent_service.dart';

void main() {
  for (final (days, label) in <(List<String>, String)>[
    (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], 'Lun–Vie'),
    (['friday', 'monday', 'wednesday'], 'Lun · Mié · Vie'),
    (['monday'], 'Lun'),
    (['saturday', 'sunday'], 'Sáb · Dom'),
    (
      [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
      ],
      'Todos los días',
    ),
  ]) {
    test('compact schedule is truthful for $label', () {
      expect(compactWeekdays(days), label);
    });
  }
  test(
    'compact coverage preserves the selected commune and truthful count',
    () {
      final coverage = [
        {'code': 'north', 'display_name': 'Comuna Norte'},
        {'code': 'south', 'display_name': 'Comuna Sur'},
        {'code': 'west', 'display_name': 'Comuna Poniente'},
      ];
      expect(coverageSummary(coverage, null), 'Comuna Norte · +2 comunas');
      expect(coverageSummary(coverage, 'south'), 'Comuna Sur · +2 comunas');
      expect(
        coverageText(coverage),
        'Comuna Norte, Comuna Sur, Comuna Poniente',
      );
      expect(coverageSummary(coverage.take(1).toList(), null), 'Comuna Norte');
    },
  );
  for (final (available, capacity, progress) in [
    (3, 3, 1.0),
    (2, 3, 2 / 3),
    (0, 3, 0.0),
    (0, 0, 0.0),
    (4, 3, 1.0),
    (-1, 3, 0.0),
  ]) {
    testWidgets(
      'availability $available/$capacity has one readable announcement and a visual meter',
      (tester) async {
        final semantics = tester.ensureSemantics();
        try {
          await tester.pumpWidget(
            MaterialApp(
              home: Scaffold(
                body: ParentRouteSummary({
                  'label': 'Ruta Norte',
                  'weekdays': ['monday'],
                  'start_time': '07:00',
                  'end_time': '08:00',
                  'next_service_date': '2026-09-28',
                  'available_seats': available,
                  'seat_capacity': capacity,
                }),
              ),
            ),
          );
          await tester.pumpAndSettle();

          expect(tester.takeException(), isNull);
          expect(find.byType(LinearProgressIndicator), findsOneWidget);
          expect(
            tester
                .widget<LinearProgressIndicator>(
                  find.byType(LinearProgressIndicator),
                )
                .value,
            progress,
          );
          final availability = '$available de $capacity disponibles';
          expect(
            find.text(
              available == 0
                  ? 'Sin cupos disponibles · $availability'
                  : availability,
            ),
            findsOneWidget,
          );

          final announcement = find.bySemanticsLabel(
            'Cupos disponibles, $availability',
          );
          expect(announcement, findsOneWidget);
          expect(tester.getSemantics(announcement).value, isEmpty);

          // Inspect the public semantics tree to catch duplicate text or an
          // accidentally exposed progress role/value, regardless of widget shape.
          final nodes = <SemanticsNode>[];
          void collect(SemanticsNode node) {
            nodes.add(node);
            node.visitChildren((child) {
              collect(child);
              return true;
            });
          }

          var root = tester.getSemantics(announcement);
          while (root.parent != null) {
            root = root.parent!;
          }
          collect(root);
          expect(
            nodes.where((node) => node.label.contains('disponibles')),
            hasLength(1),
          );
          expect(
            nodes.where(
              (node) =>
                  node.getSemanticsData().role == SemanticsRole.progressBar,
            ),
            isEmpty,
          );
          expect(nodes.where((node) => node.value.isNotEmpty), isEmpty);
          expect(
            find.bySemanticsLabel(RegExp('Cupos para el 28-09-2026')),
            findsOneWidget,
          );
        } finally {
          semantics.dispose();
        }
      },
    );
  }
}
