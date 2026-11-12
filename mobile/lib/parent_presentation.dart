import 'package:flutter/material.dart';
import 'furgo_theme.dart';
import 'furgo_widgets.dart';

const parentBlue = FurgoColors.blue;
const parentSoftBlue = FurgoColors.blueSoft;
const parentGreen = FurgoColors.success;
const parentAmber = FurgoColors.warning;
const parentRed = FurgoColors.error;

class ParentPanel extends StatelessWidget {
  const ParentPanel({super.key, required this.child, this.soft = false});
  final Widget child;
  final bool soft;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: FurgoLayout.space3),
    child: FurgoSurface(emphasis: soft, child: child),
  );
}

class ParentIcon extends StatelessWidget {
  const ParentIcon(this.icon, {super.key, this.color = parentBlue});
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(FurgoLayout.panelRadius),
      ),
      child: Icon(icon, color: color, size: 28),
    ),
  );
}

class ParentMetadata extends StatelessWidget {
  const ParentMetadata(this.icon, this.text, {super.key});
  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, size: 20, color: parentBlue)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text, style: Theme.of(context).textTheme.bodySmall),
        ),
      ],
    ),
  );
}

class ParentDisclosure extends StatelessWidget {
  const ParentDisclosure({
    super.key,
    required this.title,
    required this.icon,
    required this.children,
    this.subtitle,
  });
  final String title;
  final IconData icon;
  final Widget? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: FurgoLayout.space3),
    child: FurgoSurface(
      padding: EdgeInsets.zero,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        leading: ExcludeSemantics(child: Icon(icon, color: parentBlue)),
        title: Text(title),
        subtitle: subtitle,
        expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );
}

class ParentCompareAction extends StatelessWidget {
  const ParentCompareAction({
    super.key,
    required this.selected,
    required this.onPressed,
  });
  final bool selected;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    selected: selected,
    child: Tooltip(
      message: selected ? 'Quitar de comparación' : 'Agregar a comparación',
      child: TextButton.icon(
        onPressed: onPressed,
        icon: Icon(selected ? Icons.check_circle : Icons.compare_arrows),
        label: Text(
          selected ? 'Agregado' : 'Comparar',
          semanticsLabel: selected ? 'Agregado a comparar' : 'Comparar',
        ),
      ),
    ),
  );
}

IconData requestStatusIcon(String status) => switch (status) {
  'pending' => Icons.schedule,
  'accepted' => Icons.check_circle_outline,
  'declined' => Icons.cancel_outlined,
  'cancelled' => Icons.remove_circle_outline,
  _ => Icons.help_outline,
};

Color requestStatusColor(String status) => switch (status) {
  'pending' => parentAmber,
  'accepted' => parentGreen,
  'declined' => parentRed,
  _ => FurgoColors.neutral,
};
