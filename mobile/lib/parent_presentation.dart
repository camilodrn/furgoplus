import 'package:flutter/material.dart';

const parentBlue = Color(0xFF0752AC);
const parentSoftBlue = Color(0xFFEDF4FF);
const parentGreen = Color(0xFF246342);
const parentAmber = Color(0xFF825400);
const parentRed = Color(0xFFA32735);

/// Parent-only styling: keep the foundation's font sizes and system scaling.
ThemeData parentTheme(ThemeData base) {
  final action = ButtonStyle(
    minimumSize: const WidgetStatePropertyAll(Size(48, 48)),
    padding: const WidgetStatePropertyAll(
      EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    ),
    textStyle: const WidgetStatePropertyAll(
      TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
    ),
    shape: WidgetStatePropertyAll(
      RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
  );
  return base.copyWith(
    textTheme: base.textTheme.copyWith(
      headlineMedium: base.textTheme.headlineMedium?.copyWith(height: 1.2),
      titleLarge: base.textTheme.titleLarge?.copyWith(height: 1.25),
      titleMedium: base.textTheme.titleMedium?.copyWith(height: 1.25),
      bodyLarge: base.textTheme.bodyLarge?.copyWith(height: 1.3),
      bodyMedium: base.textTheme.bodyMedium?.copyWith(height: 1.3),
      bodySmall: base.textTheme.bodySmall?.copyWith(height: 1.3),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0xFFE0E7F0)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(style: action),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: action.copyWith(
        side: const WidgetStatePropertyAll(
          BorderSide(color: Color(0xFFCDDBEE)),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(style: action),
    expansionTileTheme: const ExpansionTileThemeData(
      tilePadding: EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      childrenPadding: EdgeInsets.fromLTRB(16, 0, 16, 16),
      shape: Border(),
      collapsedShape: Border(),
      iconColor: parentBlue,
      collapsedIconColor: parentBlue,
    ),
  );
}

class ParentPanel extends StatelessWidget {
  const ParentPanel({super.key, required this.child, this.soft = false});
  final Widget child;
  final bool soft;

  @override
  Widget build(BuildContext context) => Card(
    color: soft ? parentSoftBlue : null,
    child: Padding(padding: const EdgeInsets.all(16), child: child),
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
        borderRadius: BorderRadius.circular(14),
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
  Widget build(BuildContext context) => Card(
    child: ExpansionTile(
      leading: ExcludeSemantics(child: Icon(icon, color: parentBlue)),
      title: Text(title),
      subtitle: subtitle,
      expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
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
  _ => const Color(0xFF526176),
};
