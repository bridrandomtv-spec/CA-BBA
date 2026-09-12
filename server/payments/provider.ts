// Interface passerelle de paiement — le CCP/BaridiMob par référence
// est le premier provider ; Chargily (CIB + Edahabia) et SATIM se
// brancheront ICI, sans réécrire la file de validation ni la comptabilité.

export interface PaymentDeclaration {
  kind: 'order' | 'donation' | 'ticket';
  refId: string;
  amount: number;
  method: string;
  bankRef?: string;
  payerName?: string;
}

export interface PaymentProvider {
  id: 'ccp_manual' | 'chargily' | 'satim';
  label: string;
  /** false tant que le contrat marchand n'est pas signé. */
  available: boolean;
  declare(d: PaymentDeclaration): Promise<{ status: 'pending' | 'redirect'; url?: string }>;
}

export const ccpManualProvider: PaymentProvider = {
  id: 'ccp_manual',
  label: 'CCP / BaridiMob par référence (validation admin)',
  available: true,
  declare: async () => ({ status: 'pending' }),
};

// Le jour du contrat marchand : implémenter redirect vers la page
// de paiement + webhook de confirmation, puis available: true.
export const providers: PaymentProvider[] = [ccpManualProvider];
