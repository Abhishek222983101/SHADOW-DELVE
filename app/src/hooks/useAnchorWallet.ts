import { useMemo } from "react";
import { useWallet, AnchorWallet } from "@solana/wallet-adapter-react";

export function useAnchorWallet(): AnchorWallet | null {
  const { publicKey, signTransaction, signAllTransactions } = useWallet();

  return useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) {
      return null;
    }
    return {
      publicKey,
      signTransaction,
      signAllTransactions,
    } as AnchorWallet;
  }, [publicKey, signTransaction, signAllTransactions]);
}
