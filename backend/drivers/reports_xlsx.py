"""Memory-only XLSX, allowlisted data, no formulas, hyperlinks or public storage."""

from io import BytesIO

from xlsxwriter import Workbook

from drivers.reports import comparison, detail_rows, monthly_report, queries

HEADERS = {
    "id": "Registro",
    "route_id": "Ruta",
    "service_period_start": "Inicio servicio",
    "service_period_end": "Fin servicio",
    "due_on": "Vencimiento",
    "status": "Estado actual",
    "amount_clp": "Monto CLP",
    "service_date": "Fecha servicio",
    "state": "Estado actual",
    "seat_capacity_snapshot": "Capacidad registrada",
    "start_time_snapshot": "Hora inicio registrada",
    "end_time_snapshot": "Hora fin registrada",
    "created_at": "Recibida (Santiago)",
    "resolved_at": "Resuelta (Santiago)",
    "seat_capacity": "Capacidad actual",
    "next_service_date": "Próximo servicio",
    "used_seats": "Asignaciones actuales",
    "available_seats": "Cupos disponibles proyectados",
}
LABELS = {
    "payments": "Pagos manuales",
    "runs": "Recorridos y cupos",
    "contacts": "Solicitudes de contacto",
}
STATES = {
    "pending": "Pendiente",
    "paid": "Pagado manual",
    "void": "Anulado",
    "planned": "Planificado",
    "in_progress": "En curso",
    "completed": "Finalizado",
    "accepted": "Aceptada",
    "declined": "Rechazada",
    "cancelled": "Cancelada",
}


def write_cell(sheet, row, col, value, fmt=None):
    if isinstance(value, (int, float)):
        sheet.write_number(row, col, value, fmt)
    elif value is not None:
        # Explicit text type also covers =, +, -, @, tabs and line breaks.
        sheet.write_string(row, col, str(value), fmt)


def export_report(driver, start, end, kind):
    rows = detail_rows(queries(driver, start, end), kind)
    body = monthly_report(driver, start, end)
    previous = comparison(driver, start)
    output = BytesIO()
    with Workbook(
        output,
        {"in_memory": True, "strings_to_formulas": False, "strings_to_urls": False},
    ) as book:
        header = book.add_format(
            {
                "bold": True,
                "bg_color": "#163C49",
                "font_color": "white",
                "text_wrap": True,
            }
        )
        number = book.add_format({"num_format": "#,##0"})
        text = book.add_format({"text_wrap": True, "valign": "top"})
        summary = book.add_worksheet("Resumen")
        summary.set_column(0, 0, 65, text)
        summary.set_column(1, 3, 30)
        metadata = [
            ["FurgoPlus — " + LABELS[kind]],
            ["Período", body["period"]["month"]],
            ["Inicio inclusivo", str(start)],
            ["Fin exclusivo", str(end)],
            ["Generado America/Santiago", body["generated_at"]],
            *[[note] for note in body["notes"]],
            [
                "Métrica (estados actuales)",
                "Mes seleccionado",
                "Mes anterior " + previous["period"]["month"],
                "Diferencia absoluta",
            ],
        ]
        for i, row in enumerate(metadata):
            for j, value in enumerate(row):
                write_cell(
                    summary,
                    i,
                    j,
                    value,
                    header if i in (0, len(metadata) - 1) else text,
                )
            summary.set_row(i, 45 if i >= 5 else 30)
        now, prev = body["summary"], previous["summary"]
        metrics = []
        if kind == "payments":
            metrics = [
                ("Registros", now["payment_count"], prev["payment_count"]),
                (
                    "Monto no anulado CLP (pendiente + pagado manual)",
                    now["non_void_amount_clp"],
                    prev["non_void_amount_clp"],
                ),
            ]
            for status in now["payments"]:
                for field, label in (
                    ("count", "cantidad"),
                    ("amount_clp", "monto CLP"),
                ):
                    metrics.append(
                        (
                            STATES[status] + " — " + label,
                            now["payments"][status][field],
                            prev["payments"][status][field],
                        )
                    )
        else:
            key = "run_count" if kind == "runs" else "contact_count"
            metrics = [("Registros", now[key], prev[key])]
            for state in now[kind]:
                metrics.append((STATES[state], now[kind][state], prev[kind][state]))
            if kind == "runs":
                metrics.append(
                    (
                        "Suma capacidades registradas (no ocupación)",
                        now["recorded_capacity_total"],
                        prev["recorded_capacity_total"],
                    )
                )
        for i, (label, current, prior) in enumerate(metrics, len(metadata)):
            for j, value in enumerate((label, current, prior, current - prior)):
                write_cell(summary, i, j, value, text if j == 0 else number)
        summary.freeze_panes(len(metadata), 1)

        def table(name, records, fields):
            sheet = book.add_worksheet(name)
            sheet.set_column(0, len(fields) - 1, 27, text)
            sheet.set_row(0, 35)
            for col, field in enumerate(fields):
                write_cell(sheet, 0, col, HEADERS[field], header)
            for i, row in enumerate(records, 1):
                for j, field in enumerate(fields):
                    value = row[field]
                    if field in ("status", "state"):
                        value = STATES.get(value, value)
                    write_cell(
                        sheet, i, j, value, number if isinstance(value, int) else text
                    )
            sheet.freeze_panes(1, 0)
            sheet.autofilter(0, 0, len(records), len(fields) - 1)
            if not records:
                write_cell(sheet, 1, 0, "Sin datos para el período")

        from drivers.reports import DETAIL_FIELDS

        table("Detalle", rows, DETAIL_FIELDS[kind])
        if kind == "runs":
            table(
                "Cupos actuales " + body["current_capacity"]["as_of"],
                body["current_capacity"]["routes"],
                (
                    "route_id",
                    "status",
                    "seat_capacity",
                    "next_service_date",
                    "used_seats",
                    "available_seats",
                ),
            )
    return output.getvalue()
