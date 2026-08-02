from django.urls import path

from . import views

urlpatterns = [
    path("", views.TransportRequestListView.as_view()),
    path("<str:request_number>/", views.TransportRequestDetailView.as_view()),
    path("<str:request_number>/submit/", views.SubmitView.as_view()),
    path("<str:request_number>/approve/", views.ApproveView.as_view()),
    path("<str:request_number>/reject/", views.RejectView.as_view()),
    path("<str:request_number>/request-details/", views.RequestDetailsView.as_view()),
    path("<str:request_number>/resubmit/", views.ResubmitView.as_view()),
    path("<str:request_number>/cancel/", views.CancelView.as_view()),
    path("<str:request_number>/history/", views.HistoryView.as_view()),
]
