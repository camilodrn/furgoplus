import 'package:flutter/material.dart';
import 'furgo_theme.dart';

/// Compatibility name for operational groups; FurgoSurface owns their recipe.
class FurgoOperationalPanel extends StatelessWidget {
  const FurgoOperationalPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(FurgoLayout.panelPadding),
  });
  final EdgeInsetsGeometry padding;
  final Widget child;

  @override
  Widget build(BuildContext context) =>
      FurgoSurface(padding: padding, child: child);
}

/// One related group, with a single surface recipe across roles.
class FurgoSurface extends StatelessWidget {
  const FurgoSurface({
    super.key,
    required this.child,
    this.emphasis = false,
    this.padding = const EdgeInsets.all(FurgoLayout.panelPadding),
  });
  final Widget child;
  final bool emphasis;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) => Material(
    color: emphasis
        ? FurgoColors.blueSoft
        : Theme.of(context).colorScheme.surface,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(FurgoLayout.panelRadius),
      side: const BorderSide(color: FurgoColors.divider),
    ),
    clipBehavior: Clip.antiAlias,
    child: Padding(padding: padding, child: child),
  );
}

class FurgoMessage extends StatelessWidget {
  const FurgoMessage(
    this.text, {
    super.key,
    this.error = false,
    this.success = false,
  });
  final String text;
  final bool error, success;

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    child: Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: error
            ? FurgoColors.errorSoft
            : success
            ? FurgoColors.successSoft
            : FurgoColors.blueSoft,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Icon(
              error
                  ? Icons.error_outline
                  : success
                  ? Icons.check_circle_outline
                  : Icons.info_outline,
              color: error
                  ? FurgoColors.error
                  : success
                  ? FurgoColors.success
                  : FurgoColors.blue,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: error
                    ? FurgoColors.error
                    : success
                    ? FurgoColors.success
                    : FurgoColors.blue,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}

/// Label and icon are read together. No colour-only status information.
class FurgoStatus extends StatelessWidget {
  const FurgoStatus(this.label, {super.key, this.active = false});
  final String label;
  final bool active;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      ExcludeSemantics(
        child: Icon(
          active ? Icons.check_circle_outline : Icons.info_outline,
          size: 20,
          color: active ? FurgoColors.success : FurgoColors.muted,
        ),
      ),
      const SizedBox(width: 8),
      Expanded(
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: active ? FurgoColors.success : FurgoColors.muted,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    ],
  );
}

/// Route/date occupancy, never an assignment of physical seats.
class FurgoCapacity extends StatelessWidget {
  const FurgoCapacity({
    super.key,
    required this.used,
    required this.total,
    required this.available,
  });
  final int used, total, available;
  @override
  Widget build(BuildContext context) => Semantics(
    container: true,
    label:
        'Capacidad: $used ${used == 1 ? 'ocupado' : 'ocupados'} · $available ${available == 1 ? 'disponible' : 'disponibles'} · $total total',
    child: ExcludeSemantics(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '$used de $total cupos ocupados · $available ${available == 1 ? 'disponible' : 'disponibles'}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
            value: total > 0 ? (used / total).clamp(0, 1) : 0,
            minHeight: 6,
            color: available == 0 ? FurgoColors.warning : FurgoColors.blue,
            borderRadius: BorderRadius.circular(4),
            backgroundColor: FurgoColors.blueSoft,
          ),
        ],
      ),
    ),
  );
}

/// Native task row shared by the journey entry and its details.
class FurgoTaskRow extends StatelessWidget {
  const FurgoTaskRow({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: ExcludeSemantics(child: Icon(icon)),
    title: Text(title, style: Theme.of(context).textTheme.titleSmall),
    subtitle: Text(subtitle),
    trailing: const Icon(Icons.chevron_right),
    onTap: onTap,
  );
}

class FurgoFact extends StatelessWidget {
  const FurgoFact(this.label, this.value, {super.key});
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: LayoutBuilder(
      builder: (context, constraints) {
        final title = Text(label, style: Theme.of(context).textTheme.bodySmall);
        final content = Text(
          value,
          style: Theme.of(context).textTheme.bodyMedium,
        );
        if (constraints.maxWidth / MediaQuery.textScalerOf(context).scale(1) <
            300) {
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [title, const SizedBox(height: 4), content],
          );
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: title),
            const SizedBox(width: 16),
            Expanded(flex: 2, child: content),
          ],
        );
      },
    ),
  );
}

/// Reserved test identities and explicitly marked demo builds never imply travel.
const syntheticDataNotice =
    'Datos de ensayo: personas, recorridos y ubicaciones son ficticios. No los uses para un traslado real.';

class FurgoAccountSummary extends StatelessWidget {
  const FurgoAccountSummary({
    super.key,
    required this.role,
    this.name,
    this.email,
  });
  final String role;
  final String? name, email;

  @override
  Widget build(BuildContext context) => FurgoSurface(
    emphasis: true,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(role, style: Theme.of(context).textTheme.bodySmall),
        if (name != null) ...[
          const SizedBox(height: 8),
          Text(name!, style: Theme.of(context).textTheme.titleLarge),
        ],
        if (email != null) ...[
          const SizedBox(height: 16),
          Text(
            'Correo de la cuenta',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          SelectableText(email!),
        ],
      ],
    ),
  );
}

class FurgoSyntheticNotice extends StatelessWidget {
  const FurgoSyntheticNotice({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    label: syntheticDataNotice,
    child: ExcludeSemantics(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.science_outlined,
            size: 20,
            color: FurgoColors.muted,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Datos de ensayo · Información ficticia',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    ),
  );
}
