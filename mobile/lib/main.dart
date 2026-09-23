import 'package:flutter/material.dart';

import 'api_config.dart';
import 'auth_app.dart';
import 'auth_controller.dart';
import 'health_controller.dart';
import 'session_api.dart';

void main() {
  try {
    runApp(
      AuthApp(
        controller: AuthController(
          NativeSessionApi(ApiConfig.fromEnvironment, SecureAuthStorage()),
        ),
      ),
    );
  } on FormatException catch (error) {
    runApp(
      MaterialApp(
        home: Scaffold(body: Center(child: Text(error.message))),
      ),
    );
  }
}

class FurgoPlusApp extends StatefulWidget {
  const FurgoPlusApp({super.key, required this.controller});

  final HealthController controller;

  @override
  State<FurgoPlusApp> createState() => _FurgoPlusAppState();
}

class _FurgoPlusAppState extends State<FurgoPlusApp> {
  @override
  void initState() {
    super.initState();
    widget.controller.refresh();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FurgoPlus',
      home: Scaffold(
        appBar: AppBar(title: const Text('FurgoPlus')),
        body: Center(
          child: ListenableBuilder(
            listenable: widget.controller,
            builder: (context, child) => switch (widget.controller.state) {
              HealthState.loading => const CircularProgressIndicator(),
              HealthState.ok => const Text('La API responde correctamente.'),
              HealthState.error => Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('No se pudo conectar con la API.'),
                  TextButton(
                    onPressed: widget.controller.refresh,
                    child: const Text('Reintentar'),
                  ),
                ],
              ),
            },
          ),
        ),
      ),
    );
  }
}
