import { ButtonLink, EmptyState } from "@/components/ui/base";

export default function NoEncontrado() {
  return (
    <EmptyState
      title="No encontramos lo que buscabas"
      description="Puede que se haya borrado o que el link esté mal."
      action={<ButtonLink href="/">Ir al inicio</ButtonLink>}
    />
  );
}
