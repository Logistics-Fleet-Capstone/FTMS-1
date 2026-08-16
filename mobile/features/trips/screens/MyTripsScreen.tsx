import { AppScreen } from '@/components/AppScreen';
import { EmptyState } from '@/components/EmptyState';
import { PlannedWorkflow } from '@/components/PlannedWorkflow';

export default function MyTripsScreen() {
  return (
    <AppScreen title="My Trips" description="Assignments confirmed for this driver will appear here.">
      <EmptyState title="No trips assigned." message="Pull-to-refresh and live trip data are planned for a later phase." />
      <PlannedWorkflow destinations={[{ label: 'Preview Trip Details', href: '/trips/preview' }]} />
    </AppScreen>
  );
}
