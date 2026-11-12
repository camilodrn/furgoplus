"""Bounded, read-only account report for the academic fair."""

from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.response import Response

from accounts.models import User
from drivers.control_api import query_input
from drivers.publication_api import AdminView


class RegistrationsInput(serializers.Serializer):
    q = serializers.CharField(max_length=100, required=False, allow_blank=True)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    offset = serializers.IntegerField(min_value=0, default=0)
    limit = serializers.IntegerField(min_value=1, max_value=50, default=25)


class AdminRegistrationsView(AdminView):
    def get(self, request):
        filters = query_input(request, RegistrationsInput)
        # Global totals include inactive accounts and remain independent of filters.
        totals = dict.fromkeys(User.Role.values, 0)
        totals.update(
            {
                row["role"]: row["count"]
                for row in User.objects.values("role").annotate(count=Count("pk"))
            }
        )
        rows = User.objects.all()
        if "role" in filters:
            rows = rows.filter(role=filters["role"])
        if filters.get("q"):
            term = filters["q"]
            rows = rows.filter(
                Q(parent_profile__display_name__icontains=term)
                | Q(driver_profile__display_name__icontains=term)
                | (Q(email__iendswith="@example.test") & Q(email__icontains=term))
            )
        count = rows.count()
        # Fetch only report fields: never load password hashes or session data.
        rows = rows.order_by("-created_at", "-pk").values(
            "id",
            "email",
            "role",
            "created_at",
            "parent_profile__display_name",
            "driver_profile__display_name",
        )[filters["offset"] : filters["offset"] + filters["limit"]]
        results = [
            {
                "id": row["id"],
                "display_name": (
                    row["parent_profile__display_name"]
                    if row["role"] == "parent"
                    else row["driver_profile__display_name"]
                    if row["role"] == "driver"
                    else None
                ),
                # Existing accounts outside the synthetic domain still count,
                # but their email is unnecessary for this demonstration.
                "email": row["email"]
                if row["email"].lower().endswith("@example.test")
                else None,
                "role": row["role"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        return Response({"totals": totals, "count": count, "results": results})
