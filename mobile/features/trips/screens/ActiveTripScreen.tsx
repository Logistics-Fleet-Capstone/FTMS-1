import { AppScreen } from '@/components/AppScreen';
import { EmptyState } from '@/components/EmptyState';
import { PlannedWorkflow } from '@/components/PlannedWorkflow';

export default function ActiveTripScreen() {
  return (
    <AppScreen title="Active Trip" description="Live trip execution controls are planned for a later phase.">
      <EmptyState
        title="No active trip."
        message="Location, navigation, telemetry, and trip-state actions are not enabled."
      />
      <PlannedWorkflow
        destinations={[
          { label: 'Preview Incident Report', href: '/incident' },
          { label: 'Preview Proof of Completion', href: '/completion' },
        ]}
      />
    </AppScreen>
  );
}
