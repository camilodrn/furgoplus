import 'package:flutter/foundation.dart';

import 'health_api.dart';

enum HealthState { loading, ok, error }

class HealthController extends ChangeNotifier {
  HealthController(this.api);

  final HealthApi api;
  HealthState state = HealthState.loading;

  Future<void> refresh() async {
    state = HealthState.loading;
    notifyListeners();
    try {
      await api.check();
      state = HealthState.ok;
    } catch (_) {
      state = HealthState.error;
    }
    notifyListeners();
  }
}
