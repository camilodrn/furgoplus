from django.contrib import admin
from django.urls import include, path

from api.errors import api_not_found

urlpatterns = [path("admin/", admin.site.urls), path("api/v1/", include("api.urls"))]
handler404 = api_not_found
