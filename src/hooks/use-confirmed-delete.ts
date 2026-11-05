import { useCallback } from "react";
import { useToast } from "./use-toast";

interface Messages {
  /** Question shown in the confirm dialog. */
  confirmMessage: string;
  /** Toast shown after the item is removed. */
  successMessage: string;
}

/** Returns a handler that asks for confirmation, then removes the item and reports success. */
export function useConfirmedDelete(
  remove: (id: string) => void,
  { confirmMessage, successMessage }: Messages,
) {
  const { confirm, success } = useToast();

  return useCallback(
    async (id: string) => {
      if (await confirm(confirmMessage)) {
        remove(id);
        success(successMessage);
      }
    },
    [confirm, success, remove, confirmMessage, successMessage],
  );
}
