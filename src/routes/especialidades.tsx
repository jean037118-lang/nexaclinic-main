import { createFileRoute } from '@tanstack/react-router';

import { EspecialidadeForm } from '@/components/EspecialidadeForm';

export const Route = createFileRoute('/especialidades')({
  head: () => ({
    meta: [{ title: 'Especialidades — NexaClinic' }],
  }),

  component: EspecialidadesPage,
});

function EspecialidadesPage() {
  return <EspecialidadeForm />;
}