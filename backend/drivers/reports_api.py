from django.http import HttpResponse
from rest_framework.response import Response

from drivers.capabilities import require_capability
from drivers.publication_api import DriverView
from drivers.reports import (
    advanced_report,
    month_window,
    monthly_report,
    report_snapshot,
)


class MonthlyReportsView(DriverView):
    def get(self, request):
        require_capability(request.user, "reports.monthly.read")
        start, end = month_window(request.query_params)
        with report_snapshot():
            return Response(monthly_report(self.driver(request), start, end))


class AdvancedReportsView(DriverView):
    def get(self, request):
        require_capability(request.user, "reports.detail.read")
        require_capability(request.user, "analytics.period_comparison")
        start, end = month_window(request.query_params)
        with report_snapshot():
            return Response(advanced_report(self.driver(request), start, end))


class ReportExportView(DriverView):
    kind = None

    def get(self, request):
        from drivers.reports_xlsx import export_report

        require_capability(request.user, "reports.xlsx.export")
        start, end = month_window(request.query_params)
        with report_snapshot():
            content = export_report(self.driver(request), start, end, self.kind)
        response = HttpResponse(
            content,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = (
            f'attachment; filename="furgoplus-{self.kind}-{start:%Y-%m}.xlsx"'
        )
        return response


class PaymentsExportView(ReportExportView):
    kind = "payments"


class RunsExportView(ReportExportView):
    kind = "runs"


class ContactsExportView(ReportExportView):
    kind = "contacts"
