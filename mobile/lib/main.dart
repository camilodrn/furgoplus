import 'package:flutter/material.dart';

import 'api_config.dart';
import 'auth_app.dart';
import 'auth_controller.dart';
import 'health_controller.dart';
import 'session_api.dart';
import 'furgo_theme.dart';
import 'furgo_widgets.dart';

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
        theme: furgoTheme(),
        home: Scaffold(
          appBar: AppBar(title: const Text('FurgoPlus')),
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  'No pudimos abrir FurgoPlus',
                  style: furgoTheme().textTheme.headlineSmall,
                ),
                const SizedBox(height: 16),
                const FurgoMessage(
                  'La configuración de conexión no es válida. Solicita ayuda al equipo para revisar la instalación.',
                  error: true,
                ),
                ExpansionTile(
                  title: const Text('Detalle del problema'),
                  children: [SelectableText(error.message.toString())],
                ),
              ],
            ),
          ),
        ),
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
