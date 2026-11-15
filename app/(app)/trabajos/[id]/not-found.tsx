import { ButtonLink, EmptyState } from "@/components/ui/base";

export default function TrabajoNoEncontrado() {
  return (
    <EmptyState
      title="No encontramos ese trabajo"
      description="Puede que se haya borrado o que el link esté mal."
      action={<ButtonLink href="/trabajos">Ver trabajos</ButtonLink>}
    />
  );
}
