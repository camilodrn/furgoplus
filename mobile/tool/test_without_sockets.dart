// Fallback for restricted environments where flutter test cannot bind localhost.
// Uses the same test_api invokers and Flutter engine without a network channel.
// Internal test_api interfaces are tied to pubspec.lock; prefer flutter test.
// Compile with flutter build bundle --debug --target=tool/test_without_sockets.dart
// and execute the kernel with flutter_tester (see validation document).
import 'dart:io';
import 'package:test_api/src/backend/invoker.dart';
import 'package:test_api/src/backend/declarer.dart';
import 'package:test_api/src/backend/suite.dart';
import 'package:test_api/src/backend/suite_platform.dart';
import 'package:test_api/src/backend/runtime.dart';
import 'package:test_api/src/backend/operating_system.dart';
import 'package:test_api/src/backend/group.dart';
import 'package:test_api/src/backend/test.dart';
import 'package:test_api/src/backend/state.dart';
import '../test/driver_home_test.dart' as suite0;
import '../test/health_test.dart' as suite1;
import '../test/legal_access_test.dart' as suite2;
import '../test/parent_home_test.dart' as suite3;
import '../test/parent_service_test.dart' as suite4;
import '../test/plan_help_test.dart' as suite5;
import '../test/session_test.dart' as suite6;
import '../test/visual_experience_test.dart' as suite7;
import '../test/loading_recovery_test.dart' as suite8;
import '../test/integral_experience_test.dart' as suite9;
import '../test/unified_visual_system_test.dart' as suite10;

void main() {
  Invoker.guard(() async {
    final declarer = Declarer();
    declarer.group('driver_home_test', suite0.main);
    declarer.group('health_test', suite1.main);
    declarer.group('legal_access_test', suite2.main);
    declarer.group('parent_home_test', suite3.main);
    declarer.group('parent_service_test', suite4.main);
    declarer.group('plan_help_test', suite5.main);
    declarer.group('session_test', suite6.main);
    declarer.group('visual_experience_test', suite7.main);
    declarer.group('loading_recovery_test', suite8.main);
    declarer.group('integral_experience_test', suite9.main);
    declarer.group('unified_visual_system_test', suite10.main);
    final suite = Suite(
      declarer.build(),
      SuitePlatform(Runtime.vm, os: OperatingSystem.linux),
    );
    int passed = 0, failed = 0;
    Future<void> runTest(Test test, List<Group> groups) async {
      final live = test.load(suite, groups: groups);
      live.onError.listen((error) {
        print('ERROR: ${error.error}\n${error.stackTrace}');
      });
      live.onMessage.listen((message) {
        print(message.text);
      });
      await live.run();
      if (live.state.result == Result.success) {
        passed++;
        print('PASS: ${test.name}');
      } else {
        failed++;
        print('FAIL: ${test.name}');
      }
      await live.close();
    }

    Future<void> runGroup(Group group, List<Group> parents) async {
      final groups = [...parents, group];
      if (group.setUpAll != null) await runTest(group.setUpAll!, groups);
      for (final entry in group.entries) {
        if (entry is Group) {
          await runGroup(entry, groups);
        } else {
          await runTest(entry as Test, groups);
        }
      }
      if (group.tearDownAll != null) await runTest(group.tearDownAll!, groups);
    }

    await runGroup(suite.group, []);
    print('SOCKETLESS RESULT: $passed passed, $failed failed');
    exit(failed == 0 ? 0 : 1);
  });
}
