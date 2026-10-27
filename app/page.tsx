import Header from '@/app/components/Header';
import InspectionForm from '@/app/components/InspectionForm';
import { requireProfile } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewInspectionPage() {
  const profile = await requireProfile();
  return (
    <>
      <Header profile={profile} current="new" />
      <InspectionForm inspectorName={profile.name} region={profile.region} />
    </>
  );
}
