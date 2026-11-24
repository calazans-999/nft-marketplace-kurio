// Adaptado de shadcn/ui, componente Dialog (MIT).
import * as Primitive from "@radix-ui/react-dialog";
import type { ComponentProps } from "react";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;

export function DialogContent({
  children,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay
        data-slot="dialog-overlay"
        className="dialog-overlay"
      />
      <Primitive.Content
        data-slot="dialog-content"
        className="dialog-content"
        {...props}
      >
        {children}
        <DialogClose>Fechar</DialogClose>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
