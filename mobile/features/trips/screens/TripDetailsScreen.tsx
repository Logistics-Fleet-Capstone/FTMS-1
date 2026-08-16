import { AppScreen } from '@/components/AppScreen';
import { EmptyState } from '@/components/EmptyState';
import { PlannedWorkflow } from '@/components/PlannedWorkflow';

export default function TripDetailsScreen() {
  return (
    <AppScreen title="Trip Details" description="Assignment details and driver response controls will appear here.">
      <EmptyState
        title="No trip selected."
        message="This preview does not contain a vehicle, route, guest, ETA, or assignment."
      />
      <PlannedWorkflow
        destinations={[
          { label: 'Preview Pre-Trip Inspection', href: '/inspection' },
          { label: 'Preview Active Trip', href: '/active-trip' },
        ]}
      />
    </AppScreen>
  );
}
