from django.urls import path

from trips import views

urlpatterns = [
    path("api/trip", views.trip),
    path("api/places", views.places),
]
